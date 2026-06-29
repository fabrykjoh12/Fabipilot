import { useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  listProjects,
  getProject,
  addProject,
  updateProject,
  deleteProject,
  moveProject,
  setProjectStatus,
  countActiveProjects,
  listProjectItems,
  addProjectItem,
  setItemStage,
  setItemEnergy,
  updateProjectItem,
  deleteProjectItem,
  moveItemToStage,
  reorderItem,
  todayKey,
  MAX_ACTIVE_PROJECTS,
} from '../db.js'
import { burst, vibrate, reduceMotion } from '../lib/fx.js'
import './Projects.css'

const CHECK = (
  <svg viewBox="0 0 24 24">
    <path d="M5 13l4 4L19 7" />
  </svg>
)
const STATUS_LABEL = { active: 'Aktiv', onice: 'På is', done: 'Ferdig' }
const NEXT_STATUS = { active: 'onice', onice: 'done', done: 'active' }
const ENERGY_NEXT = { '': 'lav', lav: 'hoy', hoy: '' }

const PROJECT_COLORS = [
  { k: 'forest', val: '#42634a' },
  { k: 'amber', val: '#cc882b' },
  { k: 'blue', val: '#5f86b0' },
  { k: 'rose', val: '#b4574a' },
  { k: 'plum', val: '#9c7a98' },
  { k: 'slate', val: '#5e6b6f' },
]
const colorVal = (k) => (PROJECT_COLORS.find((c) => c.k === k) || PROJECT_COLORS[0]).val
const PROJECT_EMOJIS = ['🗂️', '🚀', '🏡', '💪', '🎨', '📚', '💻', '🎸', '🌱', '💰', '✈️', '🧩', '🎯', '🔧', '📷', '🍳', '🎬', '🏃']
const MND_KORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
function fmtDeadline(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${d}. ${MND_KORT[m - 1]}`
}

function touchedText(ts) {
  if (!ts) return ''
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return 'Rørt sist i dag'
  if (days === 1) return 'Rørt sist i går'
  return `Rørt sist for ${days} dager siden`
}

/* ===================== PROSJEKTLISTE ===================== */
function ProjectsList({ onOpen }) {
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
    const count = await countActiveProjects()
    const status = count >= MAX_ACTIVE_PROJECTS ? 'onice' : 'active'
    await addProject({ name: v, status })
    setVal('')
    vibrate(8)
    if (status === 'onice') {
      window.alert(
        `Du har allerede ${MAX_ACTIVE_PROJECTS} aktive prosjekter. «${v}» ble lagt «på is». Sett ett aktivt prosjekt på is for å gjøre plass.`,
      )
    }
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
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Prosjekter</h1>
        <p className="scr-sub">
          {active.length} av {MAX_ACTIVE_PROJECTS} aktive
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
              <span className="ct">
                {active.length}/{MAX_ACTIVE_PROJECTS}
              </span>
            </div>
            {active.map((p) => (
              <Card key={p.id} p={p} idx={projects.indexOf(p)} total={projects.length} />
            ))}
          </div>
        )}

        {onice.length > 0 && (
          <div className="sec">
            <div className="sec-label">
              På is<span className="ln" />
              <span className="ct">{onice.length}</span>
            </div>
            {onice.map((p) => (
              <Card key={p.id} p={p} idx={projects.indexOf(p)} total={projects.length} />
            ))}
          </div>
        )}

        {done.length > 0 && (
          <div className="sec">
            <div className="sec-label">
              Ferdig<span className="ln" />
              <span className="ct">{done.length}</span>
            </div>
            {done.map((p) => (
              <Card key={p.id} p={p} idx={projects.indexOf(p)} total={projects.length} />
            ))}
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

/* ===================== ROADMAP (én prosjektside) ===================== */
const MORE = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
)
/* Prioritetsnivåer. Lagres fortsatt som stage-verdiene now/next/later i db-en. */
const STAGE_OPTS = [
  { k: 'now', label: 'Høy' },
  { k: 'next', label: 'Medium' },
  { k: 'later', label: 'Lav' },
]
const PRIO_LABEL = { now: 'Høy prioritet', next: 'Medium', later: 'Lav' }

/* Handlingssheet for ett steg: flytt fritt mellom faser, omroker, fullfør, slett. */
function StepSheet({ item, onClose }) {
  function move(stage) {
    if (stage !== item.stage) moveItemToStage(item, stage)
    onClose()
  }
  function done() {
    vibrate([12, 30, 12])
    setItemStage(item, 'done')
    onClose()
  }
  function remove() {
    if (window.confirm(`Slette «${item.text}»?`)) {
      deleteProjectItem(item)
      onClose()
    }
  }
  return (
    <div className="step-sheet-overlay" onClick={onClose}>
      <div className="step-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="step-grip" />
        <p className="step-sheet-txt">{item.text}</p>

        <span className="step-lbl">Prioritet</span>
        <div className="step-stages">
          {STAGE_OPTS.map((s) => (
            <button
              key={s.k}
              type="button"
              className={'step-stage prio-' + s.k + (item.stage === s.k ? ' on' : '')}
              onClick={() => move(s.k)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <div className="step-reorder">
          <button type="button" onClick={() => reorderItem(item, -1)}>↑ Opp i lista</button>
          <button type="button" onClick={() => reorderItem(item, 1)}>↓ Ned i lista</button>
        </div>

        <button type="button" className="step-done" onClick={done}>✓ Marker som ferdig</button>
        <button type="button" className="step-del" onClick={remove}>Slett steg</button>
      </div>
    </div>
  )
}

function SpineCard({ item, onActions }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')

  function startEdit(e) { e.stopPropagation(); setEditVal(item.text); setEditing(true) }
  function saveEdit() {
    const v = editVal.trim()
    if (v && v !== item.text) updateProjectItem(item, { text: v })
    setEditing(false)
  }

  return (
    <div className="rm-card">
      <button
        type="button"
        className={'energy ' + (item.energy || 'none')}
        aria-label="Energinivå"
        onClick={() => setItemEnergy(item, ENERGY_NEXT[item.energy || ''])}
      />
      {editing ? (
        <input
          className="ctxt-input"
          value={editVal}
          autoFocus
          onChange={(e) => setEditVal(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false) }}
        />
      ) : (
        <span className="ctxt" onClick={startEdit} title="Trykk for å redigere">{item.text}</span>
      )}
      <button type="button" className="rm-more" aria-label="Handlinger" onClick={() => onActions(item)}>
        {MORE}
      </button>
    </div>
  )
}

function StageBlock({ stage, label, note, items, onAdd, onActions }) {
  const cls = stage === 'now' ? 'now' : stage === 'later' ? 'later' : 'next'
  const [val, setVal] = useState('')
  function submit() {
    const v = val.trim()
    if (!v) return
    onAdd(stage, v)
    setVal('')
  }
  return (
    <div className={'stage ' + cls}>
      <div className="stage-head">
        <span className="prio-dot" />
        <span className="nm">{label}</span>
        <span className="ct">{items.length}</span>
        {note && <span className="note">{note}</span>}
      </div>
      {items.length === 0 && (
        <div className="rm-card empty-card">
          <span className="ctxt muted">— tomt —</span>
        </div>
      )}
      {items.map((i) => <SpineCard key={i.id} item={i} onActions={onActions} />)}
      <div className="stage-add">
        <input
          placeholder={`Legg til i ${label}…`}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button type="button" disabled={!val.trim()} onClick={submit} aria-label={`Legg til i ${label}`}>+</button>
      </div>
    </div>
  )
}

function Roadmap({ projectId, onBack }) {
  const project = useLiveQuery(() => getProject(projectId), [projectId])
  const items = useLiveQuery(() => listProjectItems(projectId), [projectId], [])
  const [sheetItem, setSheetItem] = useState(null)
  const [doneCollapsed, setDoneCollapsed] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [editingWhy, setEditingWhy] = useState(false)
  const [editingHero, setEditingHero] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [nameVal, setNameVal] = useState('')
  const [whyVal, setWhyVal] = useState('')
  const [heroVal, setHeroVal] = useState('')
  const [notesVal, setNotesVal] = useState('')
  const heroCheckRef = useRef(null)

  if (!project) return <div className="screen" />

  function startEditName() {
    setNameVal(project.name)
    setEditingName(true)
  }
  async function saveName() {
    const v = nameVal.trim()
    if (v && v !== project.name) await updateProject(project.id, { name: v })
    setEditingName(false)
  }

  function startEditWhy() {
    setWhyVal(project.why || '')
    setEditingWhy(true)
  }
  async function saveWhy() {
    await updateProject(project.id, { why: whyVal.trim() })
    setEditingWhy(false)
  }

  async function handleDelete() {
    if (!window.confirm(`Slett «${project.name}» og alle stegene i det?`)) return
    await deleteProject(project.id)
    onBack()
  }

  const nowItems = items.filter((i) => i.stage === 'now')
  const nextItems = items.filter((i) => i.stage === 'next')
  const laterItems = items.filter((i) => i.stage === 'later')
  const doneItems = items.filter((i) => i.stage === 'done')
  const hero = nowItems[0] || null
  const nowRest = nowItems.slice(1)

  function startEditHero() {
    if (!hero) return
    setHeroVal(hero.text)
    setEditingHero(true)
  }
  function saveHero() {
    const v = heroVal.trim()
    if (hero && v && v !== hero.text) updateProjectItem(hero, { text: v })
    setEditingHero(false)
  }

  const total = items.length
  const pct = total ? Math.round((doneItems.length / total) * 100) : 0
  const col = colorVal(project.color)

  function completeHero() {
    if (!hero) return
    heroCheckRef.current?.classList.add('pop')
    vibrate([12, 30, 12])
    burst(heroCheckRef.current)
    setTimeout(() => setItemStage(hero, 'done'), reduceMotion() ? 0 : 260)
  }

  async function addTo(stage, text) {
    await addProjectItem(projectId, text, stage)
    vibrate(8)
  }

  async function cycleStatus() {
    const target = NEXT_STATUS[project.status]
    const ok = await setProjectStatus(project.id, target)
    if (!ok) {
      window.alert(
        `Du har allerede ${MAX_ACTIVE_PROJECTS} aktive prosjekter. Sett ett av dem «på is» først for å aktivere dette.`,
      )
    }
  }

  return (
    <div className="screen roadmap">
      <div className="screen-scroll">
        <button type="button" className="back" onClick={onBack}>
          ‹ Prosjekter
        </button>

        <div className="phead">
          <button
            type="button"
            className="pemoji-badge"
            style={{ background: col + '22', borderColor: col + '55' }}
            onClick={() => setCustomizing((c) => !c)}
            aria-label="Endre ikon og farge"
          >
            {project.emoji || '🗂️'}
          </button>
          <div className="phead-main">
            {editingName ? (
              <input
                className="pname-input"
                value={nameVal}
                autoFocus
                onChange={(e) => setNameVal(e.target.value)}
                onBlur={saveName}
                onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false) }}
              />
            ) : (
              <h1 className="pname" onClick={startEditName} title="Trykk for å redigere">{project.name}</h1>
            )}
          </div>
          <div className="phead-actions">
            <button type="button" className={'pstatus st-' + project.status} onClick={cycleStatus}>
              {STATUS_LABEL[project.status]}
            </button>
            <button type="button" className="pdel" aria-label="Slett prosjekt" onClick={handleDelete}>
              <svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
            </button>
          </div>
        </div>

        {customizing && (
          <div className="pcustom">
            <div className="pcustom-emojis">
              {PROJECT_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  className={'pemoji-opt' + ((project.emoji || '🗂️') === e ? ' on' : '')}
                  onClick={() => updateProject(project.id, { emoji: e })}
                >
                  {e}
                </button>
              ))}
            </div>
            <div className="pcustom-colors">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c.k}
                  type="button"
                  className={'pcolor' + (project.color === c.k ? ' on' : '')}
                  style={{ background: c.val }}
                  aria-label={c.k}
                  onClick={() => updateProject(project.id, { color: c.k })}
                />
              ))}
            </div>
          </div>
        )}

        {editingWhy ? (
          <div className="pwhy-edit">
            <input
              className="pwhy-input"
              value={whyVal}
              autoFocus
              placeholder="Hvorfor er dette viktig?"
              onChange={(e) => setWhyVal(e.target.value)}
              onBlur={saveWhy}
              onKeyDown={(e) => { if (e.key === 'Enter') saveWhy(); if (e.key === 'Escape') setEditingWhy(false) }}
            />
          </div>
        ) : (
          <p className="pwhy" onClick={startEditWhy} title="Trykk for å redigere">
            {project.why || <span className="pwhy-placeholder">+ Legg til hvorfor…</span>}
          </p>
        )}
        <div className="pmeta-row">
          <label className={'pdeadline' + (project.deadline ? '' : ' unset') + (project.deadline && project.deadline < todayKey() ? ' over' : '')}>
            <input
              type="date"
              value={project.deadline || ''}
              onChange={(e) => updateProject(project.id, { deadline: e.target.value || null })}
            />
            🗓 {project.deadline ? `Frist ${fmtDeadline(project.deadline)}` : 'Sett frist'}
          </label>
          {project.deadline && (
            <button type="button" className="pdeadline-clear" aria-label="Fjern frist" onClick={() => updateProject(project.id, { deadline: null })}>×</button>
          )}
          <span className="ptouch">{touchedText(project.lastTouched)}</span>
        </div>

        {editingNotes ? (
          <textarea
            className="pnotes-input"
            value={notesVal}
            autoFocus
            placeholder="Notater, lenker, tanker…"
            rows={3}
            onChange={(e) => setNotesVal(e.target.value)}
            onBlur={() => { updateProject(project.id, { notes: notesVal.trim() }); setEditingNotes(false) }}
          />
        ) : (
          <p className="pnotes" onClick={() => { setNotesVal(project.notes || ''); setEditingNotes(true) }}>
            {project.notes || <span className="pnotes-placeholder">+ Legg til notat</span>}
          </p>
        )}

        <div className="prog">
          <span className="bar">
            <i style={{ width: pct + '%', background: col }} />
          </span>
          <span className="lbl">
            {doneItems.length} av {total} · {pct}%
          </span>
        </div>

        <div className="pstats">
          <div className="pstat"><b style={{ color: col }}>{nowItems.length}</b><span>Høy</span></div>
          <div className="pstat"><b>{nextItems.length}</b><span>Medium</span></div>
          <div className="pstat"><b>{laterItems.length}</b><span>Lav</span></div>
          <div className="pstat"><b>{doneItems.length}</b><span>Ferdig</span></div>
        </div>

        <div className="hero">
          <p className="tag">Viktigst nå</p>
          {hero ? (
            <div className="hero-row">
              <div ref={heroCheckRef} className="hcheck" onClick={completeHero} role="button" tabIndex={0} aria-label="Fullfør viktigste oppgave" onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && completeHero()}>
                {CHECK}
              </div>
              {editingHero ? (
                <input
                  className="htxt-input"
                  value={heroVal}
                  autoFocus
                  onChange={(e) => setHeroVal(e.target.value)}
                  onBlur={saveHero}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveHero(); if (e.key === 'Escape') setEditingHero(false) }}
                />
              ) : (
                <div className="htxt" onClick={startEditHero} title="Trykk for å redigere">{hero.text}</div>
              )}
            </div>
          ) : (
            <div className="hero-empty">
              Ingenting med høy prioritet ennå. Trykk ⋯ på en oppgave og sett den til «Høy» — bare én. Det er nok.
            </div>
          )}
        </div>

        <div className="road prio-list">
          <StageBlock stage="now" label={PRIO_LABEL.now} note="det viktigste" items={nowRest} onAdd={addTo} onActions={setSheetItem} />
          <StageBlock stage="next" label={PRIO_LABEL.next} items={nextItems} onAdd={addTo} onActions={setSheetItem} />
          <StageBlock stage="later" label={PRIO_LABEL.later} note="ingen press" items={laterItems} onAdd={addTo} onActions={setSheetItem} />
        </div>

        {doneItems.length > 0 && (
          <>
            <div
              className={'done-head' + (doneCollapsed ? ' collapsed' : '')}
              onClick={() => setDoneCollapsed((c) => !c)}
            >
              <span className="nm">Ferdig</span>
              <span className="ct">{doneItems.length}</span>
              <span className="chev">▼</span>
            </div>
            {!doneCollapsed && (
              <div className="done-wrap">
                {doneItems.map((i) => (
                  <button key={i.id} type="button" className="donecard" onClick={() => setSheetItem(i)}>
                    <span className="dot">
                      <svg viewBox="0 0 24 24">
                        <path d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                    <span className="t">{i.text}</span>
                  </button>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {sheetItem && <StepSheet item={sheetItem} onClose={() => setSheetItem(null)} />}
    </div>
  )
}

/* ===================== TOPP ===================== */
export default function Projects() {
  const [selectedId, setSelectedId] = useState(null)
  const exists = useLiveQuery(
    () => (selectedId ? getProject(selectedId) : null),
    [selectedId],
    undefined,
  )

  if (selectedId && exists) {
    return <Roadmap projectId={selectedId} onBack={() => setSelectedId(null)} />
  }
  return <ProjectsList onOpen={setSelectedId} />
}
