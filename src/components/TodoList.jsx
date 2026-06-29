import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listTodos, addTodo, updateTodo, deleteTodo, setTodoDone, moveTodo, addTask, addSubtask, toggleSubtask, deleteSubtask, todayKey } from '../db.js'
import { burst, vibrate, reduceMotion } from '../lib/fx.js'

const CHECK = (
  <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
)
const MND = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
function fmtDue(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${d}. ${MND[m - 1]}`
}
function dueStatus(date, today) {
  if (!date) return ''
  if (date < today) return 'over'
  if (date === today) return 'today'
  return 'future'
}

function TodoItem({ todo, idx, openCount, manual }) {
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [subVal, setSubVal] = useState('')
  const checkRef = useRef(null)
  const done = todo.isDone
  const status = dueStatus(todo.dueDate, todayKey())
  const subs = todo.subtasks || []
  const subsDone = subs.filter((s) => s.done).length

  function addSub() {
    const v = subVal.trim()
    if (!v) return
    addSubtask(todo.id, v)
    setSubVal('')
  }

  function handleCheck() {
    if (done) {
      setTodoDone(todo.id, false)
      return
    }
    setLeaving(true)
    vibrate([12, 30, 12])
    burst(checkRef.current)
    setTimeout(() => setTodoDone(todo.id, true), reduceMotion() ? 0 : 320)
  }

  function startEdit() {
    setEditVal(todo.text)
    setEditing(true)
  }
  function saveEdit() {
    const v = editVal.trim()
    if (v && v !== todo.text) updateTodo(todo.id, { text: v })
    setEditing(false)
  }

  return (
    <div className={'task todo-card' + (done ? ' done' : '') + (leaving ? ' leaving' : '')}>
      <div className="todo-row">
      <div
        ref={checkRef}
        className="check"
        role="checkbox"
        tabIndex={0}
        aria-checked={done}
        aria-label={done ? 'Angre' : 'Fullfør'}
        onClick={handleCheck}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); handleCheck() }
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
        <div className="todo-mid">
          <div className="ttl" onClick={!done ? startEdit : undefined} title={!done ? 'Trykk for å redigere' : undefined}>
            {todo.text}
          </div>
          <div className="todo-meta">
            <label className="todo-date" data-status={status}>
              <input
                type="date"
                value={todo.dueDate || ''}
                onChange={(e) => updateTodo(todo.id, { dueDate: e.target.value || null })}
              />
              🗓 {todo.dueDate ? fmtDue(todo.dueDate) : 'dato'}
            </label>
            {todo.dueDate && (
              <button
                type="button"
                className="todo-date-clear"
                aria-label="Fjern dato"
                onClick={() => updateTodo(todo.id, { dueDate: null })}
              >×</button>
            )}
            {!done && (
              <button
                type="button"
                className="todo-toToday"
                title="Flytt til I dag"
                onClick={async () => { await addTask(todo.text); await deleteTodo(todo.id); vibrate(8) }}
              >→ I dag</button>
            )}
            <button
              type="button"
              className={'todo-subchip' + (subs.length ? '' : ' empty')}
              onClick={() => setExpanded((e) => !e)}
            >
              {subs.length ? `☑ ${subsDone}/${subs.length}` : '+ delpunkter'}
            </button>
          </div>
        </div>
      )}

      {!done && !editing && manual && (
        <div className="todo-acts">
          <button type="button" className="sort-btn" aria-label="Flytt opp" disabled={idx === 0} onClick={() => moveTodo(todo.id, -1)}>▲</button>
          <button type="button" className="sort-btn" aria-label="Flytt ned" disabled={idx === openCount - 1} onClick={() => moveTodo(todo.id, 1)}>▼</button>
        </div>
      )}
      <button
        type="button"
        className="icon-x"
        aria-label="Slett"
        onClick={() => deleteTodo(todo.id)}
      >
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
      </div>

      {expanded && (
        <div className="todo-subs">
          {subs.map((s) => (
            <div key={s.id} className="subrow">
              <button
                type="button"
                className={'subcheck' + (s.done ? ' on' : '')}
                aria-label={s.done ? 'Angre' : 'Fullfør'}
                onClick={() => toggleSubtask(todo.id, s.id)}
              >
                {s.done && CHECK}
              </button>
              <span className={'subtxt' + (s.done ? ' done' : '')}>{s.text}</span>
              <button type="button" className="subdel" aria-label="Slett delpunkt" onClick={() => deleteSubtask(todo.id, s.id)}>×</button>
            </div>
          ))}
          {!done && (
            <div className="subadd">
              <input
                placeholder="Nytt delpunkt…"
                value={subVal}
                onChange={(e) => setSubVal(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSub()}
              />
              <button type="button" disabled={!subVal.trim()} onClick={addSub} aria-label="Legg til delpunkt">+</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TodoList() {
  const todos = useLiveQuery(() => listTodos(), [], [])
  const [val, setVal] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [sortByDate, setSortByDate] = useState(false)

  let open = todos.filter((t) => !t.isDone)
  if (sortByDate) {
    open = [...open].sort((a, b) => {
      if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate)
      if (a.dueDate) return -1
      if (b.dueDate) return 1
      return 0
    })
  }
  const done = todos.filter((t) => t.isDone)

  async function add() {
    const v = val.trim()
    if (!v) return
    await addTodo(v)
    setVal('')
    vibrate(8)
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Liste</h1>
        <p className="scr-sub">
          {todos.length === 0 ? 'Ting å gjøre — når som helst.' : `${open.length} igjen å gjøre`}
        </p>

        {open.length > 1 && (
          <div className="todo-sort">
            <button type="button" className={!sortByDate ? 'active' : ''} onClick={() => setSortByDate(false)}>Manuelt</button>
            <button type="button" className={sortByDate ? 'active' : ''} onClick={() => setSortByDate(true)}>Dato</button>
          </div>
        )}

        <div style={{ marginTop: 16 }}>
          {todos.length === 0 && (
            <div className="empty">
              <div className="glyph">🗒️</div>
              <p className="em-ttl">Tom liste</p>
              <p>Ting du vil få gjort, uten å binde dem til en bestemt dag. Skriv det første nederst.</p>
            </div>
          )}

          {open.map((t, i) => (
            <TodoItem key={t.id} todo={t} idx={i} openCount={open.length} manual={!sortByDate} />
          ))}

          {done.length > 0 && (
            <div className="sec" style={{ marginTop: open.length ? 22 : 0 }}>
              <div
                className="sec-label todo-done-head"
                onClick={() => setShowDone((s) => !s)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setShowDone((s) => !s)}
              >
                Fullført<span className="ln" />
                <span className="ct">{done.length}</span>
                <span className={'todo-chev' + (showDone ? ' open' : '')}>▼</span>
              </div>
              {showDone && done.map((t) => <TodoItem key={t.id} todo={t} idx={0} openCount={0} />)}
            </div>
          )}
        </div>
      </div>

      <div className="screen-bar">
        <div className="field">
          <input
            type="text"
            placeholder="Legg til på lista…"
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
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
