import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, listProjects, addProject, moveProject } from '../../db.js'
import { vibrate } from '../../lib/fx.js'
import { STATUS_LABEL, colorVal } from './shared.jsx'
import './list.css'

/* ===================== PROSJEKTLISTE ===================== */
export default function ProjectsList({ onOpen }) {
  const projects = useLiveQuery(() => listProjects(), [], [])
  const nowItems = useLiveQuery(
    () => db.projectItems.where('stage').equals('now').sortBy('sortOrder'),
    [],
    [],
  )
  const allItems = useLiveQuery(() => db.projectItems.toArray(), [], [])
  const [val, setVal] = useState('')

  const nextByProject = {}
  for (const it of nowItems) if (!nextByProject[it.projectId]) nextByProject[it.projectId] = it

  const statsByProject = {}
  for (const it of allItems) {
    const s = (statsByProject[it.projectId] ||= { total: 0, done: 0 })
    s.total++
    if (it.stage === 'done') s.done++
  }

  const active = projects.filter((p) => p.status === 'active')
  const onice = projects.filter((p) => p.status === 'onice')
  const done = projects.filter((p) => p.status === 'done')

  async function add() {
    const v = val.trim()
    if (!v) return
    await addProject({ name: v, status: 'active' })
    setVal('')
    vibrate(8)
  }

  function Card({ p, idx, total }) {
    const next = nextByProject[p.id]
    const stat = statsByProject[p.id] || { total: 0, done: 0 }
    const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 0
    const col = colorVal(p.color)
    return (
      <div className="plist-card-wrap">
        <div className="plist-sort">
          <button
            type="button"
            className="sort-btn"
            aria-label="Flytt opp"
            disabled={idx === 0}
            onClick={(e) => { e.stopPropagation(); moveProject(p.id, -1) }}
          >▲</button>
          <button
            type="button"
            className="sort-btn"
            aria-label="Flytt ned"
            disabled={idx === total - 1}
            onClick={(e) => { e.stopPropagation(); moveProject(p.id, 1) }}
          >▼</button>
        </div>
        <button type="button" className="plist-card" onClick={() => onOpen(p.id)} style={{ '--pc': col }}>
          <div className="plist-top">
            <span className="plist-emoji" style={{ background: col + '22' }}>{p.emoji || '🗂️'}</span>
            <span className="plist-name">{p.name}</span>
            <span className={'pstatus st-' + p.status}>{STATUS_LABEL[p.status]}</span>
          </div>
          {stat.total > 0 && (
            <div className="plist-prog">
              <span className="plist-bar"><i style={{ width: pct + '%', background: col }} /></span>
              <span className="plist-pct">{stat.done}/{stat.total}</span>
            </div>
          )}
          <div className="plist-next">
            {next ? (
              <>
                <span className="plist-dot" style={{ background: col }} />
                {next.text}
              </>
            ) : (
              <span className="plist-empty">Ingen «neste steg» satt</span>
            )}
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="screen projects-screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Prosjekter</h1>
        <p className="scr-sub">
          {active.length} {active.length === 1 ? 'aktivt' : 'aktive'}
          {onice.length ? ` · ${onice.length} på is` : ''}
        </p>

        {projects.length === 0 && (
          <div className="empty">
            <div className="glyph">🗺️</div>
            <p className="em-ttl">Ingen prosjekter enda</p>
            <p>De større tingene du jobber mot. Legg til ett nederst — eller forfremm en idé fra idébanken.</p>
          </div>
        )}

        {active.length > 0 && (
          <div className="sec">
            <div className="sec-label">
              Aktive<span className="ln" />
              <span className="ct">{active.length}</span>
            </div>
            <div className="plist-grid">
              {active.map((p) => (
                <Card key={p.id} p={p} idx={projects.indexOf(p)} total={projects.length} />
              ))}
            </div>
          </div>
        )}

        {onice.length > 0 && (
          <div className="sec">
            <div className="sec-label">
              På is<span className="ln" />
              <span className="ct">{onice.length}</span>
            </div>
            <div className="plist-grid">
              {onice.map((p) => (
                <Card key={p.id} p={p} idx={projects.indexOf(p)} total={projects.length} />
              ))}
            </div>
          </div>
        )}

        {done.length > 0 && (
          <div className="sec">
            <div className="sec-label">
              Ferdig<span className="ln" />
              <span className="ct">{done.length}</span>
            </div>
            <div className="plist-grid">
              {done.map((p) => (
                <Card key={p.id} p={p} idx={projects.indexOf(p)} total={projects.length} />
              ))}
            </div>
          </div>
        )}
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
