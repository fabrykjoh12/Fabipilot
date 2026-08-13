import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight, Plus, X, PieChart as PieChartIcon, Target, Receipt, CreditCard, Landmark, BarChart3, Lightbulb, Wand2 } from 'lucide-react'
import {
  listSubscriptions, addSubscription, updateSubscription, monthlyCost,
  listExpenses, addExpense, updateExpense, deleteExpense, listBudgets, setBudget, todayKey,
  getMonthlyTotals, setMonthlyTotal,
  listIncomes, addIncome, updateIncome, deleteIncome,
  listGoals, addGoal, updateGoal, addToGoal,
  listPlans, listInflows, listBalances, setBalanceSnapshot,
  deleteWithRestore, restoreRecord,
} from '../db.js'
import { kr, vibrate, burst, reduceMotion } from '../lib/fx.js'
import { AnimatedNumber, toast, useEscape } from '../lib/ui.jsx'
import { SWATCH } from '../lib/palette.js'
import { CATEGORIES, catMeta, catKey, subsFor, subLabel } from '../lib/categories.js'
import { safeToSpend, projectMonthEnd, remainingChargesThisMonth, yearlyReserve, upcomingCharges, categoryBreakdown } from '../lib/money.js'
import MoneyImportSheet from './MoneyImport.jsx'
import MoneyPlan from './MoneyPlan.jsx'
import { suggestBudgets } from '../lib/plan.js'
import { balanceAt, monthlyFlow } from '../lib/balance.js'
import { fixedThisMonth, detectRecurring } from '../lib/recurring.js'
import { monthDiff, explainMonth } from '../lib/monthDiff.js'
import { useAskSheet } from '../lib/askSheet.jsx'
import './Money.css'


const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
const WEEKDAYS = ['søndag', 'mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag']

// "2026-08-08" → «Fredag 8. august» (i dag/i går der det passer)
function dayLabel(iso, todayIso) {
  if (iso === todayIso) return 'I dag'
  const d = new Date(iso + 'T12:00:00')
  const label = `${WEEKDAYS[d.getDay()]} ${d.getDate()}. ${MONTHS[d.getMonth()]}`
  return label.charAt(0).toUpperCase() + label.slice(1)
}
const pad = (n) => String(n).padStart(2, '0')

function barColor(ratio) {
  if (ratio > 1) return 'var(--danger)'
  if (ratio >= 0.8) return SWATCH.amber
  return 'var(--forest)'
}

/** Endring vs forrige måned — mer bruk = rødt, mindre = grønt. */
function ChangeBadge({ cur, prev }) {
  if (cur === 0 && prev === 0) return null
  const diff = cur - prev
  if (Math.abs(diff) < 1) return <span className="delta flat">uendret</span>
  const up = diff > 0
  const pct = prev > 0 ? Math.round((Math.abs(diff) / prev) * 100) : null
  return (
    <span className={'delta ' + (up ? 'up' : 'down')}>
      {up ? '↑' : '↓'} {kr(Math.abs(diff))}{pct !== null ? ` · ${pct}%` : ''}
    </span>
  )
}

/** Dager til neste trekk på en gitt dag i måneden (1–31). */
function daysUntilDay(day) {
  const now = new Date()
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  let target = new Date(now.getFullYear(), now.getMonth(), day)
  if (target < t0) target = new Date(now.getFullYear(), now.getMonth() + 1, day)
  return Math.round((target - t0) / 86400000)
}

/** De siste n månedene (eldst→nyest) som {y, m, prefix, label}. */
function lastNMonths(n, refY, refM) {
  return [...Array(n)].map((_, i) => {
    const dt = new Date(refY, refM - (n - 1 - i), 1)
    const y = dt.getFullYear(), m = dt.getMonth()
    return { y, m, prefix: `${y}-${pad(m + 1)}`, label: MONTHS[m].slice(0, 3) }
  })
}

