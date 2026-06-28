import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listSubscriptions,
  addSubscription,
  updateSubscription,
  deleteSubscription,
  monthlyCost,
} from '../db.js'
import { kr, vibrate } from '../lib/fx.js'

function SubCard({ sub }) {
  const perMonth = monthlyCost(sub)
  return (
    <div className="card sub">
      <div className="sub-main">
        <div className="sub-name">{sub.name}</div>
        <button
          type="button"
          className="sub-cycle"
          onClick={() =>
            updateSubscription(sub.id, { cycle: sub.cycle === 'yearly' ? 'monthly' : 'yearly' })
          }
        >
          {sub.cycle === 'yearly' ? 'per år' : 'per måned'}
        </button>
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
