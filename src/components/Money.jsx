import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react'
import {
  listSubscriptions, addSubscription, updateSubscription, monthlyCost,
  listExpenses, addExpense, updateExpense, deleteExpense, listBudgets, setBudget, todayKey,
  getMonthlyTotals, setMonthlyTotal,
  listIncomes, addIncome, updateIncome, deleteIncome,
  listGoals, addGoal, updateGoal, addToGoal,
  deleteWithRestore, restoreRecord,
} from '../db.js'
import { kr, vibrate, burst, reduceMotion } from '../lib/fx.js'
import { AnimatedNumber, toast, useEscape } from '../lib/ui.jsx'
import { SWATCH } from '../lib/palette.js'
import './Money.css'

const CATEGORIES = [
  { k: 'mat', label: 'Mat', emoji: '🍔', color: SWATCH.amber },
  { k: 'transport', label: 'Transport', emoji: '🚗', color: SWATCH.blue },
  { k: 'bolig', label: 'Bolig', emoji: '🏠', color: SWATCH.forest },
  { k: 'helse', label: 'Helse', emoji: '💊', color: SWATCH.rose },
  { k: 'klar', label: 'Klær', emoji: '👕', color: SWATCH.plum },
  { k: 'moro', label: 'Moro', emoji: '🎉', color: SWATCH.coral },
  { k: 'strømming', label: 'Strømming', emoji: '📺', color: SWATCH.teal },
  { k: 'musikk', label: 'Musikk', emoji: '🎵', color: SWATCH.moss },
  { k: 'software', label: 'Software', emoji: '💻', color: SWATCH.violet },
  { k: 'annet', label: 'Annet', emoji: '📦', color: SWATCH.slate },
]
const catMeta = (k) => CATEGORIES.find((c) => c.k === k) || CATEGORIES[CATEGORIES.length - 1]
const catKey = (k) => (CATEGORIES.some((c) => c.k === k) ? k : 'annet')

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
const pad = (n) => String(n).padStart(2, '0')

function barColor(ratio) {
  if (ratio > 1) return 'var(--danger)'
  if (ratio >= 0.8) return SWATCH.amber
  return 'var(--forest)'
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
  const months = lastNMonths(6, cursor.y, cursor.m)
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
      <span className="trend-lbl">Forbruk siste 6 måneder</span>
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

const TABS = [
  { k: 'oversikt', label: 'Oversikt' },
  { k: 'forbruk', label: 'Forbruk' },
  { k: 'faste', label: 'Faste' },
  { k: 'sparing', label: 'Sparing' },
]

/* ============ bunn-sheet: legg til / rediger forbruk ============ */
function ExpenseSheet({ initial, onClose }) {
  useEscape(onClose)
  const editing = !!initial
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '')
  const [category, setCategory] = useState(initial?.category || 'mat')
  const [note, setNote] = useState(initial?.note || '')
  const [date, setDate] = useState(initial?.date || todayKey())
  const saveRef = useRef(null)

  async function save() {
    const amt = Number(amount)
    if (!amt) return
    if (editing) await updateExpense(initial.id, { amount: amt, category, note: note.trim(), date })
    else await addExpense({ amount: amt, category, note: note.trim(), date })
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
              onClick={() => setCategory(c.k)}
            >
              <span className="msheet-cat-emoji">{c.emoji}</span>
              {c.label}
            </button>
          ))}
        </div>

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
  const [category, setCategory] = useState(initialCat || 'mat')
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
function MonthlyTotalsSheet({ monthPrefix, monthLabel, onClose }) {
  useEscape(onClose)
  const [vals, setVals] = useState({})
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let cancelled = false
    getMonthlyTotals(monthPrefix).then((totals) => {
      if (cancelled) return
      const init = {}
      for (const c of CATEGORIES) init[c.k] = totals[c.k] ? String(totals[c.k]) : ''
      setVals(init)
      setLoaded(true)
    })
    return () => { cancelled = true }
  }, [monthPrefix])

  const total = Object.values(vals).reduce((s, v) => s + (Number(v) || 0), 0)

  async function save() {
    for (const c of CATEGORIES) await setMonthlyTotal(monthPrefix, c.k, vals[c.k])
    vibrate([12, 30, 12])
    onClose()
  }

  return (
    <div className="msheet-overlay" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="msheet-grip" />
        <h2 className="msheet-title">Fyll inn {monthLabel.toLowerCase()}</h2>
        <p className="msheet-hint">
          Skriv inn totalt du brukte i hver kategori denne måneden — raskere enn å logge hvert kjøp.
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

        <button type="button" className="msheet-save" onClick={save}>Lagre</button>
      </div>
    </div>
  )
}

