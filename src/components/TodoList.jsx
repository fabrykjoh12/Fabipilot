import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listTodos, addTodo, updateTodo, deleteTodo, setTodoDone, moveTodo } from '../db.js'
import { burst, vibrate, reduceMotion } from '../lib/fx.js'

const CHECK = (
  <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
)

function TodoItem({ todo, idx, openCount }) {
  const [leaving, setLeaving] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const checkRef = useRef(null)
  const done = todo.isDone

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
    <div className={'task' + (done ? ' done' : '') + (leaving ? ' leaving' : '')}>
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
        <div className="ttl" onClick={!done ? startEdit : undefined} title={!done ? 'Trykk for å redigere' : undefined}>
          {todo.text}
        </div>
      )}

      {!done && !editing && (
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
  )
}

export default function TodoList() {
  const todos = useLiveQuery(() => listTodos(), [], [])
  const [val, setVal] = useState('')
  const [showDone, setShowDone] = useState(false)

  const open = todos.filter((t) => !t.isDone)
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

        <div style={{ marginTop: 20 }}>
          {todos.length === 0 && (
            <div className="empty">
              <div className="glyph">🗒️</div>
              <p className="em-ttl">Tom liste</p>
              <p>Ting du vil få gjort, uten å binde dem til en bestemt dag. Skriv det første nederst.</p>
            </div>
          )}

          {open.map((t, i) => (
            <TodoItem key={t.id} todo={t} idx={i} openCount={open.length} />
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
