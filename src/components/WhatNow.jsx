import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayKey } from '../db.js'
import { vibrate } from '../lib/fx.js'

const TYPE_META = {
  task:    { label: 'Oppgave', color: 'var(--accent)',  icon: '✓' },
  project: { label: 'Prosjekt', color: 'var(--forest)', icon: '→' },
  habit:   { label: 'Vane',    color: '#7ba07c',        icon: '↻' },
}

const EMPTY_MSGS = [
  'Alt virker ryddig akkurat nå — ingenting haster.',
  'Ingen åpne ting. Legg til noe i I dag, Vaner eller Prosjekter.',
  'Tomt. Det er faktisk lov å hvile.',
]

export default function WhatNow() {
  const today = todayKey()
  const [idx, setIdx] = useState(0)

  const items = useLiveQuery(async () => {
    const [tasks, habits, nowItems] = await Promise.all([
      db.tasks.where('dueDate').belowOrEqual(today).filter((t) => !t.isDone).toArray(),
      db.habits.toArray(),
      db.projectItems.where('stage').equals('now').sortBy('sortOrder'),
    ])

    const suggestions = []

    for (const t of tasks) {
      suggestions.push({ id: t.id, type: 'task', text: t.title })
    }

    for (const h of habits) {
      const history = new Set(h.history || [])
      if (!history.has(today)) {
        suggestions.push({ id: h.id, type: 'habit', text: h.name })
      }
    }

    const seenProject = new Set()
    for (const item of nowItems) {
      if (!seenProject.has(item.projectId)) {
        seenProject.add(item.projectId)
        suggestions.push({ id: item.id, type: 'project', text: item.text })
      }
    }

    return suggestions
  }, [today], null)

  if (items === null) return <div className="screen" />

  const current = items.length > 0 ? items[idx % items.length] : null
  const meta = current ? TYPE_META[current.type] : null

  function next() {
    vibrate(8)
    setIdx((i) => (i + 1) % items.length)
  }

  const emptyMsg = EMPTY_MSGS[Math.floor(items.length === 0 ? 0 : 0) % EMPTY_MSGS.length]

  return (
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Hva nå?</h1>
        <p className="scr-sub">Én ting av gangen.</p>

        <div className="wn-wrap">
          {!current ? (
            <div className="wn-empty">
              <div className="wn-glyph">✦</div>
              <p>{EMPTY_MSGS[0]}</p>
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
                {idx % items.length + 1} av {items.length} åpne ting
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
