import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayKey, addTask } from '../db.js'
import { burst, vibrate } from '../lib/fx.js'
import { ScreenSkeleton } from '../lib/ui.jsx'

const TYPE_META = {
  task:    { label: 'Oppgave',  color: 'var(--accent)',  icon: '✓' },
  project: { label: 'Prosjekt', color: 'var(--forest)', icon: '→' },
  habit:   { label: 'Vane',     color: '#7ba07c',        icon: '↻' },
}

const ENERGY_OPTS = [
  { k: 'alle', label: 'Alle' },
  { k: 'lav',  label: 'Lav energi' },
  { k: 'hoy',  label: 'Høy energi' },
]

const TIME_OPTS = [
  { k: 0, label: 'Når som helst' },
  { k: 5, label: '5 min' },
  { k: 15, label: '15 min' },
  { k: 30, label: '30 min' },
]
const POMO_OPTS = [15, 25, 45]
const fmtClock = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`

export default function WhatNow() {
  const today = todayKey()
  const [idx, setIdx] = useState(0)
  const [energy, setEnergy] = useState('alle')
  const [time, setTime] = useState(0)
  const [addVal, setAddVal] = useState('')

  // pomodoro
  const [pomoDur, setPomoDur] = useState(25)
  const [secs, setSecs] = useState(25 * 60)
  const [running, setRunning] = useState(false)
  const pomoRef = useRef(null)
  const tickRef = useRef(null)

  useEffect(() => {
    if (!running) return
    tickRef.current = setInterval(() => {
      setSecs((s) => {
        if (s <= 1) {
          clearInterval(tickRef.current)
          setRunning(false)
          vibrate([14, 40, 14, 40, 14])
          burst(pomoRef.current)
          return 0
        }
        return s - 1
      })
    }, 1000)
    return () => clearInterval(tickRef.current)
  }, [running])

  function setPomo(min) {
    setPomoDur(min)
    setSecs(min * 60)
    setRunning(false)
  }
  function resetPomo() {
    setRunning(false)
    setSecs(pomoDur * 60)
  }

  const allItems = useLiveQuery(async () => {
    const [tasks, habits, nowItems] = await Promise.all([
      db.tasks.where('dueDate').belowOrEqual(today).filter((t) => !t.isDone).toArray(),
      db.habits.toArray(),
      db.projectItems.where('stage').equals('now').sortBy('sortOrder'),
    ])

    const suggestions = []

    for (const t of tasks) {
      suggestions.push({ id: t.id, type: 'task', text: t.title, energy: null, estimate: t.estimate || null })
    }

    for (const h of habits) {
      const history = new Set(h.history || [])
      if (!history.has(today)) {
        suggestions.push({ id: h.id, type: 'habit', text: h.name, energy: null })
      }
    }

    const seenProject = new Set()
    for (const item of nowItems) {
      if (!seenProject.has(item.projectId)) {
        seenProject.add(item.projectId)
        suggestions.push({ id: item.id, type: 'project', text: item.text, energy: item.energy || null })
      }
    }

    return suggestions
  }, [today], null)

  if (allItems === null) return <ScreenSkeleton />

  let items = energy === 'alle'
    ? allItems
    : allItems.filter((i) => i.energy === energy || (energy === 'lav' && i.type !== 'project'))
  if (time > 0) {
    items = items.filter((i) => i.type === 'task' && i.estimate && i.estimate <= time)
  }

  const safeIdx = items.length > 0 ? idx % items.length : 0
  const current = items.length > 0 ? items[safeIdx] : null
  const meta = current ? TYPE_META[current.type] : null

  function next() {
    vibrate(8)
    setIdx((i) => (i + 1) % Math.max(items.length, 1))
  }

  function changeEnergy(k) {
    setEnergy(k)
    setIdx(0)
  }
  function changeTime(k) {
    setTime(k)
    setIdx(0)
  }

  async function quickAdd() {
    const v = addVal.trim()
    if (!v) return
    await addTask(v)
    setAddVal('')
    vibrate(8)
  }

  const hasProjectEnergy = allItems.some((i) => i.type === 'project' && i.energy)

  return (
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Hva nå?</h1>
        <p className="scr-sub">Én ting av gangen.</p>

        {hasProjectEnergy && (
          <div className="wn-energy-filter">
            {ENERGY_OPTS.map((o) => (
              <button
                key={o.k}
                type="button"
                className={'wn-ef-btn' + (energy === o.k ? ' active' : '')}
                onClick={() => changeEnergy(o.k)}
              >
                {o.label}
              </button>
            ))}
          </div>
        )}

        <p className="wn-time-lbl">Jeg har…</p>
        <div className="wn-energy-filter">
          {TIME_OPTS.map((o) => (
            <button
              key={o.k}
              type="button"
              className={'wn-ef-btn' + (time === o.k ? ' active' : '')}
              onClick={() => changeTime(o.k)}
            >
              {o.label}
            </button>
          ))}
        </div>

        <div className="wn-wrap">
          {!current ? (
            <div className="wn-empty">
              <div className="wn-glyph">✦</div>
              <p>
                {time > 0
                  ? `Ingen oppgaver som tar ${time} min eller mindre. Sett tidsestimat (⏱) på oppgaver i «I dag».`
                  : energy !== 'alle'
                  ? `Ingen forslag for «${ENERGY_OPTS.find((o) => o.k === energy)?.label}» akkurat nå.`
                  : 'Alt virker ryddig akkurat nå — ingenting haster.'}
              </p>
            </div>
          ) : (
            <>
              <div className="wn-card">
                <span className="wn-type" style={{ color: meta.color }}>
                  <span className="wn-type-icon">{meta.icon}</span>
                  {meta.label}
                  {current.estimate ? <span className="wn-est">⏱ {current.estimate} min</span> : null}
                </span>
                <p className="wn-text">{current.text}</p>
              </div>

              {items.length > 1 && (
                <button type="button" className="wn-next" onClick={next}>
                  Annet forslag
                  <svg viewBox="0 0 24 24">
                    <path d="M5 12h14M13 6l6 6-6 6" />
                  </svg>
                </button>
              )}

              <p className="wn-count">
                {safeIdx + 1} av {items.length} åpne ting
              </p>
            </>
          )}
        </div>

        <div className="wn-quickadd">
          <p className="wn-qa-label">Legg til i I dag</p>
          <div className="field">
            <input
              type="text"
              placeholder="Noe du kom på nå…"
              enterKeyHint="done"
              value={addVal}
              onChange={(e) => setAddVal(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && quickAdd()}
            />
            <button
              type="button"
              className="field-btn"
              aria-label="Legg til oppgave"
              disabled={addVal.trim() === ''}
              onClick={quickAdd}
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        <div className="wn-pomo">
          <p className="wn-qa-label">Fokus-timer</p>
          <div ref={pomoRef} className={'wn-clock' + (secs === 0 ? ' done' : '')}>
            {secs === 0 ? 'Ferdig! 🌿' : fmtClock(secs)}
          </div>
          <div className="wn-pomo-opts">
            {POMO_OPTS.map((m) => (
              <button key={m} type="button" className={'wn-ef-btn' + (pomoDur === m ? ' active' : '')} onClick={() => setPomo(m)}>{m} min</button>
            ))}
          </div>
          <div className="wn-pomo-acts">
            {!running ? (
              <button type="button" className="wn-pomo-start" onClick={() => { if (secs === 0) setSecs(pomoDur * 60); setRunning(true) }}>
                {secs === 0 || secs === pomoDur * 60 ? 'Start' : 'Fortsett'}
              </button>
            ) : (
              <button type="button" className="wn-pomo-start pause" onClick={() => setRunning(false)}>Pause</button>
            )}
            <button type="button" className="wn-pomo-reset" onClick={resetPomo}>Nullstill</button>
          </div>
        </div>
      </div>
    </div>
  )
}
