import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listProjects, addProject, updateProject, deleteProject } from '../db.js'
import { vibrate, reduceMotion, autoGrow } from '../lib/fx.js'

const STATUSES = [
  { k: 'aktiv', label: 'Aktiv' },
  { k: 'pause', label: 'Pause' },
  { k: 'ferdig', label: 'Ferdig' },
]
const nextStatus = (s) => STATUSES[(STATUSES.findIndex((x) => x.k === s) + 1) % STATUSES.length].k

function ProjectCard({ project, open, onOpen }) {
  const [note, setNote] = useState(project.note || '')
  const [leaving, setLeaving] = useState(false)
  const noteRef = useRef(null)
  const timer = useRef(null)

  function onNote(e) {
    const v = e.target.value
    setNote(v)
    autoGrow(noteRef.current)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => updateProject(project.id, { note: v }), 400)
  }
  function handleDelete(e) {
    e.stopPropagation()
    setLeaving(true)
    setTimeout(() => deleteProject(project.id), reduceMotion() ? 0 : 340)
  }

  return (
    <div
      className={'card project' + (open ? ' open' : '') + (leaving ? ' leaving' : '')}
      onClick={() => onOpen(project.id)}
    >
      <div className="project-row">
        <span className={'status-pill st-' + project.status}>
          {STATUSES.find((s) => s.k === project.status)?.label}
        </span>
        <div className="project-name">{project.name}</div>
        <button
          type="button"
          className="status-cycle"
          aria-label="Endre status"
          onClick={(e) => {
            e.stopPropagation()
            updateProject(project.id, { status: nextStatus(project.status) })
          }}
        >
          <svg viewBox="0 0 24 24">
            <path d="M21 12a9 9 0 11-2.6-6.4" />
            <path d="M21 4v4h-4" />
          </svg>
        </button>
      </div>

      <div className="project-expand">
        <textarea
          ref={noteRef}
          className="note-ta"
          rows="2"
          placeholder="Notater, neste steg, lenker…"
          value={note}
          onClick={(e) => e.stopPropagation()}
          onChange={onNote}
        />
        <div className="exfoot">
          <button type="button" className="btn btn-danger" onClick={handleDelete}>
            Slett prosjekt
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Projects() {
  const projects = useLiveQuery(() => listProjects(), [], [])
  const [val, setVal] = useState('')
  const [openId, setOpenId] = useState(null)

  const active = projects.filter((p) => p.status !== 'ferdig')
  const done = projects.filter((p) => p.status === 'ferdig')

  async function add() {
    const v = val.trim()
    if (!v) return
    await addProject(v)
    setVal('')
    vibrate(8)
  }
  const onOpen = (id) => setOpenId((cur) => (cur === id ? null : id))

  return (
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Prosjekter</h1>
        <p className="scr-sub">
          {projects.length === 0 ? 'De større tingene.' : `${active.length} i gang · ${done.length} ferdig`}
        </p>

        <div style={{ marginTop: 20 }}>
          {projects.length === 0 ? (
            <div className="empty">
              <div className="glyph">📁</div>
              <p className="em-ttl">Ingen prosjekter enda</p>
              <p>Større ting du jobber mot — en app, en søknad, en reise. Legg til ett nederst.</p>
            </div>
          ) : (
            <>
              {active.map((p) => (
                <ProjectCard key={p.id} project={p} open={openId === p.id} onOpen={onOpen} />
              ))}
              {done.length > 0 && (
                <div className="sec">
                  <div className="sec-label">
                    Ferdig
                    <span className="ln" />
                    <span className="ct">{done.length}</span>
                  </div>
                  {done.map((p) => (
                    <ProjectCard key={p.id} project={p} open={openId === p.id} onOpen={onOpen} />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div className="screen-bar">
        <div className="field">
          <input
            type="text"
            placeholder="Nytt prosjekt…"
            enterKeyHint="done"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button
            type="button"
            className="field-btn"
            aria-label="Legg til prosjekt"
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
