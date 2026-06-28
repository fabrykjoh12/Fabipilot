import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listHabits, addHabit, deleteHabit, toggleHabitDay, todayKey } from '../db.js'
import { vibrate } from '../lib/fx.js'

const CHECK = (
  <svg viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7" />
  </svg>
)

// Siste 7 dager (eldst → i dag) som datonøkler + korte ukedagsbokstaver.
function last7() {
  return [...Array(7)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return {
      key: todayKey(d),
      label: new Intl.DateTimeFormat('nb-NO', { weekday: 'short' }).format(d).slice(0, 2),
    }
  })
}

function HabitCard({ habit, days, today }) {
  const history = new Set(habit.history || [])
  const doneToday = history.has(today)

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
        <div className="habit-name">{habit.name}</div>
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
      <div className="dots">
        {days.map((d) => (
          <div key={d.key} className="dot-col">
            <span className={'dot' + (history.has(d.key) ? ' on' : '') + (d.key === today ? ' today' : '')} />
            <span className="dot-lbl">{d.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Habits() {
  const habits = useLiveQuery(() => listHabits(), [], [])
  const [val, setVal] = useState('')
  const today = todayKey()
  const days = last7()

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
        </div>

        <div style={{ marginTop: 20 }}>
          {habits.length === 0 ? (
            <div className="empty">
              <div className="glyph">🌿</div>
              <p className="em-ttl">Ingen vaner enda</p>
              <p>Legg til én liten ting du vil gjøre ofte — drikke vann, lese, gå en tur. Ingen streaks, ingen skam.</p>
            </div>
          ) : (
            habits.map((h) => <HabitCard key={h.id} habit={h} days={days} today={today} />)
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
