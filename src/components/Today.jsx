import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, useMotionValue, useTransform } from 'motion/react'
import {
  listTasks,
  addTask,
  deleteTask,
  updateTask,
  setTaskDone,
  setTaskFocus,
  carryTaskToToday,
  snoozeTaskToTomorrow,
  todayKey,
} from '../db.js'
import { burst, vibrate, reduceMotion } from '../lib/fx.js'

const CHECK = (
  <svg viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7" />
  </svg>
)
const STAR = (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7 6.9 19.2l1-5.6-4.1-4 5.7-.8z" />
  </svg>
)
const MOON = (
  <svg viewBox="0 0 24 24">
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
)
const EST_CYCLE = [null, 5, 15, 30, 60]
function nextEst(e) {
  const i = EST_CYCLE.indexOf(e ?? null)
  return EST_CYCLE[(i + 1) % EST_CYCLE.length]
}
const REPEAT_CYCLE = ['none', 'daily', 'weekly']
const REPEAT_LABEL = { none: '↻', daily: '↻d', weekly: '↻u' }
const REPEAT_TITLE = { none: 'Gjentar ikke', daily: 'Gjentar daglig', weekly: 'Gjentar ukentlig' }
function nextRepeat(r) {
  const i = REPEAT_CYCLE.indexOf(r || 'none')
  return REPEAT_CYCLE[(i + 1) % REPEAT_CYCLE.length]
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'God natt'
  if (h < 11) return 'God morgen'
  if (h < 17) return 'God dag'
  if (h < 22) return 'God kveld'
  return 'God natt'
}

function Task({ task, onCheck, onUndo, onFocus, onCarry, onDrop, onSnooze }) {
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const checkRef = useRef(null)
  const done = task.isDone
  const carry = task.status === 'carry'

  function startEdit(e) {
    e.stopPropagation()
    setEditVal(task.title)
    setEditing(true)
  }
  function saveEdit() {
    const v = editVal.trim()
    if (v && v !== task.title) updateTask(task.id, { title: v })
    setEditing(false)
  }

  function handleCheck() {
    if (done) {
      onUndo(task)
      return
    }
    vibrate([12, 30, 12])
    burst(checkRef.current)
    onCheck(task)
  }
  function handleDrop() {
    setLeaving(true)
    setTimeout(() => onDrop(task), reduceMotion() ? 0 : 340)
  }

  // ---- sveip: høyre = fullfør, venstre = utsett til i morgen ----
  const x = useMotionValue(0)
  const completeOpacity = useTransform(x, [12, 80], [0, 1])
  const snoozeOpacity = useTransform(x, [-80, -12], [1, 0])
  const swipeable = !done && !carry
  const SWIPE_THRESHOLD = 80
  function onDragEnd(_e, info) {
    if (info.offset.x > SWIPE_THRESHOLD) handleCheck()
    else if (info.offset.x < -SWIPE_THRESHOLD && onSnooze) onSnooze(task)
  }

  const taskClass =
    'task' + (task.isFocus && !done ? ' focus' : '') + (done ? ' done' : '') + (leaving ? ' leaving' : '')

  const inner = (
    <>
      <div
        ref={checkRef}
        className="check"
        role="checkbox"
        tabIndex={0}
        aria-checked={done}
        aria-label="Fullfør"
        onClick={handleCheck}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault()
            handleCheck()
          }
        }}
      >
        {CHECK}
      </div>
      {editing ? (
        <input
          className="ttl-input"
          value={editVal}
          autoFocus
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
        />
      ) : (
        <div className="ttl" onDoubleClick={!done ? startEdit : undefined} title={!done ? 'Dobbeltklikk for å redigere' : undefined}>{task.title}</div>
      )}

      {carry ? (
        <div className="carry-acts">
          <button type="button" className="cbtn" onClick={() => onCarry(task)}>
            → i dag
          </button>
          <button type="button" className="cbtn drop" onClick={handleDrop}>
            slipp
          </button>
        </div>
      ) : !done ? (
        <>
          <button
            type="button"
            className={'est' + (task.estimate ? ' on' : '')}
            aria-label="Tidsestimat"
            title="Tidsestimat — trykk for å endre"
            onClick={() => updateTask(task.id, { estimate: nextEst(task.estimate) })}
          >
            {task.estimate ? `${task.estimate}m` : '⏱'}
          </button>
          <button
            type="button"
            className={'est' + (task.repeat && task.repeat !== 'none' ? ' on' : '')}
            aria-label="Gjentakelse"
            title={REPEAT_TITLE[task.repeat || 'none'] + ' — trykk for å endre'}
            onClick={() => updateTask(task.id, { repeat: nextRepeat(task.repeat) })}
          >
            {REPEAT_LABEL[task.repeat || 'none']}
          </button>
          {onSnooze && (
            <button
              type="button"
              className="snooze"
              aria-label="Utsett til i morgen"
              title="Utsett til i morgen"
              onClick={() => onSnooze(task)}
            >
              {MOON}
            </button>
          )}
          <button
            type="button"
            className={'star' + (task.isFocus ? ' on' : '')}
            aria-label="Sett i fokus"
            aria-pressed={task.isFocus}
            onClick={() => onFocus(task)}
          >
            {STAR}
          </button>
        </>
      ) : null}
    </>
  )

  if (!swipeable) return <div className={taskClass}>{inner}</div>

  return (
    <div className="swipe-wrap">
      <div className="swipe-actions" aria-hidden="true">
        <motion.span className="swipe-act complete" style={{ opacity: completeOpacity }}>
          {CHECK} Fullfør
        </motion.span>
        <motion.span className="swipe-act snooze" style={{ opacity: snoozeOpacity }}>
          {MOON} I morgen
        </motion.span>
      </div>
      <motion.div
        className={taskClass + ' swipeable'}
        drag="x"
        dragDirectionLock
        dragSnapToOrigin
        dragElastic={0.9}
        style={{ x }}
        onDragEnd={onDragEnd}
      >
        {inner}
      </motion.div>
    </div>
  )
}

