import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayKey, addTask } from '../db.js'
import { vibrate } from '../lib/fx.js'

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

export default function WhatNow() {
  const today = todayKey()
  const [idx, setIdx] = useState(0)
  const [energy, setEnergy] = useState('alle')
  const [addVal, setAddVal] = useState('')

  const allItems = useLiveQuery(async () => {
    const [tasks, habits, nowItems] = await Promise.all([
      db.tasks.where('dueDate').belowOrEqual(today).filter((t) => !t.isDone).toArray(),
      db.habits.toArray(),
      db.projectItems.where('stage').equals('now').sortBy('sortOrder'),
    ])

    const suggestions = []

    for (const t of tasks) {
      suggestions.push({ id: t.id, type: 'task', text: t.title, energy: null })
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

  if (allItems === null) return <div className="screen" />

  const items = energy === 'alle'
    ? allItems
    : allItems.filter((i) => i.energy === energy || (energy === 'lav' && i.type !== 'project'))

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

        <div className="wn-wrap">
          {!current ? (
            <div className="wn-empty">
              <div className="wn-glyph">✦</div>
              <p>
                {energy !== 'alle'
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
      </div>
    </div>
  )
}
