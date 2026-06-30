import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayKey, addEvent, updateEvent, deleteWithRestore, restoreRecord, setTaskDone } from '../db.js'
import { burst, vibrate, reduceMotion } from '../lib/fx.js'
import { toast } from '../lib/ui.jsx'
import './Calendar.css'

const WEEKDAYS = ['Man', 'Tir', 'Ons', 'Tor', 'Fre', 'Lør', 'Søn']
const MONTHS = [
  'januar', 'februar', 'mars', 'april', 'mai', 'juni',
  'juli', 'august', 'september', 'oktober', 'november', 'desember',
]
const WEEKDAYS_LONG = ['mandag', 'tirsdag', 'onsdag', 'torsdag', 'fredag', 'lørdag', 'søndag']

const EVENT_COLORS = [
  { k: 'amber', val: '#cc882b' },
  { k: 'forest', val: '#42634a' },
  { k: 'blue', val: '#5f86b0' },
  { k: 'rose', val: '#b4574a' },
  { k: 'plum', val: '#9c7a98' },
]
const colorVal = (k) => (EVENT_COLORS.find((c) => c.k === k) || EVENT_COLORS[0]).val

const REPEAT_OPTS = [
  { k: 'none', label: 'Aldri' },
  { k: 'daily', label: 'Daglig' },
  { k: 'weekly', label: 'Ukentlig' },
  { k: 'monthly', label: 'Månedlig' },
]

const pad = (n) => String(n).padStart(2, '0')
const keyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const monthOfKey = (key) => Number(key.split('-')[1]) - 1

/** Forekommer hendelsen på en gitt dag (med gjentakelse)? */
function occursOn(ev, key) {
  if (!ev.repeat || ev.repeat === 'none') return ev.date === key
  if (key < ev.date) return false
  const [y1, m1, d1] = ev.date.split('-').map(Number)
  const [y2, m2, d2] = key.split('-').map(Number)
  if (ev.repeat === 'daily') return true
  if (ev.repeat === 'weekly') return new Date(y1, m1 - 1, d1).getDay() === new Date(y2, m2 - 1, d2).getDay()
  if (ev.repeat === 'monthly') return d1 === d2
  return false
}
const CHECK = (
  <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
)

function prettyDate(key) {
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const wd = WEEKDAYS_LONG[(date.getDay() + 6) % 7]
  return `${wd.charAt(0).toUpperCase() + wd.slice(1)} ${d}. ${MONTHS[m - 1]}`
}

/* ============ Bunn-sheet: legg til / rediger hendelse ============ */
function EventSheet({ initial, defaultDate, onClose }) {
  const editing = !!initial
  const [title, setTitle] = useState(initial?.title || '')
  const [date, setDate] = useState(initial?.date || defaultDate)
  const [time, setTime] = useState(initial?.time || '')
  const [color, setColor] = useState(initial?.color || 'amber')
  const [note, setNote] = useState(initial?.note || '')
  const [repeat, setRepeat] = useState(initial?.repeat || 'none')
  const saveRef = useRef(null)

  async function save() {
    const t = title.trim()
    if (!t) return
    if (editing) {
      await updateEvent(initial.id, { title: t, date, time, color, note: note.trim(), repeat })
    } else {
      await addEvent({ title: t, date, time, color, note: note.trim(), repeat })
    }
    vibrate([12, 30, 12])
    burst(saveRef.current)
    setTimeout(onClose, reduceMotion() ? 0 : 160)
  }

  async function remove() {
    if (!editing) return
    const rec = await deleteWithRestore('events', initial.id)
    vibrate(8)
    toast.message(`Slettet «${initial.title}»`, {
      action: { label: 'Angre', onClick: () => restoreRecord('events', rec) },
    })
    onClose()
  }

  return (
    <div className="cal-sheet-overlay" onClick={onClose}>
      <div className="cal-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="cal-sheet-grip" />
        <h2 className="cal-sheet-title">{editing ? 'Rediger hendelse' : 'Ny hendelse'}</h2>

        <input
          className="cal-in cal-in-title"
          placeholder="Hva skjer?"
          value={title}
          autoFocus={!editing}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
        />

        <div className="cal-sheet-row">
          <label className="cal-field">
            <span className="cal-field-lbl">Dato</span>
            <input className="cal-in" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="cal-field">
            <span className="cal-field-lbl">Tid (valgfritt)</span>
            <input className="cal-in" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>

        <div className="cal-field">
          <span className="cal-field-lbl">Farge</span>
          <div className="cal-colors">
            {EVENT_COLORS.map((c) => (
              <button
                key={c.k}
                type="button"
                className={'cal-color' + (color === c.k ? ' on' : '')}
                style={{ background: c.val }}
                aria-label={c.k}
                onClick={() => setColor(c.k)}
              />
            ))}
          </div>
        </div>

        <div className="cal-field">
          <span className="cal-field-lbl">Gjentar</span>
          <div className="cal-repeat">
            {REPEAT_OPTS.map((r) => (
              <button
                key={r.k}
                type="button"
                className={'cal-rep' + (repeat === r.k ? ' on' : '')}
                onClick={() => setRepeat(r.k)}
              >{r.label}</button>
            ))}
          </div>
        </div>

        <textarea
          className="cal-in cal-note"
          placeholder="Notat (valgfritt)"
          value={note}
          rows={2}
          onChange={(e) => setNote(e.target.value)}
        />

        <button ref={saveRef} type="button" className="cal-save" disabled={!title.trim()} onClick={save}>
          {editing ? 'Lagre' : 'Legg til'}
        </button>
        {editing && (
          <button type="button" className="cal-delete" onClick={remove}>
            Slett hendelse
          </button>
        )}
      </div>
    </div>
  )
}

