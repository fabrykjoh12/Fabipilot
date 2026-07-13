import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, listProjects, addProject, moveProject, updateProjectItem } from '../../db.js'
import { vibrate } from '../../lib/fx.js'
import { colorVal, touchedText } from './shared.jsx'
import { projectHealth, HEALTH_LABEL } from '../../lib/projectHealth.js'
import { launchChecklist } from '../../lib/launch.js'
import './list.css'

/* Prosjekter som roper på handling: stått stille eller ferdigbygd (klar å levere). */
const ATTENTION = new Set(['stuck', 'ready'])

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
  const [wipDragOver, setWipDragOver] = useState(false)

  const nextByProject = {}
  for (const it of nowItems) if (!nextByProject[it.projectId]) nextByProject[it.projectId] = it

  const statsByProject = {}
  const itemsByProject = {}
  for (const it of allItems) {
    const s = (statsByProject[it.projectId] ||= { total: 0, done: 0 })
    s.total++
    if (it.stage === 'done') s.done++
    ;(itemsByProject[it.projectId] ||= []).push(it)
  }

  const projectById = {}
  for (const p of projects) projectById[p.id] = p

  const healthByProject = {}
  for (const p of projects) healthByProject[p.id] = projectHealth(p, itemsByProject[p.id] || [])

  const wipItems = allItems.filter((i) => i.wip && i.stage !== 'done')

  const active = projects.filter((p) => p.status === 'active')
  const attention = active.filter((p) => ATTENTION.has(healthByProject[p.id].state))
  const activeRest = active.filter((p) => !ATTENTION.has(healthByProject[p.id].state))
  const onice = projects.filter((p) => p.status === 'onice')
  const done = projects.filter((p) => p.status === 'done')

  async function add() {
    const v = val.trim()
    if (!v) return
    await addProject({ name: v, status: 'active' })
    setVal('')
    vibrate(8)
  }

  async function markWip(itemId) {
    const it = allItems.find((i) => i.id === itemId)
    if (it && !it.wip) {
      await updateProjectItem(it, { wip: true })
      vibrate(10)
    }
  }

  function Card({ p, idx, total }) {
    const next = nextByProject[p.id]
    const stat = statsByProject[p.id] || { total: 0, done: 0 }
    const pct = stat.total ? Math.round((stat.done / stat.total) * 100) : 0
    const col = colorVal(p.color)
    const health = healthByProject[p.id] || projectHealth(p, itemsByProject[p.id] || [])
    const launch = launchChecklist(p, itemsByProject[p.id] || [])
    const openCount = stat.total - stat.done
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
        <button type="button" className={'plist-card' + (p.image ? ' has-cover' : '')} onClick={() => onOpen(p.id)} style={{ '--pc': col }}>
          {p.image && (
            <span className="plist-cover">
              <img src={p.image} alt="" loading="lazy" />
            </span>
          )}
          <div className="plist-top">
            <span className="plist-emoji" style={{ background: col + '22' }}>{p.emoji || '🗂️'}</span>
            <span className="plist-name">{p.name}</span>
            <span className={'phealth-badge h-' + health.state}>
              <span className="phb-dot" />{HEALTH_LABEL[health.state]}
            </span>
          </div>
          {stat.total > 0 && (
            <div className="plist-prog">
              <span className="plist-bar"><i style={{ width: pct + '%', background: col }} /></span>
              <span className="plist-pct">{stat.done}/{stat.total}</span>
            </div>
          )}
          <div
            className={'plist-next' + (next ? ' draggable' : '')}
            draggable={!!next}
            onDragStart={(e) => {
              if (!next) return
              e.stopPropagation()
              e.dataTransfer.setData('text/plain', next.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
          >
            {next ? (
              <>
                <span className="plist-dot" style={{ background: col }} />
                {next.text}
              </>
            ) : (
              <span className="plist-empty">Sett et «neste steg»</span>
            )}
          </div>
          <div className="plist-meta">
            <span className="plist-detail">{health.detail || touchedText(p.lastTouched)}</span>
            <span className="plist-badges">
              {openCount > 0 && (
                <span className="plist-chip" title="Åpne steg / prompts i kø">{openCount} i kø</span>
              )}
              {stat.total > 0 && (
                <span className={'plist-chip launch' + (launch.ready ? ' ready' : '')} title="Launch-beredskap">
                  🚀 {launch.doneCount}/{launch.total}
                </span>
              )}
              {p.liveUrl && <span className="plist-ind" title="Har live-lenke">↗</span>}
              {p.repoUrl && <span className="plist-ind" title="Har repo-lenke">⎇</span>}
            </span>
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

        {projects.length > 0 && (
          <div
            className={'plist-wip' + (wipDragOver ? ' drag-over' : '') + (wipItems.length ? '' : ' empty')}
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
            onDragEnter={() => setWipDragOver(true)}
            onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setWipDragOver(false) }}
            onDrop={(e) => {
              e.preventDefault()
              setWipDragOver(false)
              const id = e.dataTransfer.getData('text/plain')
              if (id) markWip(id)
            }}
          >
            <div className="plist-wip-head">
              <span className="plist-wip-dot" />
              <span className="nm">Pågående nå</span>
              <span className="ct">{wipItems.length}</span>
              <span className="note">på tvers av alle prosjekter</span>
            </div>
            {wipItems.length === 0 ? (
              <p className="plist-wip-empty">Dra et «neste steg» hit fra et prosjekt for å markere det som pågående.</p>
            ) : (
              <div className="plist-wip-cards">
                {wipItems.map((i) => {
                  const p = projectById[i.projectId]
                  if (!p) return null
                  const col = colorVal(p.color)
                  return (
                    <button
                      key={i.id}
                      type="button"
                      className="plist-wip-card"
                      style={{ '--pc': col }}
                      onClick={() => onOpen(p.id)}
                    >
                      <span className="plist-wip-proj">{p.emoji || '🗂️'} {p.name}</span>
                      <span className="plist-wip-txt">{i.text}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {projects.length === 0 && (
          <div className="empty">
            <div className="glyph">🛩️</div>
            <p className="em-ttl">Start ditt første prosjekt</p>
            <p>Et prosjekt samler alt: mål, repo- og live-lenker, Claude-kontekst, en roadmap og en prompt-kø.</p>
            <p className="em-flow">Idé → Prosjekt → Roadmap → Prompt-kø → Levert</p>
            <p>Legg til ett nederst — eller forfremm en idé fra idébanken.</p>
          </div>
        )}

        {attention.length > 0 && (
          <div className="sec">
            <div className="sec-label sec-attention">
              Trenger oppmerksomhet<span className="ln" />
              <span className="ct">{attention.length}</span>
            </div>
            <div className="plist-grid">
              {attention.map((p) => (
                <Card key={p.id} p={p} idx={projects.indexOf(p)} total={projects.length} />
              ))}
            </div>
          </div>
        )}

        {activeRest.length > 0 && (
          <div className="sec">
            <div className="sec-label">
              {attention.length > 0 ? 'Andre aktive' : 'Aktive'}<span className="ln" />
              <span className="ct">{activeRest.length}</span>
            </div>
            <div className="plist-grid">
              {activeRest.map((p) => (
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
