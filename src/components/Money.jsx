import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  monthlyCost,
} from '../db.js'
import { kr, vibrate } from '../lib/fx.js'

const CATS = [
  { k: 'annet',     label: 'Annet',      color: '#9aa394' },
  { k: 'strømming', label: 'Strømming',  color: '#6b8cba' },
  { k: 'musikk',    label: 'Musikk',     color: '#7ba07c' },
  { k: 'software',  label: 'Software',   color: '#a07b9c' },
  { k: 'helse',     label: 'Helse',      color: '#ba8c6b' },
  { k: 'mat',       label: 'Mat',        color: '#b09a4a' },
  { k: 'transport', label: 'Transport',  color: '#6b9aba' },
]
const catMeta = (k) => CATS.find((c) => c.k === k) || CATS[0]
const nextCat = (k) => { const i = CATS.findIndex((c) => c.k === k); return CATS[(i + 1) % CATS.length].k }

function SubCard({ sub }) {
  const perMonth = monthlyCost(sub)
  const cat = catMeta(sub.category || 'annet')
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
            onClick={() =>
              updateSubscription(sub.id, { cycle: sub.cycle === 'yearly' ? 'monthly' : 'yearly' })
            }
          >
            {sub.cycle === 'yearly' ? 'per år' : 'per måned'}
          </button>
          <button
            type="button"
            className="sub-cat"
            style={{ color: cat.color, borderColor: cat.color + '55', background: cat.color + '18' }}
            onClick={() => updateSubscription(sub.id, { category: nextCat(sub.category || 'annet') })}
            title="Trykk for å endre kategori"
          >
            {cat.label}
          </button>
        </div>
      </div>
      <div className="sub-right">
        <button
          type="button"
          className="sub-amount"
          aria-label="Endre beløp"
          onClick={() => {
            const v = window.prompt(
              `Beløp for «${sub.name}» (kr ${sub.cycle === 'yearly' ? 'per år' : 'per måned'}):`,
              sub.amount,
            )
            if (v !== null && !Number.isNaN(Number(v))) updateSubscription(sub.id, { amount: Number(v) })
          }}
        >
          {kr(sub.amount)}
          {sub.cycle === 'yearly' && <span className="sub-sub">≈ {kr(perMonth)}/mnd</span>}
        </button>
        <button
          type="button"
          className="icon-x"
          aria-label="Slett"
          onClick={() => {
            if (window.confirm(`Slette «${sub.name}»?`)) deleteSubscription(sub.id)
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default function Money() {
  const subs = useLiveQuery(() => listSubscriptions(), [], [])
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')

  const totalMonth = subs.reduce((sum, s) => sum + monthlyCost(s), 0)

  const byCategory = CATS.map((c) => {
    const items = subs.filter((s) => (s.category || 'annet') === c.k)
    const total = items.reduce((sum, s) => sum + monthlyCost(s), 0)
    return { ...c, total, count: items.length }
  }).filter((c) => c.count > 0).sort((a, b) => b.total - a.total)

  async function add() {
    const n = name.trim()
    if (!n) return
    await addSubscription({ name: n, amount: Number(amount) || 0, cycle: 'monthly' })
    setName('')
    setAmount('')
    vibrate(8)
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Penger</h1>
        <p className="scr-sub">Faste utgifter, samlet.</p>

        <div className="total-card">
          <span className="total-label">samlet per måned</span>
          <span className="total-amount">{kr(totalMonth)}</span>
          <span className="total-sub">
            {subs.length} abonnement · {kr(totalMonth * 12)} per år
          </span>
          {byCategory.length > 1 && (
            <div className="cat-breakdown">
              {byCategory.map((c) => (
                <div key={c.k} className="cat-row">
                  <span className="cat-bar-wrap">
                    <span
                      className="cat-bar"
                      style={{ width: totalMonth ? (c.total / totalMonth * 100) + '%' : '0%', background: c.color }}
                    />
                  </span>
                  <span className="cat-name" style={{ color: c.color }}>{c.label}</span>
                  <span className="cat-amt">{kr(c.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 8 }}>
          {subs.length === 0 ? (
            <div className="empty">
              <div className="glyph">💳</div>
              <p className="em-ttl">Ingen abonnement enda</p>
              <p>Legg inn de faste utgiftene dine nederst — Spotify, Netflix, treningssenter — så ser du totalen.</p>
            </div>
          ) : (
            subs.map((s) => <SubCard key={s.id} sub={s} />)
          )}
        </div>
      </div>

      <div className="screen-bar">
        <div className="field">
          <input
            type="text"
            placeholder="Hva betaler du for…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <input
            type="number"
            inputMode="numeric"
            placeholder="kr"
            className="amount-in"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button
            type="button"
            className="field-btn"
            aria-label="Legg til abonnement"
            disabled={name.trim() === ''}
            onClick={add}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