/* ============ Hovedmodul ============ */
export default function Calendar() {
  const today = todayKey()
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number)
    return { y, m: m - 1 }
  })
  const [selected, setSelected] = useState(today)
  const [sheet, setSheet] = useState(null) // null | {event} | {add:true}
  const touchX = useRef(null)

  const events = useLiveQuery(() => db.events.toArray(), [], [])
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], [])

  const eventsOn = (key) =>
    events
      .filter((e) => occursOn(e, key))
      .sort((a, b) => (a.time || '99').localeCompare(b.time || '99'))

  const tasksByDate = useMemo(() => {
    const map = {}
    for (const t of tasks) if (!t.isDone && t.dueDate) (map[t.dueDate] ||= []).push(t)
    return map
  }, [tasks])

  const cells = useMemo(() => {
    const first = new Date(cursor.y, cursor.m, 1)
    const startOffset = (first.getDay() + 6) % 7
    const start = new Date(cursor.y, cursor.m, 1 - startOffset)
    return [...Array(42)].map((_, i) => {
      const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i)
      return { key: keyOf(d), day: d.getDate(), out: d.getMonth() !== cursor.m }
    })
  }, [cursor])

  function shiftMonth(delta) {
    const d = new Date(cursor.y, cursor.m + delta, 1)
    setCursor({ y: d.getFullYear(), m: d.getMonth() })
  }
  function goToday() {
    const [y, m] = today.split('-').map(Number)
    setCursor({ y, m: m - 1 })
    setSelected(today)
    vibrate(6)
  }
  function pick(key) {
    setSelected(key)
    const m = monthOfKey(key)
    if (m !== cursor.m) {
      const [y] = key.split('-').map(Number)
      setCursor({ y, m })
    }
  }
  function onTouchStart(e) {
    touchX.current = e.touches[0].clientX
  }
  function onTouchEnd(e) {
    if (touchX.current === null) return
    const dx = e.changedTouches[0].clientX - touchX.current
    if (Math.abs(dx) > 55) shiftMonth(dx < 0 ? 1 : -1)
    touchX.current = null
  }

  const selEvents = eventsOn(selected)
  const selTasks = tasksByDate[selected] || []
  const monthLabel = `${MONTHS[cursor.m].charAt(0).toUpperCase() + MONTHS[cursor.m].slice(1)} ${cursor.y}`

  return (
    <div className="screen cal-screen">
      <div className="screen-scroll">
        <div className="cal-head">
          <h1 className="cal-month">{monthLabel}</h1>
          <div className="cal-nav">
            <button type="button" className="cal-today-btn" onClick={goToday}>I dag</button>
            <button type="button" className="cal-arrow" aria-label="Forrige måned" onClick={() => shiftMonth(-1)}>
              <svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
            <button type="button" className="cal-arrow" aria-label="Neste måned" onClick={() => shiftMonth(1)}>
              <svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        </div>

        <div className="cal-weekdays">
          {WEEKDAYS.map((w) => (
            <span key={w} className={w === 'Lør' || w === 'Søn' ? 'weekend' : ''}>{w}</span>
          ))}
        </div>

        <div
          className="cal-grid"
          key={`${cursor.y}-${cursor.m}`}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {cells.map((c) => {
            const evs = eventsOn(c.key)
            const tks = tasksByDate[c.key] || []
            const dots = [
              ...evs.map((e) => colorVal(e.color)),
              ...tks.map(() => 'var(--accent)'),
            ].slice(0, 4)
            const isToday = c.key === today
            const isSel = c.key === selected
            return (
              <button
                type="button"
                key={c.key}
                className={
                  'cal-cell' +
                  (c.out ? ' out' : '') +
                  (isToday ? ' today' : '') +
                  (isSel ? ' sel' : '')
                }
                onClick={() => pick(c.key)}
              >
                <span className="cal-num">{c.day}</span>
                {dots.length > 0 && (
                  <span className="cal-dots">
                    {dots.map((col, i) => (
                      <span key={i} className="cal-dot" style={{ background: col }} />
                    ))}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <div className="cal-agenda">
          <div className="cal-agenda-head">
            <h2>{prettyDate(selected)}</h2>
            <button type="button" className="cal-add" onClick={() => setSheet({ add: true })}>
              <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
              Hendelse
            </button>
          </div>

          {selTasks.length === 0 && selEvents.length === 0 && (
            <div className="cal-empty">
              <span className="cal-empty-glyph">◌</span>
              <p>Ingenting planlagt denne dagen. Legg til en hendelse — eller nyt den åpne plassen.</p>
            </div>
          )}

          {selTasks.map((t) => (
            <div key={t.id} className="cal-row cal-task">
              <button
                type="button"
                className="cal-check"
                aria-label="Fullfør oppgave"
                onClick={(e) => {
                  vibrate([12, 30, 12])
                  burst(e.currentTarget)
                  setTaskDone(t.id, true)
                }}
              >
                {CHECK}
              </button>
              <span className="cal-row-txt">{t.title}</span>
              <span className="cal-tag">oppgave</span>
            </div>
          ))}

          {selEvents.map((ev) => (
            <button key={ev.id} type="button" className="cal-row cal-event" onClick={() => setSheet({ event: ev })}>
              <span className="cal-ev-bar" style={{ background: colorVal(ev.color) }} />
              {ev.time && <span className="cal-time">{ev.time}</span>}
              <span className="cal-row-txt">{ev.title}</span>
              {ev.repeat && ev.repeat !== 'none' && <span className="cal-note-mark" aria-label="Gjentar">↻</span>}
              {ev.note && <span className="cal-note-mark" aria-label="Har notat">≡</span>}
            </button>
          ))}
        </div>
      </div>

      {sheet && (
        <EventSheet
          initial={sheet.event}
          defaultDate={selected}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  )
}