/* ============ trend: forbruk per måned ============ */
function MonthTrend({ expenses, subTotal, cursor, onPick }) {
  const months = lastNMonths(12, cursor.y, cursor.m)
  const data = months.map((mo) => {
    const exp = expenses
      .filter((e) => (e.date || '').startsWith(mo.prefix))
      .reduce((s, x) => s + (x.amount || 0), 0)
    return { ...mo, total: exp + subTotal }
  })
  const max = Math.max(1, ...data.map((d) => d.total))
  if (data.every((d) => d.total === 0)) return null

  return (
    <div className="trend card">
      <span className="trend-lbl">Forbruk siste 12 måneder</span>
      <div className="trend-bars">
        {data.map((d) => {
          const sel = d.y === cursor.y && d.m === cursor.m
          return (
            <button
              key={d.prefix}
              type="button"
              className={'trend-col' + (sel ? ' on' : '')}
              onClick={() => onPick(d.y, d.m)}
              title={`${MONTHS[d.m]} ${d.y}: ${kr(d.total)}`}
            >
              <span className="trend-val">{d.total >= 1000 ? Math.round(d.total / 1000) + 'k' : d.total || ''}</span>
              <span className="trend-bar-wrap">
                <i style={{ height: Math.max(4, (d.total / max) * 100) + '%' }} />
              </span>
              <span className="trend-mlbl">{d.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ============ kakediagram: fordeling per kategori ============ */
function CategoryDonut({ rows, total }) {
  const data = rows.filter((r) => r.spent > 0)
  if (data.length < 2) return null
  return (
    <div className="card donut-card">
      <span className="trend-lbl">Fordeling denne måneden</span>
      <div className="donut-wrap">
        <div className="donut-chart">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="spent"
                nameKey="label"
                innerRadius="68%"
                outerRadius="100%"
                paddingAngle={data.length > 1 ? 2 : 0}
                stroke="none"
                startAngle={90}
                endAngle={-270}
                isAnimationActive={!reduceMotion()}
                animationDuration={650}
              >
                {data.map((d) => (
                  <Cell key={d.k} fill={d.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="donut-center">
            <AnimatedNumber className="donut-total" value={total} format={kr} />
            <span className="donut-sub">totalt</span>
          </div>
        </div>
        <ul className="donut-legend">
          {data.slice(0, 6).map((d) => (
            <li key={d.k}>
              <span className="dl-dot" style={{ background: d.color }} />
              <span className="dl-name">{d.emoji} {d.label}</span>
              <span className="dl-amt">{kr(d.spent)}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/* ============ bunn-sheet: hva gikk pengene til i én kategori ============
   «Dagligvarer: 8 200 kr» sier ingenting om HVA. Her brytes summen ned på
   type (underkategori) og sted (butikk), med alle kjøpene under. */
function CategorySheet({ cat, expenses, monthLabel, budget, prevSpent, onEdit, onSetBudget, onClose }) {
  useEscape(onClose)
  const c = catMeta(cat)
  const b = categoryBreakdown(expenses, cat)
  const ratio = budget > 0 ? b.total / budget : 0

  return (
    <div className="msheet-overlay" onClick={onClose}>
      <div className="msheet cs-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="msheet-grip" />

        <div className="cs-head">
          <span className="cs-emoji" style={{ background: c.color + '22' }}>{c.emoji}</span>
          <div>
            <h2 className="msheet-title">{c.label}</h2>
            <span className="cs-month">{monthLabel}</span>
          </div>
        </div>

        <div className="cs-hero">
          <AnimatedNumber className="cs-total" value={b.total} format={kr} />
          <div className="cs-hero-meta">
            <span>{b.count} {b.count === 1 ? 'kjøp' : 'kjøp'}</span>
            <ChangeBadge cur={b.total} prev={prevSpent} />
          </div>
          {budget > 0 && (
            <>
              <div className="bc-bar cs-bar">
                <i style={{ width: Math.min(100, ratio * 100) + '%', background: barColor(ratio) }} />
              </div>
              <span className="cs-budget">
                {ratio > 1
                  ? `${kr(b.total - budget)} over budsjettet på ${kr(budget)}`
                  : `${kr(budget - b.total)} igjen av ${kr(budget)}`}
              </span>
            </>
          )}
        </div>

        {b.count === 0 ? (
          <p className="cs-empty">Ingenting registrert i denne kategorien denne måneden.</p>
        ) : (
          <>
            {b.bySub.length > 1 && (
              <>
                <span className="msheet-lbl">Type</span>
                <div className="cs-list">
                  {b.bySub.map((s) => (
                    <div key={s.sub || 'ingen'} className="cs-row">
                      <span className="cs-row-name">{subLabel(cat, s.sub) || 'Uten type'}</span>
                      <span className="cs-row-bar"><i style={{ width: (b.total ? (s.total / b.total) * 100 : 0) + '%', background: c.color }} /></span>
                      <span className="cs-row-amt">{kr(Math.round(s.total))}</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <span className="msheet-lbl">Steder</span>
            <div className="cs-list">
              {b.byMerchant.slice(0, 12).map((m) => (
                <div key={m.name} className="cs-row">
                  <span className="cs-row-name">
                    {m.name}
                    {m.count > 1 && <small> · {m.count}x</small>}
                  </span>
                  <span className="cs-row-bar"><i style={{ width: (b.total ? (m.total / b.total) * 100 : 0) + '%', background: c.color }} /></span>
                  <span className="cs-row-amt">{kr(Math.round(m.total))}</span>
                </div>
              ))}
              {b.byMerchant.length > 12 && (
                <p className="cs-more">+ {b.byMerchant.length - 12} steder til</p>
              )}
            </div>

            <span className="msheet-lbl">Alle kjøp</span>
            <div className="cs-txs">
              {b.rows.map((e) => (
                <button key={e.id} type="button" className="cs-tx" onClick={() => onEdit(e)}>
                  <span className="cs-tx-date">{e.date.slice(8)}.{e.date.slice(5, 7)}</span>
                  <span className="cs-tx-name">{e.note || subLabel(cat, e.sub) || c.label}</span>
                  <span className="cs-tx-amt">{kr(e.amount)}</span>
                </button>
              ))}
            </div>
          </>
        )}

        <button type="button" className="budget-add" onClick={onSetBudget}>
          {budget > 0 ? 'Endre budsjett' : 'Sett budsjett for denne kategorien'}
        </button>
      </div>
    </div>
  )
}

const TABS = [
  { k: 'oversikt', label: 'Oversikt' },
  { k: 'forbruk', label: 'Forbruk' },
  { k: 'faste', label: 'Faste' },
  { k: 'plan', label: 'Plan' },
  { k: 'sparing', label: 'Sparing' },
]

/* ============ bunn-sheet: legg til / rediger forbruk ============ */
function ExpenseSheet({ initial, onClose }) {
  useEscape(onClose)
  const editing = !!initial
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category || 'dagligvarer')
  const [sub, setSub] = useState(initial?.sub || '')
  const [note, setNote] = useState(initial?.note || '')
  const [date, setDate] = useState(initial?.date || todayKey())
  const saveRef = useRef(null)

  async function save() {
    const amt = Number(amount)
    if (!amt) return
    const subVal = sub || null
    if (editing) await updateExpense(initial.id, { amount: amt, category, sub: subVal, note: note.trim(), date })
    else await addExpense({ amount: amt, category, sub: subVal, note: note.trim(), date })
    vibrate([12, 30, 12])
    burst(saveRef.current)
    setTimeout(onClose, reduceMotion() ? 0 : 160)
  }
  async function remove() {
    if (!editing) return
    await deleteExpense(initial.id)
    vibrate(8)
    onClose()
  }

  return (
    <div className="msheet-overlay" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="msheet-grip" />
        <h2 className="msheet-title">{editing ? 'Rediger forbruk' : 'Nytt forbruk'}</h2>

        <div className="msheet-amount">
          <input
            className="msheet-amount-in"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            autoFocus={!editing}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="msheet-kr">kr</span>
        </div>

        <span className="msheet-lbl">Kategori</span>
        <div className="msheet-cats">
          {CATEGORIES.map((c) => (
            <button
              key={c.k}
              type="button"
              className={'msheet-cat' + (category === c.k ? ' on' : '')}
              style={category === c.k ? { borderColor: c.color, background: c.color + '18' } : undefined}
              onClick={() => { setCategory(c.k); setSub('') }}
            >
              <span className="msheet-cat-emoji">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>

        {subsFor(category).length > 0 && (
          <>
            <span className="msheet-lbl">Underkategori (valgfri)</span>
            <div className="msheet-cats">
              <button type="button" className={'msheet-cat' + (sub === '' ? ' on' : '')} onClick={() => setSub('')}>– uten –</button>
              {subsFor(category).map((sc) => (
                <button
                  key={sc.k}
                  type="button"
                  className={'msheet-cat' + (sub === sc.k ? ' on' : '')}
                  onClick={() => setSub(sc.k)}
                >{sc.label}</button>
              ))}
            </div>
          </>
        )}

        <div className="msheet-row">
          <label className="msheet-field">
            <span className="msheet-lbl">Dato</span>
            <input className="msheet-in" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="msheet-field">
            <span className="msheet-lbl">Notat (valgfritt)</span>
            <input className="msheet-in" placeholder="f.eks. Rema" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>

        <button ref={saveRef} type="button" className="msheet-save" disabled={!Number(amount)} onClick={save}>
          {editing ? 'Lagre' : 'Legg til'}
        </button>
        {editing && <button type="button" className="msheet-del" onClick={remove}>Slett</button>}
      </div>
    </div>
  )
}

/* ============ bunn-sheet: sett budsjett ============ */
function BudgetSheet({ initialCat, budgetByCat, onClose }) {
  useEscape(onClose)
  const [category, setCategory] = useState(initialCat || 'dagligvarer')
  const [amount, setAmount] = useState(initialCat && budgetByCat[initialCat] ? String(budgetByCat[initialCat]) : '')

  function pick(k) {
    setCategory(k)
    setAmount(budgetByCat[k] ? String(budgetByCat[k]) : '')
  }
  async function save() {
    await setBudget(category, Number(amount) || 0)
    vibrate(8)
    onClose()
  }

  return (
    <div className="msheet-overlay" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="msheet-grip" />
        <h2 className="msheet-title">Månedsbudsjett</h2>

        <span className="msheet-lbl">Kategori</span>
        <div className="msheet-cats">
          {CATEGORIES.map((c) => (
            <button
              key={c.k}
              type="button"
              className={'msheet-cat' + (category === c.k ? ' on' : '')}
              style={category === c.k ? { borderColor: c.color, background: c.color + '18' } : undefined}
              onClick={() => pick(c.k)}
            >
              <span className="msheet-cat-emoji">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>

        <div className="msheet-amount">
          <input
            className="msheet-amount-in"
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <span className="msheet-kr">kr / mnd</span>
        </div>

        <button type="button" className="msheet-save" onClick={save}>
          {Number(amount) > 0 ? 'Lagre budsjett' : 'Fjern budsjett'}
        </button>
      </div>
    </div>
  )
}

/* ============ bunn-sheet: fyll inn hele måneden (totaler per kategori) ============ */
function MonthlyTotalsSheet({ y, m, onClose }) {
  useEscape(onClose)
  const [cursor, setCursor] = useState({ y, m })
  const [vals, setVals] = useState(null) // null = henter tall for valgt måned

  const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}`
  const monthLabel = `${MONTHS[cursor.m].charAt(0).toUpperCase() + MONTHS[cursor.m].slice(1)} ${cursor.y}`
  const isCurrentMonth = monthPrefix === todayKey().slice(0, 7)

  useEffect(() => {
    let cancelled = false
    getMonthlyTotals(monthPrefix).then((totals) => {
      if (cancelled) return
      const init = {}
      for (const c of CATEGORIES) init[c.k] = totals[c.k] ? String(totals[c.k]) : ''
      setVals(init)
    })
    return () => { cancelled = true }
  }, [monthPrefix])

  function shiftMonth(d) {
    const dt = new Date(cursor.y, cursor.m + d, 1)
    setCursor({ y: dt.getFullYear(), m: dt.getMonth() })
    setVals(null)
  }

  const loaded = vals !== null
  const total = loaded ? Object.values(vals).reduce((s, v) => s + (Number(v) || 0), 0) : 0

  async function save() {
    if (!vals) return
    for (const c of CATEGORIES) await setMonthlyTotal(monthPrefix, c.k, vals[c.k])
    vibrate([12, 30, 12])
    onClose()
  }

  return (
    <div className="msheet-overlay" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="msheet-grip" />
        <h2 className="msheet-title">Fyll inn hele måneden</h2>
        <div className="month-nav">
          <button type="button" className="cal-arrow" aria-label="Forrige måned" onClick={() => shiftMonth(-1)}>
            <ChevronLeft />
          </button>
          <span className="month-nav-lbl">{monthLabel}</span>
          <button type="button" className="cal-arrow" aria-label="Neste måned" disabled={isCurrentMonth} onClick={() => shiftMonth(1)}>
            <ChevronRight />
          </button>
        </div>
        <p className="msheet-hint">
          Skriv inn totalt du brukte i hver kategori — raskere enn å logge hvert kjøp.
        </p>

        <div className="mtotal-sum">
          <span className="mtotal-lbl">Totalt</span>
          <span className="mtotal-amt">{kr(total)}</span>
        </div>

        {loaded && (
          <div className="mtotal-rows">
            {CATEGORIES.map((c) => (
              <label key={c.k} className="mtotal-row">
                <span className="mtotal-emoji">{c.emoji}</span>
                <span className="mtotal-name">{c.label}</span>
                <input
                  className="mtotal-in"
                  type="number"
                  inputMode="decimal"
                  placeholder="0"
                  value={vals[c.k] || ''}
                  onChange={(e) => setVals((v) => ({ ...v, [c.k]: e.target.value }))}
                />
              </label>
            ))}
          </div>
        )}

        <button type="button" className="msheet-save" disabled={!loaded} onClick={save}>Lagre</button>
      </div>
    </div>
  )
}

/* ============ abonnementskort (Faste) ============ */
function SubCard({ sub, onAsk }) {
  const perMonth = monthlyCost(sub)
  const cat = catMeta(catKey(sub.category || 'ovrig'))
  const [editingName, setEditingName] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const inputRef = useRef(null)

  function startEdit() {
    setNameVal(sub.name)
    setEditingName(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }
  async function saveName() {
    const v = nameVal.trim()
    if (v && v !== sub.name) await updateSubscription(sub.id, { name: v })
    setEditingName(false)
  }
  function nextCat() {
    const keys = CATEGORIES.map((c) => c.k)
    const i = keys.indexOf(catKey(sub.category || 'ovrig'))
    updateSubscription(sub.id, { category: keys[(i + 1) % keys.length] })
  }
  function setDay() {
    onAsk({
      title: `Trekkdag · ${sub.name}`,
      label: 'Dag i måneden (1–31). Tomt felt fjerner datoen.',
      initial: sub.renewDay || '',
      placeholder: 'f.eks. 15',
      onSave: (v) => {
        if (String(v).trim() === '') { updateSubscription(sub.id, { renewDay: null }); return }
        const n = Math.round(Number(v))
        if (!Number.isNaN(n) && n >= 1 && n <= 31) updateSubscription(sub.id, { renewDay: n })
      },
    })
  }
  const days = sub.renewDay ? daysUntilDay(sub.renewDay) : null

  return (
    <div className="card sub">
      <div className="sub-main">
        {editingName ? (
          <input
            ref={inputRef}
            className="sub-name-input"
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
          />
        ) : (
          <div className="sub-name" onClick={startEdit} title="Trykk for å redigere">{sub.name}</div>
        )}
        <div className="sub-badges">
          <button
            type="button"
            className="sub-cycle"
            onClick={() => updateSubscription(sub.id, { cycle: sub.cycle === 'yearly' ? 'monthly' : 'yearly' })}
          >
            {sub.cycle === 'yearly' ? 'per år' : 'per måned'}
          </button>
          <button
            type="button"
            className="sub-cat"
            style={{ color: cat.color, borderColor: cat.color + '55', background: cat.color + '18' }}
            onClick={nextCat}
            title="Trykk for å endre kategori"
          >
            {cat.emoji} {cat.label}
          </button>
          <button
            type="button"
            className={'sub-day' + (sub.renewDay ? '' : ' unset')}
            onClick={setDay}
            title={sub.renewDay ? `Neste trekk om ${days} ${days === 1 ? 'dag' : 'dager'}` : 'Sett trekkdag'}
          >
            🗓 {sub.renewDay ? `den ${sub.renewDay}.${days <= 7 ? ` · om ${days}d` : ''}` : 'sett dato'}
          </button>
        </div>
      </div>
      <div className="sub-right">
        <button
          type="button"
          className="sub-amount"
          aria-label="Endre beløp"
          onClick={() => onAsk({
            title: `Beløp · ${sub.name}`,
            label: sub.cycle === 'yearly' ? 'Kroner per år' : 'Kroner per måned',
            initial: sub.amount,
            suffix: 'kr',
            onSave: (v) => { const n = Number(v); if (!Number.isNaN(n)) updateSubscription(sub.id, { amount: n }) },
          })}
        >
          {kr(sub.amount)}
          {sub.cycle === 'yearly' && <span className="sub-sub">≈ {kr(perMonth)}/mnd</span>}
        </button>
        <button
          type="button"
          className="icon-x"
          aria-label="Slett"
          onClick={async () => {
            const rec = await deleteWithRestore('subscriptions', sub.id)
            toast.message(`Slettet «${sub.name}»`, {
              action: { label: 'Angre', onClick: () => restoreRecord('subscriptions', rec) },
            })
          }}
        >
          <X />
        </button>
      </div>
    </div>
  )
}

/* ============ hovedmodul ============ */
export default function Money() {
  /* 13 måneder dekker alt modulen viser (trendgraf 12, snitt 6, faste-oppdagelse
     12) — resten av historikken trenger vi ikke i minnet. */
  const since = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() - 13)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`
  }, [])
  const subs = useLiveQuery(() => listSubscriptions(), [], [])
  const expenses = useLiveQuery(() => listExpenses(since), [since], [])
  const budgets = useLiveQuery(() => listBudgets(), [], [])
  const incomes = useLiveQuery(() => listIncomes(), [], [])
  const goals = useLiveQuery(() => listGoals(), [], [])
  const plans = useLiveQuery(() => listPlans(), [], [])
  const inflows = useLiveQuery(() => listInflows(since), [since], [])
  const balances = useLiveQuery(() => listBalances(), [], [])

  const [tab, setTab] = useState('oversikt')
  const [cursor, setCursor] = useState(() => {
    const [y, m] = todayKey().split('-').map(Number)
    return { y, m: m - 1 }
  })
  const [sheet, setSheet] = useState(null) // {type:'expense', expense?} | {type:'budget', cat?}
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [incName, setIncName] = useState('')
  const [incAmount, setIncAmount] = useState('')
  const [goalName, setGoalName] = useState('')
  const [goalTarget, setGoalTarget] = useState('')
  const { ask, sheet: askSheet } = useAskSheet()

  const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0)

  const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}`
  const monthExpenses = expenses.filter((e) => (e.date || '').startsWith(monthPrefix))
  const expTotal = monthExpenses.reduce((s, x) => s + (x.amount || 0), 0)
  /* Faste trekk som ALLEREDE ligger som importerte kjøp skal ikke legges til igjen —
     ellers telles Spotify/Telia to ganger (`src/lib/recurring.js`). Bare de som ikke
     er trukket ennå denne måneden legges oppå kjøpssummen. */
  const fixedNow = fixedThisMonth(subs, monthExpenses, monthlyCost)
  const subTotal = fixedNow.total
  // Hele den faste kostnaden — «Faste»-fanen skal vise alt, ikke bare det som gjenstår.
  const subsMonthly = subs.reduce((s, x) => s + monthlyCost(x), 0)
  const totalSpent = subTotal + expTotal
  const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0)

  const prevDt = new Date(cursor.y, cursor.m - 1, 1)
  const prevMonthPrefix = `${prevDt.getFullYear()}-${pad(prevDt.getMonth() + 1)}`
  const prevMonthLabel = MONTHS[prevDt.getMonth()]
  const prevMonthExpenses = expenses.filter((e) => (e.date || '').startsWith(prevMonthPrefix))
  const prevExpTotal = prevMonthExpenses.reduce((s, x) => s + (x.amount || 0), 0)
  const prevFixed = fixedThisMonth(subs, prevMonthExpenses, monthlyCost)
  const prevTotalSpent = prevFixed.total + prevExpTotal

  const budgetByCat = {}
  for (const b of budgets) budgetByCat[b.category] = b.amount

  const spentByCat = {}
  for (const e of monthExpenses) spentByCat[e.category] = (spentByCat[e.category] || 0) + (e.amount || 0)
  for (const s of fixedNow.pending) {
    const k = catKey(s.category || 'ovrig')
    spentByCat[k] = (spentByCat[k] || 0) + monthlyCost(s)
  }

  const prevSpentByCat = {}
  for (const e of prevMonthExpenses) prevSpentByCat[e.category] = (prevSpentByCat[e.category] || 0) + (e.amount || 0)
  for (const s of prevFixed.pending) {
    const k = catKey(s.category || 'ovrig')
    prevSpentByCat[k] = (prevSpentByCat[k] || 0) + monthlyCost(s)
  }

  const catRows = CATEGORIES
    .map((c) => ({ ...c, spent: spentByCat[c.k] || 0, prevSpent: prevSpentByCat[c.k] || 0, budget: budgetByCat[c.k] || 0 }))
    .filter((c) => c.spent > 0 || c.budget > 0)
    .sort((a, b) => b.spent - a.spent)

  const upcoming = subs
    .filter((s) => s.renewDay)
    .map((s) => ({ id: s.id, name: s.name, amount: s.amount, days: daysUntilDay(s.renewDay) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)

  const isCurrentMonth = monthPrefix === todayKey().slice(0, 7)
  const monthLabel = `${MONTHS[cursor.m].charAt(0).toUpperCase() + MONTHS[cursor.m].slice(1)} ${cursor.y}`

  // «Trygt å bruke» + prognose gjelder kun inneværende måned (utledet, ikke lagret).
  const today = new Date()
  const safe = safeToSpend({ income: totalIncome, subsMonthly: subTotal, spentVariable: expTotal, budgetTotal: totalBudget }, today)
  const projected = projectMonthEnd({ spentVariable: expTotal, subsMonthly: subTotal }, today)
  const remainingCharges = remainingChargesThisMonth(subs, today)
  const reserve = yearlyReserve(subs)
  const upcomingMonthly = upcomingCharges(subs, today, 5)
  // Prognose vs grunnlag (budsjett hvis satt, ellers inntekt): + = under, − = over.
  const paceBasis = totalBudget > 0 ? totalBudget : totalIncome
  const paceDiff = paceBasis > 0 ? paceBasis - projected : 0
  const safeState = !safe.available ? '' : safe.over ? 'over' : safe.today < 100 ? 'low' : 'ok'

  function shiftMonth(d) {
    const dt = new Date(cursor.y, cursor.m + d, 1)
    setCursor({ y: dt.getFullYear(), m: dt.getMonth() })
  }

  /* Saldo + pengeflyt. `bal` er null helt til du har oppgitt saldoen én gang —
     vi gjetter ikke på hva du har. */
  const bal = balanceAt(balances, inflows, expenses, todayKey())
  const flow = monthlyFlow(inflows, expenses, monthPrefix)
  // Samme ark som resten av modulen bruker — ikke nettleserens grå systemboks.
  function askBalance() {
    ask({
      title: 'Hva står det på kontoen nå?',
      label: 'Les av i banken. Så holder appen saldoen oppdatert med det du importerer.',
      initial: bal ? Math.round(bal.balance) : '',
      suffix: 'kr',
      onSave: async (v) => {
        const n = Number(String(v).replace(/[\s\u00a0]/g, '').replace(',', '.'))
        if (String(v).trim() === '' || !Number.isFinite(n)) { toast.error('Skjønte ikke beløpet'); return }
        await setBalanceSnapshot({ date: todayKey(), amount: n })
        vibrate(12)
        toast.success('Saldo lagret', { description: 'Den oppdateres nå automatisk ved hver import.' })
      },
    })
  }

  /* Faste utgifter appen finner selv i bankhistorikken: samme butikk, stabilt
     beløp, samme dag, flere måneder på rad. Å legge dem inn her fjerner samtidig
     dobbelttellingen, siden de da kjennes igjen i kjøpene. */
  const recurringFound = detectRecurring(expenses, { subs })

  // Budsjettforslag fra faktisk historikk — mye bedre utgangspunkt enn blanke felt.
  /* «Hva var annerledes?» — endringsmerket sier at du brukte 7 % mer, men ikke
     HVA som flyttet seg. Ofte er hele utslaget ett kjøp. */
  const diff = monthDiff(expenses, monthPrefix, prevMonthPrefix)
  const diffText = explainMonth(diff, (k) => catMeta(k).label, kr)

  const budgetSuggestion = suggestBudgets(expenses, { monthsBack: 6 })
  async function applySuggestedBudgets() {
    const entries = Object.entries(budgetSuggestion.budgets)
    for (const [cat, amt] of entries) await setBudget(cat, amt)
    vibrate(12)
    toast.success(`Satte budsjett for ${entries.length} kategorier`, {
      description: 'Basert på snittet ditt. Juster fritt — det er bare et utgangspunkt.',
    })
  }

  async function addSub() {
    const n = name.trim()
    if (!n) return
    await addSubscription({ name: n, amount: Number(amount) || 0, cycle: 'monthly' })
    setName('')
    setAmount('')
    vibrate(8)
  }

  async function addGoalNow() {
    const n = goalName.trim()
    if (!n) return
    await addGoal({ name: n, target: Number(goalTarget) || 0 })
    setGoalName('')
    setGoalTarget('')
    vibrate(8)
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Penger</h1>

        <div className="money-tabs">
          {TABS.map((t) => (
            <button key={t.k} type="button" className={tab === t.k ? 'active' : ''} onClick={() => setTab(t.k)}>
              {tab === t.k && (
                <motion.span
                  className="seg-pill"
                  layoutId="money-tab-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <span className="seg-lbl">{t.label}</span>
            </button>
          ))}
        </div>

        {/* ===== OVERSIKT ===== */}
        {tab === 'oversikt' && (
          <>
            {/* Saldo først: «hva har jeg?» før «hva kan jeg bruke?».
                Pengeflyten henger UNDER saldoen som en tynn linjerad i samme kort — den
                forklarer tallet over, og fortjener ikke et eget kort som konkurrerer om blikket. */}
            <div className="bal-card">
              {bal ? (
                <button type="button" className="bal-hero" onClick={askBalance}>
                  <span className="bal-lbl">På konto nå</span>
                  <AnimatedNumber className="bal-amount" value={Math.round(bal.balance)} format={kr} />
                  <span className="bal-sub">
                    {bal.exact
                      ? `avlest ${bal.anchor.date.slice(8)}.${bal.anchor.date.slice(5, 7)}`
                      : `${bal.anchor.date.slice(8)}.${bal.anchor.date.slice(5, 7)} + ${kr(Math.round(bal.inSince))} inn − ${kr(Math.round(bal.outSince))} ut`}
                  </span>
                </button>
              ) : (
                <button type="button" className="bal-hero prompt" onClick={askBalance}>
                  <span className="bal-lbl">På konto</span>
                  <span className="bal-prompt-txt">
                    Skriv inn saldoen din én gang — så holder appen den oppdatert med det du importerer fra banken.
                  </span>
                </button>
              )}

              {(flow.in > 0 || flow.out > 0) && (
                <div className="flow">
                  <div className="flow-row">
                    <span className="flow-lbl">Inn i {MONTHS[cursor.m]}</span>
                    <span className="flow-amt pos">+{kr(Math.round(flow.in))}</span>
                  </div>
                  <div className="flow-row">
                    <span className="flow-lbl">Ut</span>
                    <span className="flow-amt">−{kr(Math.round(flow.out))}</span>
                  </div>
                  <div className="flow-row net">
                    <span className="flow-lbl">Netto</span>
                    <span className={'flow-amt' + (flow.net >= 0 ? ' pos' : ' neg')}>
                      {flow.net >= 0 ? '+' : '−'}{kr(Math.round(Math.abs(flow.net)))}
                    </span>
                  </div>
                  {flow.transfers > 0 && (
                    <p className="flow-note">
                      {kr(Math.round(flow.transfers))} av innbetalingene er overført fra egne kontoer — det er
                      flyttede penger, ikke inntekt.
                      {flow.income > 0 && ` Ekte inntekt: ${kr(Math.round(flow.income))}.`}
                    </p>
                  )}
                  {flow.savingRate !== null && flow.transfers === 0 && (
                    <p className="flow-note">
                      Du satt igjen med {Math.round(flow.savingRate * 100)} % av inntekten denne måneden.
                    </p>
                  )}
                </div>
              )}
            </div>

            {isCurrentMonth && (
              safe.available ? (
                <div className={'safe-hero ' + safeState}>
                  <span className="safe-lbl">{safe.over ? 'Du har brukt opp måneden' : 'Trygt å bruke i dag'}</span>
                  <AnimatedNumber className="safe-amount" value={safe.over ? Math.abs(safe.month) : safe.today} format={kr} />
                  {safe.over ? (
                    <span className="safe-sub">{kr(Math.abs(safe.month))} over grunnlaget · ta det rolig ut måneden</span>
                  ) : (
                    <span className="safe-sub">
                      {kr(safe.week)} igjen denne uka · {kr(safe.month)} igjen i {safe.daysLeft} {safe.daysLeft === 1 ? 'dag' : 'dager'}
                    </span>
                  )}
                </div>
              ) : (
                <button type="button" className="safe-hero prompt" onClick={() => document.querySelector('.income-add input')?.focus()}>
                  <span className="safe-lbl">Trygt å bruke</span>
                  <span className="safe-prompt-txt">Legg inn månedsinntekt eller et budsjett — så regner jeg ut hvor mye du trygt kan bruke hver dag.</span>
                </button>
              )
            )}

            <div className="month-nav">
              <button type="button" className="cal-arrow" aria-label="Forrige måned" onClick={() => shiftMonth(-1)}>
                <ChevronLeft />
              </button>
              <span className="month-nav-lbl">{monthLabel}</span>
              <button type="button" className="cal-arrow" aria-label="Neste måned" disabled={isCurrentMonth} onClick={() => shiftMonth(1)}>
                <ChevronRight />
              </button>
            </div>

            <div className="budget-summary">
              <span className="bs-label">brukt denne måneden</span>
              <AnimatedNumber className="bs-amount" value={totalSpent} format={kr} />
              {/* Regnestykket må stå der. Uten det ser tallet ut som om det motsier «Ut»
                  i saldo-kortet over — forskjellen er nettopp de faste trekkene som ikke
                  er trukket ennå. De som ER trukket ligger allerede i kjøpssummen. */}
              {subTotal > 0 && (
                <span className="bs-split">
                  {kr(expTotal)} kjøp + {kr(subTotal)} faste som ikke er trukket ennå
                </span>
              )}
              {subTotal === 0 && fixedNow.coveredAmount > 0 && (
                <span className="bs-split">
                  inkl. {kr(Math.round(fixedNow.coveredAmount))} i faste trekk
                </span>
              )}
              {totalBudget > 0 ? (
                <>
                  <div className="bs-bar">
                    <i style={{ width: Math.min(100, (totalSpent / totalBudget) * 100) + '%', background: barColor(totalSpent / totalBudget) }} />
                  </div>
                  <span className="bs-sub">
                    av {kr(totalBudget)} budsjett ·{' '}
                    {totalSpent <= totalBudget
                      ? `${kr(totalBudget - totalSpent)} igjen`
                      : `${kr(totalSpent - totalBudget)} over`}
                  </span>
                </>
              ) : (
                <span className="bs-sub">Sett et budsjett nedenfor for å følge med.</span>
              )}
              {(totalSpent > 0 || prevTotalSpent > 0) && (
                <span className="bs-delta">
                  <ChangeBadge cur={totalSpent} prev={prevTotalSpent} /> vs {prevMonthLabel}
                </span>
              )}
              {diffText && <span className="bs-why">{diffText}</span>}
              {totalIncome > 0 && (
                <span className="bs-income">
                  Inntekt {kr(totalIncome)} · {kr(totalIncome - totalSpent)} igjen å bruke
                </span>
              )}
              {isCurrentMonth && projected > 0 && paceBasis > 0 && today.getDate() >= 3 && (
                <span className={'bs-pace ' + (paceDiff >= 0 ? 'good' : 'bad')}>
                  {paceDiff >= 0
                    ? `Holder tempoet ender du ${kr(paceDiff)} under ${totalBudget > 0 ? 'budsjett' : 'inntekt'}`
                    : `Holder tempoet ender du ${kr(Math.abs(paceDiff))} over ${totalBudget > 0 ? 'budsjett' : 'inntekt'}`}
                </span>
              )}
            </div>

            {isCurrentMonth && (upcomingMonthly.length > 0 || reserve > 0) && (
              <div className="card upcoming-card">
                <div className="uc-head">
                  <span className="trend-lbl">Kommende trekk</span>
                  {remainingCharges > 0 && <span className="uc-sum">{kr(remainingCharges)} igjen i mnd</span>}
                </div>
                {upcomingMonthly.map((u) => (
                  <div key={u.id} className="uc-row">
                    <span className={'uc-days' + (u.days <= 3 ? ' soon' : '')}>
                      {u.days === 0 ? 'i dag' : u.days === 1 ? 'i morgen' : `om ${u.days} d`}
                    </span>
                    <span className="uc-name">{u.name}</span>
                    <span className="uc-amt">{kr(u.amount)}<span className="uc-year">{kr(u.amount * 12)}/år</span></span>
                  </div>
                ))}
                {reserve > 0 && (
                  <div className="uc-reserve"><Lightbulb /> Sett av {kr(reserve)}/mnd til årlige regninger</div>
                )}
              </div>
            )}

            <CategoryDonut rows={catRows} total={totalSpent} />

            <MonthTrend
              expenses={expenses}
              subTotal={subTotal}
              cursor={cursor}
              onPick={(y, m) => setCursor({ y, m })}
            />

            {catRows.length === 0 ? (
              <div className="empty">
                <div className="glyph"><PieChartIcon /></div>
                <p className="em-ttl">Ingen tall enda</p>
                <p>Logg forbruk under «Forbruk», eller sett et budsjett her — så ser du oversikten.</p>
              </div>
            ) : (
              <div className="budget-cats">
                {catRows.map((c) => {
                  const ratio = c.budget > 0 ? c.spent / c.budget : 0
                  return (
                    <button key={c.k} type="button" className="budget-cat" onClick={() => setSheet({ type: 'catDetail', cat: c.k })}>
                      <span className="bc-emoji">{c.emoji}</span>
                      <div className="bc-main">
                        <div className="bc-top">
                          <span className="bc-name">{c.label}</span>
                          <div className="bc-amt-wrap">
                            <span className="bc-amt">
                              {kr(c.spent)}{c.budget > 0 && <span className="bc-of"> / {kr(c.budget)}</span>}
                            </span>
                            <ChangeBadge cur={c.spent} prev={c.prevSpent} />
                          </div>
                        </div>
                        <div className="bc-bar">
                          <i style={{ width: (c.budget > 0 ? Math.min(100, ratio * 100) : 0) + '%', background: barColor(ratio) }} />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {budgetSuggestion.monthsCounted >= 2 && totalBudget === 0 && (
              <button type="button" className="budget-suggest" onClick={applySuggestedBudgets}>
                <Wand2 /> Foreslå budsjett fra de siste {budgetSuggestion.monthsCounted} månedene
                <span>Du har brukt {kr(Math.round(budgetSuggestion.perMonth))} i snitt per måned</span>
              </button>
            )}

            <button type="button" className="budget-add" onClick={() => setSheet({ type: 'budget' })}>
              + Sett / endre budsjett
            </button>

            <div className="income-card">
              <span className="income-lbl">Månedsinntekt</span>
              {incomes.map((i) => (
                <div key={i.id} className="income-row">
                  <span className="income-name">{i.name}</span>
                  <button
                    type="button"
                    className="income-amt"
                    onClick={() => ask({
                      title: `Inntekt · ${i.name}`,
                      label: 'Kroner per måned',
                      initial: i.amount,
                      suffix: 'kr',
                      onSave: (v) => { const n = Number(v); if (!Number.isNaN(n)) updateIncome(i.id, { amount: n }) },
                    })}
                  >{kr(i.amount)}</button>
                  <button type="button" className="income-del" aria-label="Slett" onClick={() => deleteIncome(i.id)}>×</button>
                </div>
              ))}
              <div className="income-add">
                <input
                  type="text"
                  placeholder="Lønn, stipend…"
                  value={incName}
                  onChange={(e) => setIncName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && incName.trim() && (addIncome({ name: incName, amount: incAmount }), setIncName(''), setIncAmount(''))}
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="kr"
                  className="income-amt-in"
                  value={incAmount}
                  onChange={(e) => setIncAmount(e.target.value)}
                />
                <button
                  type="button"
                  disabled={!incName.trim()}
                  onClick={() => { addIncome({ name: incName, amount: incAmount }); setIncName(''); setIncAmount('') }}
                  aria-label="Legg til inntekt"
                >+</button>
              </div>
            </div>
          </>
        )}

        {/* ===== SPARING ===== */}
        {tab === 'sparing' && (
          <>
            {goals.length === 0 ? (
              <div className="empty">
                <div className="glyph"><Target /></div>
                <p className="em-ttl">Ingen sparemål enda</p>
                <p>Lag et mål nederst — ferie, ny telefon, buffer — og legg til etter hvert som du sparer.</p>
              </div>
            ) : (
              <div className="goals">
                {goals.map((g) => {
                  const pct = g.target > 0 ? Math.min(100, Math.round((g.saved / g.target) * 100)) : 0
                  const reached = g.target > 0 && g.saved >= g.target
                  return (
                    <div key={g.id} className={'goal' + (reached ? ' reached' : '')}>
                      <div className="goal-top">
                        <span className="goal-name">{g.name}</span>
                        <button type="button" className="goal-del" aria-label="Slett" onClick={async () => { const rec = await deleteWithRestore('goals', g.id); toast.message(`Slettet «${g.name}»`, { action: { label: 'Angre', onClick: () => restoreRecord('goals', rec) } }) }}>×</button>
                      </div>
                      <div className="goal-bar"><i style={{ width: pct + '%' }} /></div>
                      <div className="goal-foot">
                        <button
                          type="button"
                          className="goal-amt"
                          onClick={() => ask({
                            title: `Mål · ${g.name}`,
                            label: 'Hvor mye vil du spare?',
                            initial: g.target,
                            suffix: 'kr',
                            onSave: (v) => { const n = Number(v); if (!Number.isNaN(n)) updateGoal(g.id, { target: n }) },
                          })}
                        >{kr(g.saved)} av {kr(g.target)} · {pct}%</button>
                        <div className="goal-acts">
                          <button type="button" onClick={() => ask({
                            title: `Spar · ${g.name}`,
                            label: 'Legg til spart beløp',
                            initial: '',
                            placeholder: '500',
                            suffix: 'kr',
                            onSave: (v) => { const n = Number(v); if (n) { addToGoal(g.id, n); vibrate(8) } },
                          })}>+ Spar</button>
                          <button type="button" onClick={() => ask({
                            title: `Trekk fra · ${g.name}`,
                            label: 'Trekk fra spart beløp',
                            initial: '',
                            placeholder: '500',
                            suffix: 'kr',
                            onSave: (v) => { const n = Number(v); if (n) addToGoal(g.id, -n) },
                          })}>−</button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ===== FORBRUK ===== */}
        {tab === 'forbruk' && (
          <>
            {/* samme månedsvelger som Oversikt — uten den er importert historikk usynlig */}
            <div className="month-nav">
              <button type="button" className="cal-arrow" aria-label="Forrige måned" onClick={() => shiftMonth(-1)}>
                <ChevronLeft />
              </button>
              <span className="month-nav-lbl">{monthLabel}</span>
              <button type="button" className="cal-arrow" aria-label="Neste måned" disabled={isCurrentMonth} onClick={() => shiftMonth(1)}>
                <ChevronRight />
              </button>
            </div>

            <div className="budget-summary slim">
              <span className="bs-label">logget i {MONTHS[cursor.m]}</span>
              <AnimatedNumber className="bs-amount" value={expTotal} format={kr} />
              <span className="bs-sub">{monthExpenses.length} kjøp</span>
            </div>

            <div className="exp-tools">
              <button type="button" className="budget-add" onClick={() => setSheet({ type: 'bankImport' })}>
                <Landmark /> Importer fra banken
              </button>
              <button type="button" className="budget-add" onClick={() => setSheet({ type: 'monthlyTotals' })}>
                <BarChart3 /> Fyll inn hele måneden
              </button>
            </div>

            {monthExpenses.length === 0 ? (
              <div className="empty">
                <div className="glyph"><Receipt /></div>
                <p className="em-ttl">Ingen forbruk logget</p>
                <p>Importer kontoutskriften fra banken over — eller logg kjøp med knappen nederst.</p>
              </div>
            ) : (
              <div className="exp-list">
                {(() => {
                  // gruppér per dag (lista er allerede sortert dato synkende)
                  const days = []
                  for (const e of monthExpenses) {
                    const last = days[days.length - 1]
                    if (last && last.date === e.date) { last.items.push(e); last.total += e.amount || 0 }
                    else days.push({ date: e.date, items: [e], total: e.amount || 0 })
                  }
                  const todayIso = todayKey()
                  return days.map((d) => (
                    <div key={d.date} className="exp-day">
                      <div className="exp-day-head">
                        <span className="exp-day-lbl">{dayLabel(d.date, todayIso)}</span>
                        <span className="exp-day-sum">{kr(Math.round(d.total))}</span>
                      </div>
                      {d.items.map((e) => {
                        const c = catMeta(e.category)
                        return (
                          <button key={e.id} type="button" className="exp-row" onClick={() => setSheet({ type: 'expense', expense: e })}>
                            <span className="exp-emoji" style={{ background: c.color + '22' }}>{c.emoji}</span>
                            <div className="exp-main">
                              <span className="exp-title">{e.note || c.label}</span>
                              <span className="exp-meta">{subLabel(e.category, e.sub) || c.label}</span>
                            </div>
                            <span className="exp-amt">{kr(e.amount)}</span>
                          </button>
                        )
                      })}
                    </div>
                  ))
                })()}
              </div>
            )}
          </>
        )}

        {/* ===== PLAN (sparemodus / reise uten lønn) ===== */}
        {tab === 'plan' && <MoneyPlan plans={plans} expenses={expenses} />}

        {/* ===== FASTE (abonnement) ===== */}
        {tab === 'faste' && (
          <>
            <div className="budget-summary slim">
              <span className="bs-label">faste utgifter per måned</span>
              <AnimatedNumber className="bs-amount" value={Math.round(subsMonthly)} format={kr} />
              <span className="bs-sub">{subs.length} abonnement · {kr(Math.round(subsMonthly * 12))} per år</span>
            </div>

            {upcoming.length > 0 && (
              <div className="upcoming">
                <span className="upcoming-lbl">Kommende</span>
                {upcoming.map((u) => (
                  <div key={u.id} className="upcoming-row">
                    <span className="upcoming-days">{u.days === 0 ? 'i dag' : u.days === 1 ? 'i morgen' : `om ${u.days} d`}</span>
                    <span className="upcoming-name">{u.name}</span>
                    <span className="upcoming-amt">{kr(u.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {recurringFound.length > 0 && (
              <div className="found card">
                <span className="found-lbl">Funnet i bankhistorikken</span>
                <p className="found-note">
                  Disse trekkes jevnlig, men står ikke som faste utgifter ennå. Legger du dem inn,
                  kjenner appen dem igjen i kjøpene — så de ikke telles to ganger.
                </p>
                {recurringFound.slice(0, 6).map((r) => (
                  <div key={r.name} className="found-row">
                    <div className="found-main">
                      <span className="found-name">{r.name}</span>
                      <span className="found-meta">
                        {kr(r.amount)} · rundt den {r.day}. · {r.months} måneder på rad
                      </span>
                    </div>
                    <button
                      type="button"
                      className="found-add"
                      onClick={async () => {
                        await addSubscription({
                          name: r.name, amount: r.amount, cycle: 'monthly',
                          category: r.category, renewDay: r.day,
                        })
                        vibrate(12)
                        toast.success(`${r.name} lagt inn som fast utgift`)
                      }}
                    >Legg inn</button>
                  </div>
                ))}
              </div>
            )}

            {subs.length === 0 && recurringFound.length === 0 ? (
              <div className="empty">
                <div className="glyph"><CreditCard /></div>
                <p className="em-ttl">Ingen abonnement enda</p>
                <p>Legg inn faste utgifter nederst — Spotify, Netflix, treningssenter.</p>
              </div>
            ) : (
              subs.map((s) => <SubCard key={s.id} sub={s} onAsk={ask} />)
            )}
          </>
        )}
      </div>

      {/* ===== bunn-bar per fane ===== */}
      {tab === 'forbruk' && (
        <div className="screen-bar">
          <button type="button" className="money-fab" aria-label="Legg til forbruk" onClick={() => setSheet({ type: 'expense' })}>
            <Plus />
            Legg til forbruk
          </button>
        </div>
      )}
      {tab === 'faste' && (
        <div className="screen-bar">
          <div className="field">
            <input
              type="text"
              placeholder="Hva betaler du for…"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="kr"
              className="amount-in"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addSub()}
            />
            <button type="button" className="field-btn" aria-label="Legg til abonnement" disabled={name.trim() === ''} onClick={addSub}>
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>
      )}
      {tab === 'sparing' && (
        <div className="screen-bar">
          <div className="field">
            <input
              type="text"
              placeholder="Nytt sparemål…"
              value={goalName}
              onChange={(e) => setGoalName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGoalNow()}
            />
            <input
              type="number"
              inputMode="numeric"
              placeholder="mål kr"
              className="amount-in"
              value={goalTarget}
              onChange={(e) => setGoalTarget(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addGoalNow()}
            />
            <button type="button" className="field-btn" aria-label="Legg til sparemål" disabled={goalName.trim() === ''} onClick={addGoalNow}>
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
            </button>
          </div>
        </div>
      )}

      {sheet?.type === 'expense' && <ExpenseSheet initial={sheet.expense} onClose={() => setSheet(null)} />}
      {sheet?.type === 'budget' && <BudgetSheet initialCat={sheet.cat} budgetByCat={budgetByCat} onClose={() => setSheet(null)} />}
      {sheet?.type === 'monthlyTotals' && (
        <MonthlyTotalsSheet y={cursor.y} m={cursor.m} onClose={() => setSheet(null)} />
      )}
      {sheet?.type === 'bankImport' && <MoneyImportSheet onClose={() => setSheet(null)} />}
      {sheet?.type === 'catDetail' && (
        <CategorySheet
          cat={sheet.cat}
          expenses={monthExpenses}
          monthLabel={monthLabel}
          budget={budgetByCat[sheet.cat] || 0}
          prevSpent={prevSpentByCat[sheet.cat] || 0}
          onEdit={(e) => setSheet({ type: 'expense', expense: e })}
          onSetBudget={() => setSheet({ type: 'budget', cat: sheet.cat })}
          onClose={() => setSheet(null)}
        />
      )}
      {askSheet}
    </div>
  )
}