/* ============ abonnementskort (Faste) ============ */
function SubCard({ sub, onAsk }) {
  const perMonth = monthlyCost(sub)
  const cat = catMeta(catKey(sub.category || 'annet'))
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
    const i = keys.indexOf(catKey(sub.category || 'annet'))
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
/* Gjenbrukbart tall-/tekst-ark — erstatter window.prompt. */
function AmountSheet({ cfg, onClose }) {
  useEscape(onClose)
  const [val, setVal] = useState(cfg.initial == null || cfg.initial === '' ? '' : String(cfg.initial))
  const ref = useRef(null)
  useEffect(() => {
    const id = setTimeout(() => { ref.current?.focus(); ref.current?.select?.() }, 60)
    return () => clearTimeout(id)
  }, [])
  function save() {
    cfg.onSave(val)
    onClose()
  }
  return (
    <div className="msheet-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()}>
        <div className="msheet-grip" />
        <h3 className="msheet-title">{cfg.title}</h3>
        <div className="msheet-amount">
          <input
            ref={ref}
            className="msheet-amount-in"
            inputMode={cfg.inputMode || 'numeric'}
            placeholder={cfg.placeholder ?? '0'}
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
          />
          {cfg.suffix && <span className="msheet-kr">{cfg.suffix}</span>}
        </div>
        {cfg.label && <span className="msheet-lbl">{cfg.label}</span>}
        <button type="button" className="msheet-save" onClick={save}>Lagre</button>
      </div>
    </div>
  )
}

export default function Money() {
  const subs = useLiveQuery(() => listSubscriptions(), [], [])
  const expenses = useLiveQuery(() => listExpenses(), [], [])
  const budgets = useLiveQuery(() => listBudgets(), [], [])
  const incomes = useLiveQuery(() => listIncomes(), [], [])
  const goals = useLiveQuery(() => listGoals(), [], [])

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
  const [askCfg, setAskCfg] = useState(null)
  const [askKey, setAskKey] = useState(0)
  const ask = (cfg) => { setAskKey((k) => k + 1); setAskCfg(cfg) }

  const totalIncome = incomes.reduce((s, i) => s + (i.amount || 0), 0)

  const monthPrefix = `${cursor.y}-${pad(cursor.m + 1)}`
  const monthExpenses = expenses.filter((e) => (e.date || '').startsWith(monthPrefix))
  const subTotal = subs.reduce((s, x) => s + monthlyCost(x), 0)
  const expTotal = monthExpenses.reduce((s, x) => s + (x.amount || 0), 0)
  const totalSpent = subTotal + expTotal
  const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0)

  const budgetByCat = {}
  for (const b of budgets) budgetByCat[b.category] = b.amount

  const spentByCat = {}
  for (const e of monthExpenses) spentByCat[e.category] = (spentByCat[e.category] || 0) + (e.amount || 0)
  for (const s of subs) {
    const k = catKey(s.category || 'annet')
    spentByCat[k] = (spentByCat[k] || 0) + monthlyCost(s)
  }

  const catRows = CATEGORIES
    .map((c) => ({ ...c, spent: spentByCat[c.k] || 0, budget: budgetByCat[c.k] || 0 }))
    .filter((c) => c.spent > 0 || c.budget > 0)
    .sort((a, b) => b.spent - a.spent)

  const upcoming = subs
    .filter((s) => s.renewDay)
    .map((s) => ({ id: s.id, name: s.name, amount: s.amount, days: daysUntilDay(s.renewDay) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 4)

  const isCurrentMonth = monthPrefix === todayKey().slice(0, 7)
  const monthLabel = `${MONTHS[cursor.m].charAt(0).toUpperCase() + MONTHS[cursor.m].slice(1)} ${cursor.y}`

  function shiftMonth(d) {
    const dt = new Date(cursor.y, cursor.m + d, 1)
    setCursor({ y: dt.getFullYear(), m: dt.getMonth() })
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
              {totalIncome > 0 && (
                <span className="bs-income">
                  Inntekt {kr(totalIncome)} · {kr(totalIncome - totalSpent)} igjen å bruke
                </span>
              )}
            </div>

            <CategoryDonut rows={catRows} total={totalSpent} />

            <MonthTrend
              expenses={expenses}
              subTotal={subTotal}
              cursor={cursor}
              onPick={(y, m) => setCursor({ y, m })}
            />

            {catRows.length === 0 ? (
              <div className="empty">
                <div className="glyph">📊</div>
                <p className="em-ttl">Ingen tall enda</p>
                <p>Logg forbruk under «Forbruk», eller sett et budsjett her — så ser du oversikten.</p>
              </div>
            ) : (
              <div className="budget-cats">
                {catRows.map((c) => {
                  const ratio = c.budget > 0 ? c.spent / c.budget : 0
                  return (
                    <button key={c.k} type="button" className="budget-cat" onClick={() => setSheet({ type: 'budget', cat: c.k })}>
                      <span className="bc-emoji">{c.emoji}</span>
                      <div className="bc-main">
                        <div className="bc-top">
                          <span className="bc-name">{c.label}</span>
                          <span className="bc-amt">
                            {kr(c.spent)}{c.budget > 0 && <span className="bc-of"> / {kr(c.budget)}</span>}
                          </span>
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
                <div className="glyph">🎯</div>
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
            <div className="budget-summary slim">
              <span className="bs-label">logget denne måneden</span>
              <AnimatedNumber className="bs-amount" value={expTotal} format={kr} />
              <span className="bs-sub">{monthExpenses.length} kjøp</span>
            </div>

            <button type="button" className="budget-add" onClick={() => setSheet({ type: 'monthlyTotals' })}>
              📊 Fyll inn hele måneden
            </button>

            {monthExpenses.length === 0 ? (
              <div className="empty">
                <div className="glyph">🧾</div>
                <p className="em-ttl">Ingen forbruk logget</p>
                <p>Trykk knappen nederst hver gang du bruker penger — så ser du hvor de tar veien.</p>
              </div>
            ) : (
              <div className="exp-list">
                {monthExpenses.map((e) => {
                  const c = catMeta(e.category)
                  return (
                    <button key={e.id} type="button" className="exp-row" onClick={() => setSheet({ type: 'expense', expense: e })}>
                      <span className="exp-emoji" style={{ background: c.color + '22' }}>{c.emoji}</span>
                      <div className="exp-main">
                        <span className="exp-title">{e.note || c.label}</span>
                        <span className="exp-meta">{c.label} · {e.date.slice(8)}.{e.date.slice(5, 7)}</span>
                      </div>
                      <span className="exp-amt">{kr(e.amount)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </>
        )}

        {/* ===== FASTE (abonnement) ===== */}
        {tab === 'faste' && (
          <>
            <div className="budget-summary slim">
              <span className="bs-label">faste utgifter per måned</span>
              <AnimatedNumber className="bs-amount" value={subTotal} format={kr} />
              <span className="bs-sub">{subs.length} abonnement · {kr(subTotal * 12)} per år</span>
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

            {subs.length === 0 ? (
              <div className="empty">
                <div className="glyph">💳</div>
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
          <button type="button" className="money-fab" onClick={() => setSheet({ type: 'expense' })}>
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
        <MonthlyTotalsSheet monthPrefix={monthPrefix} monthLabel={monthLabel} onClose={() => setSheet(null)} />
      )}
      {askCfg && <AmountSheet key={askKey} cfg={askCfg} onClose={() => setAskCfg(null)} />}
    </div>
  )
}
