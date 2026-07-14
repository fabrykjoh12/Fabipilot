import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db, todayKey, listWorkdays, toggleMyWorkday,
  listSharedMembers, inviteToShared,
} from '../db.js'
import { vibrate } from '../lib/fx.js'
import './Workdays.css'

const WEEKDAYS = ['man', 'tir', 'ons', 'tor', 'fre', 'lør', 'søn']

function monthTitle(y, m) {
  return new Intl.DateTimeFormat('nb-NO', { month: 'long', year: 'numeric' }).format(new Date(y, m, 1))
}

/* «Jobb» — delt arbeidsplan. Trykk på dagene DU jobber; kjæresten ser dem,
   og du ser hennes. Samme delte realm som «Delt»/«Handleliste». */
export default function Workdays() {
  const today = todayKey()
  const [ty, tm] = [Number(today.slice(0, 4)), Number(today.slice(5, 7)) - 1]
  const [cursor, setCursor] = useState({ y: ty, m: tm })
  const [email, setEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [showInvite, setShowInvite] = useState(false)

  const workdays = useLiveQuery(() => listWorkdays(), [], [])
  const members = useLiveQuery(() => listSharedMembers().catch(() => []), [], [])
  const myId = db.cloud.currentUserId

  // date → { me, partner }
  const byDate = useMemo(() => {
    const map = {}
    for (const w of workdays) {
      const e = (map[w.date] ||= { me: false, partner: false })
      if (w.owner === myId) e.me = true
      else e.partner = true
    }
    return map
  }, [workdays, myId])

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startOffset = (first.getDay() + 6) % 7
    const start = new Date(cursor.y, cursor.m, 1 - startOffset)
    return [...Array(42)].map((_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      return { key: todayKey(d), day: d.getDate(), out: d.getMonth() !== cursor.m }
    })
  }, [cursor])

  const monthCount = useMemo(() => {
    const prefix = `${cursor.y}-${String(cursor.m + 1).padStart(2, '0')}`
    let me = 0, partner = 0
    for (const [date, v] of Object.entries(byDate)) {
      if (!date.startsWith(prefix)) continue
      if (v.me) me++
      if (v.partner) partner++
    }
    return { me, partner }
  }, [byDate, cursor])

  function shiftMonth(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }
  function goToday() {
    setCursor({ y: ty, m: tm })
    vibrate(6)
  }
  async function toggle(key) {
    const on = await toggleMyWorkday(key)
    vibrate(on ? 10 : 6)
  }

  async function invite() {
    const e = email.trim()
    if (!e) return
    try {
      await inviteToShared(e)
      setInviteMsg(`Invitasjon sendt til ${e.toLowerCase()} ✓`)
      setEmail('')
    } catch (err) {
      setInviteMsg('Kunne ikke invitere: ' + (err?.message || err))
    }
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="scr-top">
          <div>
            <h1 className="scr-title">Jobb</h1>
            <p className="scr-sub">
              {members.length > 1
                ? 'Trykk på dagene du jobber — kjæresten ser dem, og du ser hennes.'
                : 'Trykk på dagene du jobber. Del med kjæresten for å se hverandres dager.'}
            </p>
          </div>
          <button type="button" className="ov-edit-btn" onClick={() => setShowInvite((s) => !s)}>
            {showInvite ? 'Lukk' : 'Del'}
          </button>
        </div>

        {showInvite && (
          <div className="share-panel card">
            <span className="share-lbl">Inviter kjæresten på e-post</span>
            <div className="share-invite">
              <input
                type="email"
                placeholder="kjæreste@epost.no"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && invite()}
              />
              <button type="button" disabled={!email.trim()} onClick={invite}>Send</button>
            </div>
            {inviteMsg && <p className="share-msg">{inviteMsg}</p>}
            <p className="share-hint">
              Begge må være innlogget med hver sin e-post. «Jobb», «Delt liste» og «Handleliste» deles
              med de samme personene — én invitasjon holder.
            </p>
          </div>
        )}

        <div className="wd-cal">
          <div className="wd-head">
            <button type="button" className="wd-nav" aria-label="Forrige måned" onClick={() => shiftMonth(-1)}>‹</button>
            <button type="button" className="wd-month" onClick={goToday}>{monthTitle(cursor.y, cursor.m)}</button>
            <button type="button" className="wd-nav" aria-label="Neste måned" onClick={() => shiftMonth(1)}>›</button>
          </div>

          <div className="wd-weekdays">
            {WEEKDAYS.map((w) => <span key={w} className="wd-wd">{w}</span>)}
          </div>

          <div className="wd-grid">
            {cells.map((c) => {
              const v = byDate[c.key]
              return (
                <button
                  key={c.key}
                  type="button"
                  className={
                    'wd-cell'
                    + (c.out ? ' out' : '')
                    + (c.key === today ? ' today' : '')
                    + (v?.me ? ' me' : '')
                  }
                  aria-pressed={!!v?.me}
                  aria-label={`${c.day}. ${v?.me ? '— du jobber' : ''}`}
                  onClick={() => toggle(c.key)}
                >
                  <span className="wd-day">{c.day}</span>
                  {v?.partner && <span className="wd-partner-dot" aria-hidden="true" />}
                </button>
              )
            })}
          </div>
        </div>

        <div className="wd-legend">
          <span className="wd-leg"><span className="wd-swatch me" /> Du jobber · {monthCount.me}</span>
          <span className="wd-leg"><span className="wd-swatch partner" /> Kjæresten · {monthCount.partner}</span>
        </div>
      </div>
    </div>
  )
}
