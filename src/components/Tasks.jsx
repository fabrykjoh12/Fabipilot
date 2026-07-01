import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { motion, useMotionValue, useTransform } from 'motion/react'
import { Star, Moon, CalendarPlus, ChevronDown, Plus, Clock, Repeat, X } from 'lucide-react'
import {
  db, addTask, updateTask, setTaskDone, setTaskFocus,
  snoozeTaskToTomorrow, deleteWithRestore, restoreRecord, setTaskDate,
  addTaskSubtask, toggleTaskSubtask, deleteTaskSubtask,
  todayKey, tomorrowKey,
} from '../db.js'
import { burst, vibrate } from '../lib/fx.js'
import { parseEntry } from '../lib/parse.js'
import { toast } from '../lib/ui.jsx'
import './Tasks.css'

const CHECK = (<svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>)
const MAX_FOCUS = 3
const EST_CYCLE = [null, 5, 15, 30, 60]
const nextEst = (e) => EST_CYCLE[(EST_CYCLE.indexOf(e ?? null) + 1) % EST_CYCLE.length]
const REPEAT_CYCLE = ['none', 'daily', 'weekly']
const REPEAT_LABEL = { none: 'Gjentar ikke', daily: 'Hver dag', weekly: 'Hver uke' }
const nextRepeat = (r) => REPEAT_CYCLE[(REPEAT_CYCLE.indexOf(r || 'none') + 1) % REPEAT_CYCLE.length]

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'God natt'
  if (h < 11) return 'God morgen'
  if (h < 17) return 'God dag'
  if (h < 22) return 'God kveld'
  return 'God natt'
}
function weekendKey() {
  const d = new Date()
  const ahead = (6 - d.getDay() + 7) % 7 // neste lørdag (0=i dag hvis lørdag)
  d.setDate(d.getDate() + (ahead === 0 ? 7 : ahead))
  return todayKey(d)
}
function dateLabel(key, today, tom) {
  if (!key) return null
  if (key === today) return 'i dag'
  if (key === tom) return 'i morgen'
  const [y, m, d] = key.split('-').map(Number)
  return new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(y, m - 1, d))
}

