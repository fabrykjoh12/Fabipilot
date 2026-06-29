import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listHabits, addHabit, updateHabit, deleteHabit, toggleHabitDay, todayKey, db } from '../db.js'
import { vibrate } from '../lib/fx.js'

const CHECK = (
  <svg viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7" />
  </svg>
)

const HABIT_COLORS = [
  { k: 'forest', val: '#42634a' },
  { k: 'amber', val: '#cc882b' },
  { k: 'blue', val: '#5f86b0' },
  { k: 'rose', val: '#b4574a' },
  { k: 'plum', val: '#9c7a98' },
  { k: 'slate', val: '#5e6b6f' },
]
const habitColor = (k) => (HABIT_COLORS.find((c) => c.k === k) || HABIT_COLORS[0]).val
const HABIT_EMOJIS = ['🌿', '💧', '📚', '🏃', '🧘', '💊', '🛏️', '🦷', '🎸', '✍️', '☀️', '🥗', '📵', '🚶', '💪', '🧹']

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
  const col = habitColor(habit.color)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [customizing, setCustomizing] = useState(false)

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
          style={doneToday ? { background: col, borderColor: col } : undefined}
          aria-pressed={doneToday}
          aria-label={doneToday ? 'Angre i dag' : 'Hak av i dag'}
          onClick={() => {
            if (!doneToday) vibrate([10, 24, 10])
            toggleHabitDay(habit.id)
          }}
        >
          {CHECK}
        </button>
        <button
          type="button"
          className="habit-emoji"
          style={{ background: col + '22' }}
          aria-label="Endre ikon og farge"
          onClick={() => setCustomizing((c) => !c)}
        >
          {habit.emoji || '🌿'}
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
          <div className="habit-name" onClick={startEdit} title="Trykk for å redigere">{habit.name}</div>
        )}
        <div className="habit-actions">
          <button type="button" className="sort-btn" aria-label="Flytt opp" disabled={idx === 0} onClick={() => moveHabit(habit.id, -1, habits)}>▲</button>
          <button type="button" className="sort-btn" aria-label="Flytt ned" disabled={idx === habits.length - 1} onClick={() => moveHabit(habit.id, 1, habits)}>▼</button>
        </div>
      </div>

      {customizing && (
        <div className="habit-custom">
          <div className="hc-emojis">
            {HABIT_EMOJIS.map((e) => (
              <button key={e} type="button" className={'hc-emoji' + ((habit.emoji || '🌿') === e ? ' on' : '')} onClick={() => updateHabit(habit.id, { emoji: e })}>{e}</button>
            ))}
          </div>
          <div className="hc-colors">
            {HABIT_COLORS.map((c) => (
              <button key={c.k} type="button" className={'hc-color' + (habit.color === c.k ? ' on' : '')} style={{ background: c.val }} aria-label={c.k} onClick={() => updateHabit(habit.id, { color: c.k })} />
            ))}
          </div>
          <div className="hc-acts">
            <button type="button" className="hc-archive" onClick={() => updateHabit(habit.id, { archived: true })}>Arkiver</button>
            <button type="button" className="hc-delete" onClick={() => { if (window.confirm(`Slette vanen «${habit.name}»?`)) deleteHabit(habit.id) }}>Slett</button>
          </div>
        </div>
      )}

      {view === 'week' ? (
        <div className="dots">
          {days.map((d) => (
            <div key={d.key} className="dot-col">
              <span className={'dot' + (history.has(d.key) ? ' on' : '') + (d.key === today ? ' today' : '')} style={history.has(d.key) ? { background: col } : undefined} />
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
              style={history.has(d.key) ? { background: col } : undefined}
              title={d.key}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export default function Habits() {
  const allHabits = useLiveQuery(() => listHabits(), [], [])
  const [val, setVal] = useState('')
  const [view, setView] = useState('week')
  const [showArchived, setShowArchived] = useState(false)
  const today = todayKey()
  const days = view === 'week' ? lastNDays(7) : lastNDays(28)

  const habits = allHabits.filter((h) => !h.archived)
  const archived = allHabits.filter((h) => h.archived)
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

          {archived.length > 0 && (
            <div className="habit-archive">
              <button type="button" className="habit-archive-head" onClick={() => setShowArchived((s) => !s)}>
                Arkiverte<span className="ct">{archived.length}</span>
                <span className={'chev' + (showArchived ? ' open' : '')}>▼</span>
              </button>
              {showArchived && archived.map((h) => (
                <div key={h.id} className="archived-row">
                  <span className="archived-emoji">{h.emoji || '🌿'}</span>
                  <span className="archived-name">{h.name}</span>
                  <button type="button" className="archived-restore" onClick={() => updateHabit(h.id, { archived: false })}>Hent tilbake</button>
                </div>
              ))}
            </div>
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