function Section({ label, count, children }) {
  return (
    <div className="sec">
      <div className="sec-label">
        {label}
        <span className="ln" />
        {count && <span className="ct">{count}</span>}
      </div>
      {children}
    </div>
  )
}

export default function Today() {
  const tasks = useLiveQuery(() => listTasks(), [], [])
  const [val, setVal] = useState('')
  const [toast, setToast] = useState('')
  const scrollRef = useRef(null)
  const toastTimer = useRef(null)
  const today = todayKey()

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(''), 2200)
  }

  const open = tasks.filter((t) => !t.isDone)
  const carry = open
    .filter((t) => t.dueDate && t.dueDate < today)
    .map((t) => ({ ...t, status: 'carry' }))
  const todays = open.filter((t) => !t.dueDate || t.dueDate >= today)
  const focus = todays.filter((t) => t.isFocus)
  const rest = todays.filter((t) => !t.isFocus)
  const doneToday = tasks.filter(
    (t) => t.isDone && t.completedAt && todayKey(new Date(t.completedAt)) === today,
  )

  const openCount = focus.length + rest.length + carry.length
  const total = openCount + doneToday.length
  const pct = total ? Math.round((doneToday.length / total) * 100) : 0

  async function add() {
    const v = val.trim()
    if (!v) return
    await addTask(v)
    setVal('')
    vibrate(8)
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  function onFocus(task) {
    if (!task.isFocus && focus.length >= 3) {
      showToast('Maks 3 i fokus — hold det enkelt 🌱')
      return
    }
    setTaskFocus(task.id, !task.isFocus)
  }

  const statusText =
    openCount === 0
      ? total > 0
        ? 'alt unnagjort'
        : 'ingenting planlagt'
      : `${focus.length} i fokus · ${rest.length + carry.length} igjen`

  return (
    <div className="screen">
      <div className="screen-scroll" ref={scrollRef}>
        <p className="scr-eyebrow">
          {new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }).format(
            new Date(),
          )}
        </p>
        <h1 className="scr-title">{greeting()}, Fabi</h1>
        <div className="status">
          <span>{statusText}</span>
          <span className="pmeter">
            <i style={{ width: pct + '%' }} />
          </span>
        </div>

        {doneToday.length >= 3 && openCount > 0 && (
          <div className="enough-line">
            <span className="enough-leaf">🌿</span>
            Du har gjort nok i dag. Resten kan vente med god samvittighet.
          </div>
        )}

        {openCount === 0 && doneToday.length > 0 && (
          <div className="empty">
            <p className="em-ttl">Ferdig for i dag</p>
            <p>Alt gjort. Det er faktisk nok — lukk appen med god samvittighet.</p>
          </div>
        )}

        {focus.length > 0 && (
          <Section label="I fokus" count={`${focus.length}/3`}>
            {focus.map((t) => (
              <Task
                key={t.id}
                task={t}
                onCheck={(x) => setTaskDone(x.id, true)}
                onUndo={(x) => setTaskDone(x.id, false)}
                onFocus={onFocus}
                onSnooze={(x) => { snoozeTaskToTomorrow(x.id); showToast('Utsatt til i morgen 🌙') }}
              />
            ))}
          </Section>
        )}

        {rest.length > 0 && (
          <Section label="Resten">
            {rest.map((t) => (
              <Task
                key={t.id}
                task={t}
                onCheck={(x) => setTaskDone(x.id, true)}
                onUndo={(x) => setTaskDone(x.id, false)}
                onFocus={onFocus}
                onSnooze={(x) => { snoozeTaskToTomorrow(x.id); showToast('Utsatt til i morgen 🌙') }}
              />
            ))}
          </Section>
        )}

        {carry.length > 0 && (
          <Section label="Henger igjen">
            {carry.map((t) => (
              <Task
                key={t.id}
                task={t}
                onCheck={(x) => setTaskDone(x.id, true)}
                onUndo={(x) => setTaskDone(x.id, false)}
                onCarry={(x) => carryTaskToToday(x.id)}
                onDrop={(x) => deleteTask(x.id)}
              />
            ))}
          </Section>
        )}

        {doneToday.length > 0 && (
          <Section label="Fullført" count={String(doneToday.length)}>
            {doneToday.map((t) => (
              <Task key={t.id} task={t} onUndo={(x) => setTaskDone(x.id, false)} />
            ))}
          </Section>
        )}

        {total === 0 && (
          <div className="empty">
            <div className="glyph">🌱</div>
            <p className="em-ttl">Blank dag</p>
            <p>Hva er det ene du vil ha gjort i dag? Skriv det i feltet nederst.</p>
          </div>
        )}
      </div>

      <div className="screen-bar">
        <div className="field">
          <input
            type="text"
            placeholder="Legg til noe…"
            enterKeyHint="done"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button
            type="button"
            className="field-btn"
            aria-label="Legg til"
            disabled={val.trim() === ''}
            onClick={add}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>

      {toast && <div className="toast show">{toast}</div>}
    </div>
  )
}