/* ---------- dato-velger (chip + lite menu) ---------- */
function DateChip({ task, today, tom }) {
  const [open, setOpen] = useState(false)
  const status = !task.dueDate ? 'none' : task.dueDate < today ? 'over' : task.dueDate === today ? 'today' : 'future'
  const label = dateLabel(task.dueDate, today, tom)
  const presets = [
    { k: 'I dag', v: today },
    { k: 'I morgen', v: tom },
    { k: 'Til helga', v: weekendKey() },
  ]
  return (
    <div className="tdate-wrap">
      <button type="button" className={'tdate ' + status} onClick={(e) => { e.stopPropagation(); setOpen((o) => !o) }}>
        {status === 'none' ? <CalendarPlus /> : null}
        {label || 'dato'}
      </button>
      {open && (
        <>
          <div className="tdate-back" onClick={() => setOpen(false)} />
          <div className="tdate-menu" onClick={(e) => e.stopPropagation()}>
            {presets.map((p) => (
              <button key={p.k} type="button" className={'tdate-opt' + (task.dueDate === p.v ? ' on' : '')} onClick={() => { setTaskDate(task.id, p.v); setOpen(false); vibrate(6) }}>
                {p.k}
              </button>
            ))}
            <label className="tdate-opt tdate-pick">
              Velg dato…
              <input type="date" value={task.dueDate || ''} onChange={(e) => { setTaskDate(task.id, e.target.value || null); setOpen(false) }} />
            </label>
            {task.dueDate && (
              <button type="button" className="tdate-opt tdate-clear" onClick={() => { setTaskDate(task.id, null); setOpen(false) }}>
                Fjern dato
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

/* ---------- én oppgave ---------- */
function TaskRow({ task, today, tom, focusCount }) {
  const done = task.isDone
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [open, setOpen] = useState(false)
  const [subVal, setSubVal] = useState('')
  const checkRef = useRef(null)

  const subs = task.subtasks || []
  const subDone = subs.filter((s) => s.done).length

  const x = useMotionValue(0)
  const completeOpacity = useTransform(x, [12, 80], [0, 1])
  const snoozeOpacity = useTransform(x, [-80, -12], [1, 0])
  const swipeable = !done
  const THRESH = 80

  function handleCheck() {
    if (done) { setTaskDone(task.id, false); return }
    vibrate([12, 30, 12]); burst(checkRef.current); setTaskDone(task.id, true)
  }
  function onDragEnd(_e, info) {
    if (info.offset.x > THRESH) handleCheck()
    else if (info.offset.x < -THRESH) { snoozeTaskToTomorrow(task.id); toast.message('Utsatt til i morgen 🌙') }
  }
  function onFocusToggle() {
    if (!task.isFocus && focusCount >= MAX_FOCUS) { toast.message('Maks 3 i fokus — hold det enkelt 🌱'); return }
    vibrate(6); setTaskFocus(task.id, !task.isFocus)
  }
  function saveEdit() {
    const v = editVal.trim()
    if (v && v !== task.title) updateTask(task.id, { title: v })
    setEditing(false)
  }
  function onTitleClick() {
    if (editing || done) return
    if (!open) setOpen(true)
    else { setEditVal(task.title); setEditing(true) }
  }
  function addSub() {
    const v = subVal.trim(); if (!v) return
    addTaskSubtask(task.id, v); setSubVal('')
  }
  async function del() {
    const rec = await deleteWithRestore('tasks', task.id)
    toast.message(`Slettet «${task.title}»`, { action: { label: 'Angre', onClick: () => restoreRecord('tasks', rec) } })
  }

  const taskClass = 'task taskU' + (task.isFocus && !done ? ' focus' : '') + (done ? ' done' : '')

  const dLabel = !done ? dateLabel(task.dueDate, today, tom) : null
  const dStatus = !task.dueDate ? 'none' : task.dueDate < today ? 'over' : task.dueDate === today ? 'today' : 'future'

  const inner = (
    <>
      <div className="taskU-row">
        <div
          ref={checkRef}
          className="check"
          role="checkbox" tabIndex={0} aria-checked={done} aria-label="Fullfør"
          onClick={handleCheck}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleCheck() } }}
        >{CHECK}</div>

        <div className="taskU-mid">
          {editing ? (
            <input className="ttl-input" value={editVal} autoFocus
              onChange={(e) => setEditVal(e.target.value)} onBlur={saveEdit}
              onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }} />
          ) : (
            <div className="ttl" onClick={onTitleClick}>{task.title}</div>
          )}
          {!done && !open && (dLabel || subs.length > 0) && (
            <div className="taskU-quiet">
              {dLabel && <span className={'tq-date ' + dStatus}>{dLabel}</span>}
              {subs.length > 0 && <span className="tq-sub">{subDone}/{subs.length}</span>}
            </div>
          )}
        </div>

        {!done ? (
          <button type="button" className={'star' + (task.isFocus ? ' on' : '')} aria-label="Sett i fokus" aria-pressed={task.isFocus} onClick={onFocusToggle}><Star /></button>
        ) : (
          <button type="button" className="taskU-del" aria-label="Slett" onClick={del}><X /></button>
        )}
      </div>

      {open && !done && (
        <div className="taskU-controls">
          <div className="taskU-meta">
            <DateChip task={task} today={today} tom={tom} />
            <button type="button" className={'est' + (task.estimate ? ' on' : '')} aria-label="Tidsestimat" onClick={() => updateTask(task.id, { estimate: nextEst(task.estimate) })}>
              <Clock />{task.estimate ? `${task.estimate}m` : 'tid'}
            </button>
            <button type="button" className={'est' + (task.repeat && task.repeat !== 'none' ? ' on' : '')} aria-label="Gjentakelse" title={REPEAT_LABEL[task.repeat || 'none']} onClick={() => updateTask(task.id, { repeat: nextRepeat(task.repeat) })}>
              <Repeat />{task.repeat === 'daily' ? 'daglig' : task.repeat === 'weekly' ? 'ukentlig' : 'gjenta'}
            </button>
            <button type="button" className="snooze-pill" aria-label="Utsett til i morgen" onClick={() => { snoozeTaskToTomorrow(task.id); toast.message('Utsatt til i morgen 🌙') }}>
              <Moon />i morgen
            </button>
          </div>

          <div className="todo-subs">
            {subs.map((s) => (
              <div key={s.id} className="subrow">
                <button type="button" className={'subcheck' + (s.done ? ' on' : '')} onClick={() => toggleTaskSubtask(task.id, s.id)} aria-label="Hak av">{CHECK}</button>
                <span className={'subtxt' + (s.done ? ' done' : '')}>{s.text}</span>
                <button type="button" className="subdel" onClick={() => deleteTaskSubtask(task.id, s.id)} aria-label="Slett delpunkt">×</button>
              </div>
            ))}
            <div className="subadd">
              <input value={subVal} placeholder="Legg til delpunkt…" onChange={(e) => setSubVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} />
              <button type="button" disabled={!subVal.trim()} onClick={addSub}>+</button>
            </div>
          </div>

          <button type="button" className="taskU-del-row" onClick={del}><X /> Slett oppgave</button>
        </div>
      )}
    </>
  )

  if (!swipeable) return <div className={taskClass}>{inner}</div>

  return (
    <div className="swipe-wrap">
      <div className="swipe-actions" aria-hidden="true">
        <motion.span className="swipe-act complete" style={{ opacity: completeOpacity }}>{CHECK} Fullfør</motion.span>
        <motion.span className="swipe-act snooze" style={{ opacity: snoozeOpacity }}><Moon /> I morgen</motion.span>
      </div>
      <motion.div className={taskClass + ' swipeable'} drag="x" dragDirectionLock dragSnapToOrigin dragElastic={0.9} style={{ x }} onDragEnd={onDragEnd}>
        {inner}
      </motion.div>
    </div>
  )
}

function Section({ label, count, sub, collapsible, open, onToggle, children }) {
  return (
    <div className="sec">
      <button type={collapsible ? 'button' : undefined} className={'sec-label' + (collapsible ? ' sec-collap' : '')} onClick={collapsible ? onToggle : undefined}>
        {label}
        <span className="ln" />
        {count != null && <span className="ct">{count}</span>}
        {collapsible && <ChevronDown className={'sec-chev' + (open ? ' open' : '')} />}
      </button>
      {sub}
      {(!collapsible || open) && children}
    </div>
  )
}

/* ---------- «I dag»-panel: gjør dagen til hovedsaken ---------- */
function TodayHero({ done, total, remaining, overdue, nextUp, onCarry, onCompleteNext }) {
  const pct = total ? Math.round((done / total) * 100) : 0
  const R = 24
  const C = 2 * Math.PI * R
  const allDone = total > 0 && done === total
  return (
    <div className="today-hero">
      <div className="th-top">
        <div className="th-ring" role="img" aria-label={`${done} av ${total} gjort i dag`}>
          <svg viewBox="0 0 60 60">
            <circle className="th-track" cx="30" cy="30" r={R} />
            <circle className="th-prog" cx="30" cy="30" r={R} style={{ strokeDasharray: C, strokeDashoffset: C * (1 - pct / 100) }} />
          </svg>
          <span className="th-pct">{total ? `${done}/${total}` : '–'}</span>
        </div>
        <div className="th-main">
          <span className="th-lbl">I dag</span>
          <span className="th-sub">
            {total === 0 ? 'ingenting planlagt ennå' : allDone ? 'alt gjort — nyt det 🎉' : `${remaining} igjen · ${done} gjort`}
          </span>
          {overdue > 0 && (
            <button type="button" className="th-carry" onClick={onCarry}>
              {overdue} henger igjen → ta med i dag
            </button>
          )}
        </div>
      </div>
      {nextUp && (
        <button type="button" className="th-next" onClick={onCompleteNext}>
          <span className="th-next-lbl">Neste opp</span>
          <span className="th-next-check" aria-hidden="true">{CHECK}</span>
          <span className="th-next-ttl">{nextUp.isFocus && <Star className="th-next-star" />}{nextUp.title}</span>
        </button>
      )}
    </div>
  )
}

export default function Tasks() {
  const today = todayKey()
  const tom = tomorrowKey()
  const allTasks = useLiveQuery(() => db.tasks.orderBy('sortOrder').reverse().toArray(), [], null)
  const [val, setVal] = useState('')
  const [target, setTarget] = useState('today') // 'today' | 'someday'
  const [openUpcoming, setOpenUpcoming] = useState(true)
  const [openSomeday, setOpenSomeday] = useState(true)
  const [openDone, setOpenDone] = useState(false)
  const scrollRef = useRef(null)

  const parsed = useMemo(() => parseEntry(val), [val])

  if (allTasks === null) return <div className="screen" />

  const open = allTasks.filter((t) => !t.isDone)
  const focus = open.filter((t) => t.isFocus)
  const overdue = open.filter((t) => !t.isFocus && t.dueDate && t.dueDate < today)
  const todayList = open.filter((t) => !t.isFocus && t.dueDate === today)
  const upcoming = open.filter((t) => !t.isFocus && t.dueDate && t.dueDate > today).sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const someday = open.filter((t) => !t.isFocus && !t.dueDate)
  const doneToday = allTasks.filter((t) => t.isDone && t.completedAt && todayKey(new Date(t.completedAt)) === today)

  const todayScope = focus.length + todayList.length + overdue.length
  const totalToday = todayScope + doneToday.length
  const nextUp = focus[0] || todayList[0] || overdue[0] || null

  async function carryOverdue() {
    for (const t of overdue) await setTaskDate(t.id, today)
    vibrate(8)
    toast.message(`${overdue.length} tatt med til i dag`)
  }
  function completeNext() {
    if (!nextUp) return
    vibrate([12, 30, 12])
    setTaskDone(nextUp.id, true)
  }

  async function add() {
    const v = val.trim()
    if (!v) return
    const finalDue = parsed.dueDate !== null ? parsed.dueDate : target === 'someday' ? null : today
    await addTask(parsed.title || v, { dueDate: finalDue, estimate: parsed.time ? null : undefined })
    setVal('')
    vibrate(8)
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
  }

  const previewDate = parsed.dueDate ? dateLabel(parsed.dueDate, today, tom) : null
  const empty = allTasks.length === 0

  return (
    <div className="screen tasks">
      <div className="screen-scroll" ref={scrollRef}>
        <p className="scr-eyebrow">{new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())}</p>
        <div className="scr-top">
          <h1 className="scr-title">{greeting()}, Fabi</h1>
        </div>
        {!empty && (
          <TodayHero
            done={doneToday.length}
            total={totalToday}
            remaining={todayScope}
            overdue={overdue.length}
            nextUp={nextUp}
            onCarry={carryOverdue}
            onCompleteNext={completeNext}
          />
        )}

        {doneToday.length >= 3 && open.length > 0 && (
          <div className="enough-line"><span className="enough-leaf">🌿</span>Du har gjort nok i dag. Resten kan vente med god samvittighet.</div>
        )}

        {empty && (
          <div className="empty">
            <div className="glyph">🌱</div>
            <p className="em-ttl">Blank liste</p>
            <p>Skriv det første du vil få gjort nederst. Prøv «ring tannlegen fredag» — den daterer seg selv.</p>
          </div>
        )}

        {focus.length > 0 && (
          <Section label="I fokus" count={`${focus.length}/3`}>
            {focus.map((t) => <TaskRow key={t.id} task={t} today={today} tom={tom} focusCount={focus.length} />)}
          </Section>
        )}

        {todayList.length > 0 && (
          <Section label="I dag" count={todayList.length}>
            {todayList.map((t) => <TaskRow key={t.id} task={t} today={today} tom={tom} focusCount={focus.length} />)}
          </Section>
        )}

        {overdue.length > 0 && (
          <Section label="Henger igjen" count={overdue.length}>
            {overdue.map((t) => <TaskRow key={t.id} task={t} today={today} tom={tom} focusCount={focus.length} />)}
          </Section>
        )}

        {upcoming.length > 0 && (
          <Section label="Kommende" count={upcoming.length} collapsible open={openUpcoming} onToggle={() => setOpenUpcoming((o) => !o)}>
            {upcoming.map((t) => <TaskRow key={t.id} task={t} today={today} tom={tom} focusCount={focus.length} />)}
          </Section>
        )}

        {someday.length > 0 && (
          <Section label="Når som helst" count={someday.length} collapsible open={openSomeday} onToggle={() => setOpenSomeday((o) => !o)}>
            {someday.map((t) => <TaskRow key={t.id} task={t} today={today} tom={tom} focusCount={focus.length} />)}
          </Section>
        )}

        {doneToday.length > 0 && (
          <Section label="Fullført i dag" count={doneToday.length} collapsible open={openDone} onToggle={() => setOpenDone((o) => !o)}>
            {doneToday.map((t) => <TaskRow key={t.id} task={t} today={today} tom={tom} focusCount={focus.length} />)}
          </Section>
        )}
      </div>

      <div className="screen-bar">
        {(previewDate || val.trim()) && (
          <div className="tasks-preview">
            {previewDate ? (
              <span className="tasks-pchip on"><CalendarPlus /> {previewDate}</span>
            ) : (
              <div className="tasks-target">
                <button type="button" className={target === 'today' ? 'on' : ''} onClick={() => setTarget('today')}>I dag</button>
                <button type="button" className={target === 'someday' ? 'on' : ''} onClick={() => setTarget('someday')}>Når som helst</button>
              </div>
            )}
          </div>
        )}
        <div className="field">
          <input type="text" placeholder="Legg til noe…  «handle melk i morgen»" enterKeyHint="done" value={val}
            onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button type="button" className="field-btn" aria-label="Legg til" disabled={val.trim() === ''} onClick={add}><Plus /></button>
        </div>
      </div>
    </div>
  )
}
