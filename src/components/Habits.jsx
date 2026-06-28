import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listHabits, addHabit, updateHabit, deleteHabit, toggleHabitDay, todayKey, db } from '../db.js'
import { vibrate } from '../lib/fx.js'

const CHECK = (
  <svg viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7" />
  </svg>
)

function lastNDays(n) {
  return [...Array(n)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (n - 1 - i))
    return {
      key: todayKey(d),
      label: new Intl.DateTimeFormat('nb-NO', { weekday: 'short' }).format(d).slice(0, 2),
    }
  })
}

async function moveHabit(id, direction, habits) {
  const idx = habits.findIndex((h) => h.id === id)
  const swapIdx = idx + direction
  if (swapIdx < 0 || swapIdx >= habits.length) return
  const a = habits[idx], b = habits[swapIdx]
  await db.habits.update(a.id, { sortOrder: b.sortOrder })
  await db.habits.update(b.id, { sortOrder: a.sortOrder })
}

function HabitCard({ habit, habits, idx, days, today, view }) {
  const history = new Set(habit.history || [])
  const doneToday = history.has(today)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')

  function startEdit() { setEditVal(habit.name); setEditing(true) }
  function saveEdit() {
    const v = editVal.trim()
    if (v && v !== habit.name) updateHabit(habit.id, { name: v })
    setEditing(false)
  }

  return (
    <div className="habit card">
      <div className="habit-row">
        <button
          type="button"
          className={'check' + (doneToday ? ' on' : '')}
          aria-pressed={doneToday}
          aria-label={doneToday ? 'Angre i dag' : 'Hak av i dag'}
          onClick={() => {
            if (!doneToday) vibrate([10, 24, 10])
            toggleHabitDay(habit.id)
          }}
        >
          {CHECK}
        </button>
        {editing ? (
          <input
            className="habit-name-input"
            value={editVal}
            autoFocus
            onChange={(e) => setEditVal(e.target.value)}
            onBlur={saveEdit}
            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
          />
        ) : (
          <div className="habit-name" onDoubleClick={startEdit} title="Dobbeltklikk for å redigere">{habit.name}</div>
        )}
        <div className="habit-actions">
          <button type="button" className="sort-btn" aria-label="Flytt opp" disabled={idx === 0} onClick={() => moveHabit(habit.id, -1, habits)}>▲</button>
          <button type="button" className="sort-btn" aria-label="Flytt ned" disabled={idx === habits.length - 1} onClick={() => moveHabit(habit.id, 1, habits)}>▼</button>
          <button
            type="button"
            className="icon-x"
            aria-label="Slett vane"
            onClick={() => {
              if (window.confirm(`Slette vanen «${habit.name}»?`)) deleteHabit(habit.id)
            }}
          >
            <svg viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
      {view === 'week' ? (
        <div className="dots">
          {days.map((d) => (
            <div key={d.key} className="dot-col">
              <span className={'dot' + (history.has(d.key) ? ' on' : '') + (d.key === today ? ' today' : '')} />
              <span className="dot-lbl">{d.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="month-dots">
          {days.map((d) => (
            <span
              key={d.key}
              className={'month-dot' + (history.has(d.key) ? ' on' : '') + (d.key === today ? ' today' : '')}
              title={d.key}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Habits() {
  const habits = useLiveQuery(() => listHabits(), [], [])
  const [val, setVal] = useState('')
  const [view, setView] = useState('week')
  const today = todayKey()
  const days = view === 'week' ? lastNDays(7) : lastNDays(28)

  const doneCount = habits.filter((h) => (h.history || []).includes(today)).length

  async function add() {
    const v = val.trim()
    if (!v) return
    await addHabit(v)
    setVal('')
    vibrate(8)
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="scr-top">
          <div>
            <h1 className="scr-title">Vaner</h1>
            <p className="scr-sub">
              {habits.length === 0
                ? 'Små ting, gjentatt.'
                : `${doneCount} av ${habits.length} gjort i dag`}
            </p>
          </div>
          {habits.length > 0 && (
            <div className="habits-view-toggle">
              <button className={view === 'week' ? 'active' : ''} onClick={() => setView('week')}>7d</button>
              <button className={view === 'month' ? 'active' : ''} onClick={() => setView('month')}>28d</button>
            </div>
          )}
        </div>

        <div style={{ marginTop: 20 }}>
          {habits.length === 0 ? (
            <div className="empty">
              <div className="glyph">🌿</div>
              <p className="em-ttl">Ingen vaner enda</p>
              <p>Legg til én liten ting du vil gjøre ofte — drikke vann, lese, gå en tur. Ingen streaks, ingen skam.</p>
            </div>
          ) : (
            habits.map((h, i) => <HabitCard key={h.id} habit={h} habits={habits} idx={i} days={days} today={today} view={view} />)
          )}
        </div>
      </div>

      <div className="screen-bar">
        <div className="field">
          <input
            type="text"
            placeholder="Ny vane…"
            enterKeyHint="done"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button
            type="button"
            className="field-btn"
            aria-label="Legg til vane"
            disabled={val.trim() === ''}
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
