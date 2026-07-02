import { useState } from 'react'
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
  listProjectItems,
  addProjectItem,
  setItemStage,
  setItemEnergy,
  updateProjectItem,
  deleteProjectItem,
  addItemSubtask,
  toggleItemSubtask,
  deleteItemSubtask,
  moveItemToStage,
  reorderItem,
  restoreRecord,
  shareProject,
  listProjectMembers,
  removeProjectMember,
  stopSharingProject,
  todayKey,
} from '../db.js'
import { vibrate } from '../lib/fx.js'
import { toast, ScreenSkeleton, useEscape } from '../lib/ui.jsx'
import './Projects.css'

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

/* ===================== ROADMAP (én prosjektside) ===================== */
const MORE = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
)
const COPY = (
  <svg viewBox="0 0 24 24">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
)
/* Prosjektkontekst-blokk som limes foran prompts. Selve prompt-teksten er
   på engelsk (brukeren jobber på engelsk med Claude); appen ellers er norsk. */
function projectContext(project) {
  const ctx = []
  if (project?.name) ctx.push(`Project: ${project.name}`)
  if (project?.why) ctx.push(`Goal: ${project.why}`)
  if (project?.context) ctx.push(`Context: ${project.context}`)
  if (project?.liveUrl) ctx.push(`Live: ${project.liveUrl}`)
  if (project?.repoUrl) ctx.push(`Repo: ${project.repoUrl}`)
  return ctx.join('\n')
}
/* Setter sammen ett steg til en ferdig prompt med prosjektkontekst foran,
   klar til å lime inn i Claude/Codex. Uten kontekst → bare teksten. */
function buildPrompt(project, text) {
  const header = projectContext(project)
  return header ? `${header}\n\nTask:\n${text}` : text
}
/* Setter sammen ALLE steg til én nummerert liste — «alt jeg vil at Claude skal gjøre». */
function buildAllPrompts(project, items) {
  const header = projectContext(project)
  const list = items.map((it, i) => `${i + 1}. ${it.text}`).join('\n')
  const body = `Here's everything I want you to do:\n\n${list}`
  return header ? `${header}\n\n${body}` : body
}
function hasContext(project) {
  return !!(project?.why || project?.context || project?.liveUrl || project?.repoUrl)
}

/* AI-arbeidsflyt: hvor i Claude-loopen et steg er. */
const AI_NEXT = { idea: 'asked', asked: 'built', built: 'verified', verified: 'idea' }

/* Prompt-maler — ett klikk for å starte en vanlig type prompt. */
/* Maler med utfyllingsfelt. `build(v)` setter sammen den ferdige prompten
   fra feltene. Felt med `optional` teller ikke mot «kan legges til». */
const PROMPT_TEMPLATES = [
  {
    key: 'component', emoji: '✨', label: 'Komponent',
    fields: [
      { key: 'what', label: 'Hva skal lages?', placeholder: 'en priskalkulator' },
      { key: 'does', label: 'Hva skal den gjøre?', placeholder: 'regne ut månedspris ut fra antall brukere', big: true },
    ],
    build: (v) => `Build ${v.what || '…'}.\nIt should ${v.does || '…'}.`,
  },
  {
    key: 'bug', emoji: '🐛', label: 'Fiks bug',
    fields: [
      { key: 'problem', label: 'Hva er feil?', placeholder: 'knappen gjør ingenting når jeg trykker', big: true },
      { key: 'expected', label: 'Hva forventet du?', placeholder: 'at skjemaet sendes inn' },
    ],
    build: (v) => `Fix this bug: ${v.problem || '…'}\nExpected: ${v.expected || '…'}`,
  },
  {
    key: 'design', emoji: '🎨', label: 'Design',
    fields: [
      { key: 'what', label: 'Hva skal forbedres?', placeholder: 'forsiden / en knapp / kortene' },
      { key: 'how', label: 'Hvordan? (mer/mindre av …)', placeholder: 'luftigere, større tekst, roligere farger', big: true },
    ],
    build: (v) => `Improve the design of ${v.what || '…'}.\nMake it ${v.how || '…'}.`,
  },
  {
    key: 'feature', emoji: '➕', label: 'Ny funksjon',
    fields: [
      { key: 'what', label: 'Hvilken funksjon?', placeholder: 'søkefelt / mørk modus' },
      { key: 'detail', label: 'Hvordan skal den funke?', placeholder: 'filtrerer lista mens jeg skriver', big: true },
    ],
    build: (v) => `Add ${v.what || '…'}.\nIt should ${v.detail || '…'}.`,
  },
  {
    key: 'refactor', emoji: '♻️', label: 'Refaktorer',
    fields: [
      { key: 'what', label: 'Hva skal ryddes?', placeholder: 'denne komponenten / denne filen' },
      { key: 'goal', label: 'Mål med opprydningen', placeholder: 'lettere å lese, mindre gjentakelse', big: true },
    ],
    build: (v) => `Refactor ${v.what || '…'} so that it becomes ${v.goal || '…'}.`,
  },
  {
    key: 'blank', emoji: '✍️', label: 'Tom',
    fields: [
      { key: 'text', label: 'Prompt', placeholder: 'Skriv hva du vil be Claude om …', big: true },
    ],
    build: (v) => v.text || '',
  },
]
const AI_LABEL = { idea: 'Idé', asked: 'Spurt', built: 'Bygd', verified: 'Verifisert' }

/* Prioritetsnivåer. Lagres fortsatt som stage-verdiene now/next/later i db-en. */
const STAGE_OPTS = [
  { k: 'now', label: 'Høy' },
  { k: 'next', label: 'Medium' },
  { k: 'later', label: 'Lav' },
]
const PRIO_LABEL = { now: 'Høy prioritet', next: 'Medium', later: 'Lav' }

/* Handlingssheet for ett steg: flytt fritt mellom faser, omroker, fullfør, slett. */
function StepSheet({ item, onClose }) {
  useEscape(onClose)
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
    deleteProjectItem(item)
    toast.message(`Slettet «${item.text}»`, {
      action: { label: 'Angre', onClick: () => restoreRecord('projectItems', item) },
    })
    onClose()
  }
  function toggleWip() {
    updateProjectItem(item, { wip: !item.wip })
    vibrate(8)
    onClose()
  }
  return (
    <div className="step-sheet-overlay" onClick={onClose}>
      <div className="step-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="step-grip" />
        <p className="step-sheet-txt">{item.text}</p>

        <button type="button" className={'step-wip' + (item.wip ? ' on' : '')} onClick={toggleWip}>
          {item.wip ? '● Ta ut av pågående' : '○ Sett som pågående'}
        </button>

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

function SpineCard({ item, onActions, project }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [expanded, setExpanded] = useState(false)
  const [subVal, setSubVal] = useState('')
  const [dragging, setDragging] = useState(false)
  const subs = item.subtasks || []
  const subsDone = subs.filter((s) => s.done).length
  const ai = item.aiStatus || 'idea'
  const resultUrl = (item.result || '').match(/https?:\/\/\S+/)?.[0] || null

  function startEdit(e) { e.stopPropagation(); setEditVal(item.text); setEditing(true) }
  function saveEdit() {
    const v = editVal.trim()
    if (v && v !== item.text) updateProjectItem(item, { text: v })
    setEditing(false)
  }
  function addSub() {
    const v = subVal.trim()
    if (!v) return
    addItemSubtask(item, v)
    setSubVal('')
  }
  async function copy(e) {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(buildPrompt(project, item.text))
      vibrate(8)
      toast.success(hasContext(project) ? 'Kopiert som prompt' : 'Kopiert')
    } catch {
      toast.error('Kunne ikke kopiere')
    }
  }
  function cycleAi(e) {
    e.stopPropagation()
    updateProjectItem(item, { aiStatus: AI_NEXT[ai] })
    vibrate(6)
  }

  return (
    <div
      className={'rm-card rm-card-col' + (dragging ? ' dragging' : '')}
      draggable={!editing}
      onDragStart={(e) => { e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.effectAllowed = 'move'; setDragging(true) }}
      onDragEnd={() => setDragging(false)}
    >
      <div className="rm-row">
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
        <div className="rm-actions">
        <button type="button" className={'ai-pill ai-' + ai} onClick={cycleAi} title="Bytt status i Claude-loopen">
          {AI_LABEL[ai]}
        </button>
        {item.result ? (
          <button type="button" className="rm-result-dot" title="Har resultat — trykk for å se" onClick={() => setExpanded((e) => !e)}>
            📎
          </button>
        ) : null}
        <button
          type="button"
          className={'rm-subchip' + (subs.length ? '' : ' empty')}
          onClick={() => setExpanded((e) => !e)}
        >
          {subs.length ? `☑ ${subsDone}/${subs.length}` : '+'}
        </button>
        <button type="button" className="rm-copy" aria-label="Kopier som prompt" onClick={copy}>
          {COPY}
        </button>
        <button type="button" className="rm-more" aria-label="Handlinger" onClick={() => onActions(item)}>
          {MORE}
        </button>
        </div>
      </div>

      {expanded && (
        <div className="rm-subs">
          {subs.map((s) => (
            <div key={s.id} className="subrow">
              <button type="button" className={'subcheck' + (s.done ? ' on' : '')} aria-label={s.done ? 'Angre' : 'Fullfør'} onClick={() => toggleItemSubtask(item, s.id)}>
                {s.done && <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>}
              </button>
              <span className={'subtxt' + (s.done ? ' done' : '')}>{s.text}</span>
              <button type="button" className="subdel" aria-label="Slett" onClick={() => deleteItemSubtask(item, s.id)}>×</button>
            </div>
          ))}
          <div className="subadd">
            <input placeholder="Nytt delpunkt…" value={subVal} onChange={(e) => setSubVal(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addSub()} />
            <button type="button" disabled={!subVal.trim()} onClick={addSub} aria-label="Legg til delpunkt">+</button>
          </div>

          <div className="rm-result">
            <span className="rm-result-lbl">Resultat / svar</span>
            <textarea
              className="rm-result-input"
              rows={2}
              placeholder="Lim inn Claude-svaret, PR-lenken eller et notat om hva som skjedde…"
              defaultValue={item.result || ''}
              onBlur={(e) => {
                const v = e.target.value.trim()
                if (v !== (item.result || '')) updateProjectItem(item, { result: v })
              }}
            />
            {resultUrl && (
              <a className="rm-result-link" href={resultUrl} target="_blank" rel="noreferrer">↗ Åpne lenke</a>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* «Pågående»-lane øverst på tavla: det du fikser akkurat nå. Full bredde,
   egen dropp-sone (setter wip=true); prioritet beholdes under. */
function WipLane({ items, onActions, onDropWip, project }) {
  const [dragOver, setDragOver] = useState(false)
  return (
    <div
      className={'rm-wip' + (dragOver ? ' drag-over' : '') + (items.length ? '' : ' empty')}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) onDropWip(id) }}
    >
      <div className="rm-wip-head">
        <span className="rm-wip-dot" />
        <span className="nm">Pågående</span>
        <span className="ct">{items.length}</span>
        <span className="note">det jeg fikser nå</span>
      </div>
      {items.length === 0 ? (
        <p className="rm-wip-empty">Dra hit det du jobber med nå — eller merk et steg som «pågående» via ⋯</p>
      ) : (
        <div className="rm-wip-cards">
          {items.map((i) => <SpineCard key={i.id} item={i} onActions={onActions} project={project} />)}
        </div>
      )}
    </div>
  )
}

function StageBlock({ stage, label, note, items, onAdd, onActions, onDropTo, project }) {
  const cls = stage === 'now' ? 'now' : stage === 'later' ? 'later' : 'next'
  const [val, setVal] = useState('')
  const [dragOver, setDragOver] = useState(false)
  function submit() {
    const v = val.trim()
    if (!v) return
    onAdd(stage, v)
    setVal('')
  }
  return (
    <div
      className={'stage ' + cls + (dragOver ? ' drag-over' : '')}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move' }}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); const id = e.dataTransfer.getData('text/plain'); if (id) onDropTo(stage, id) }}
    >
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
      {items.map((i) => <SpineCard key={i.id} item={i} onActions={onActions} project={project} />)}
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

/* Kø-/fokusmodus: jobb gjennom prompts én om gangen — kopier, åpne Claude,
   marker «spurt», neste. Jobber på et øyeblikksbilde av køen (stabil rekkefølge). */
function PromptQueue({ items, project, onClose }) {
  useEscape(onClose)
  const [idx, setIdx] = useState(0)
  const [resOpen, setResOpen] = useState(false)
  const [resVal, setResVal] = useState('')
  const atEnd = idx >= items.length
  const item = items[idx]

  function copy() {
    navigator.clipboard.writeText(buildPrompt(project, item.text))
      .then(() => { vibrate(8); toast.success(hasContext(project) ? 'Kopiert som prompt' : 'Kopiert') })
      .catch(() => toast.error('Kunne ikke kopiere'))
  }
  function openClaude() {
    copy()
    window.open('https://claude.ai/new', '_blank', 'noopener')
  }
  function next() {
    setResOpen(false)
    setResVal('')
    setIdx((i) => i + 1)
  }
  function markAsked() {
    updateProjectItem(item, { aiStatus: 'asked' })
    next()
  }
  function saveResult() {
    const v = resVal.trim()
    if (!v) return
    updateProjectItem(item, { result: v, aiStatus: 'built' })
    vibrate(8)
    toast.success('Resultat lagret — steget er «Bygd»')
    next()
  }

  return (
    <div className="pq-overlay" onClick={onClose}>
      <div className="pq" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pq-top">
          <span className="pq-count">{Math.min(idx + 1, items.length)} / {items.length}</span>
          <button type="button" className="pq-close" onClick={onClose} aria-label="Lukk">×</button>
        </div>
        {atEnd ? (
          <div className="pq-done">
            <div className="pq-done-glyph">🎉</div>
            <p className="pq-done-ttl">Køen er gjennomgått</p>
            <button type="button" className="pq-cta" onClick={onClose}>Ferdig</button>
          </div>
        ) : (
          <>
            <p className="pq-eyebrow">Prompt · {PRIO_LABEL[item.stage] || ''}</p>
            <p className="pq-text">{item.text}</p>
            <div className="pq-actions">
              <button type="button" className="pq-claude" onClick={openClaude}>Åpne Claude ↗</button>
              <button type="button" className="pq-copy" onClick={copy}>⧉ Kopier prompt</button>
            </div>
            <div className="pq-nav">
              <button type="button" className="pq-skip" onClick={next}>Hopp over →</button>
              <button type="button" className="pq-mark" onClick={markAsked}>✓ Spurt — neste</button>
            </div>

            {resOpen ? (
              <div className="pq-result">
                <textarea
                  className="pq-result-input"
                  rows={3}
                  autoFocus
                  placeholder="Lim inn svaret, PR-lenken eller hva som skjedde…"
                  value={resVal}
                  onChange={(e) => setResVal(e.target.value)}
                />
                <button type="button" className="pq-result-save" disabled={!resVal.trim()} onClick={saveResult}>
                  Lagre resultat — «Bygd» ✓
                </button>
              </div>
            ) : (
              <button type="button" className="pq-result-toggle" onClick={() => setResOpen(true)}>
                📎 Lim inn resultat…
              </button>
            )}

            {idx > 0 && (
              <button type="button" className="pq-prev" onClick={() => { setResOpen(false); setResVal(''); setIdx((i) => Math.max(0, i - 1)) }}>‹ Forrige</button>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* Mal-komposer: velg mal, fyll inn enkle felt (med hint), se live
   forhåndsvisning, velg prioritet, legg til. */
function PromptComposer({ template, onSwitch, onAdd, onClose }) {
  useEscape(onClose)
  const [vals, setVals] = useState({})
  const [stage, setStage] = useState('next')
  const preview = template.build(vals).trim()
  const ready = template.fields.every((f) => (vals[f.key] || '').trim())

  function set(key, v) { setVals((p) => ({ ...p, [key]: v })) }
  function pickTemplate(t) {
    if (t.key === template.key) return
    setVals({})
    onSwitch(t)
  }

  return (
    <div className="pcomp-overlay" onClick={onClose}>
      <div className="pcomp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pcomp-grip" />
        <div className="pcomp-tabs">
          {PROMPT_TEMPLATES.map((t) => (
            <button
              key={t.key}
              type="button"
              className={'pcomp-tab' + (t.key === template.key ? ' on' : '')}
              onClick={() => pickTemplate(t)}
            >
              <span className="tpl-emoji">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>

        <div className="pcomp-fields">
          {template.fields.map((f, i) => (
            <label key={f.key} className="pcomp-field">
              <span className="pcomp-flbl">{f.label}</span>
              {f.big ? (
                <textarea
                  className="pcomp-input"
                  rows={2}
                  autoFocus={i === 0}
                  placeholder={f.placeholder}
                  value={vals[f.key] || ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              ) : (
                <input
                  className="pcomp-input"
                  autoFocus={i === 0}
                  placeholder={f.placeholder}
                  value={vals[f.key] || ''}
                  onChange={(e) => set(f.key, e.target.value)}
                />
              )}
            </label>
          ))}
        </div>

        <div className="pcomp-preview">
          <span className="pcomp-plbl">Forhåndsvisning</span>
          {preview
            ? <p className="pcomp-ptext">{preview}</p>
            : <p className="pcomp-phint">Fyll inn feltene …</p>}
        </div>

        <div className="pcomp-prio">
          <span className="pcomp-prio-lbl">Prioritet</span>
          {STAGE_OPTS.map((s) => (
            <button
              key={s.k}
              type="button"
              className={'pcomp-prio-btn prio-' + s.k + (stage === s.k ? ' on' : '')}
              onClick={() => setStage(s.k)}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button type="button" className="pcomp-add" disabled={!ready} onClick={() => onAdd(preview, stage)}>
          Legg til prompt
        </button>
      </div>
    </div>
  )
}

/* Del et helt prosjekt via e-post (Dexie Cloud realm). */
function ShareSheet({ project, onClose }) {
  useEscape(onClose)
  const members = useLiveQuery(() => listProjectMembers(project.id).catch(() => []), [project.id], [])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const myId = db.cloud?.currentUserId
  const shared = members.length > 0

  async function invite() {
    const e = email.trim()
    if (!e) return
    try {
      await shareProject(project.id, e)
      setMsg(`Invitasjon sendt til ${e.toLowerCase()} ✓`)
      setEmail('')
      vibrate(8)
    } catch (err) {
      setMsg('Kunne ikke dele: ' + (err?.message || err))
    }
  }
  async function stop() {
    await stopSharingProject(project.id)
    setMsg('Deling avsluttet.')
  }

  return (
    <div className="pcomp-overlay" onClick={onClose}>
      <div className="pcomp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pcomp-grip" />
        <h2 className="share-title">Del «{project.name}»</h2>
        <p className="share-sub">Inviter noen på e-post — de får hele prosjektet med stegene, og dere jobber i samme tavle.</p>
        <div className="share-invite">
          <input
            type="email"
            placeholder="navn@epost.no"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invite()}
          />
          <button type="button" disabled={!email.trim()} onClick={invite}>Send</button>
        </div>
        {msg && <p className="share-msg">{msg}</p>}
        {members.length > 0 && (
          <ul className="share-members">
            {members.map((m) => (
              <li key={m.id}>
                <span className="share-mail">{m.email || m.userId || '—'}{m.userId === myId ? ' (deg)' : ''}</span>
                <span className="share-state">{m.accepted ? 'med' : m.invite ? 'invitert' : ''}</span>
                {m.userId !== myId && (
                  <button type="button" className="share-remove" aria-label="Fjern" onClick={() => removeProjectMember(m.id)}>×</button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="share-hint">Begge må være innlogget med hver sin e-post. Personen får invitasjonen i appen neste gang de logger inn. Bare dette prosjektet deles.</p>
        {shared && <button type="button" className="share-stop" onClick={stop}>Slutt å dele</button>}
      </div>
    </div>
  )
}

function Roadmap({ projectId, onBack }) {
  const project = useLiveQuery(() => getProject(projectId), [projectId])
  const items = useLiveQuery(() => listProjectItems(projectId), [projectId], [])
  const [sheetItem, setSheetItem] = useState(null)
  const [shareOpen, setShareOpen] = useState(false)
  const [doneCollapsed, setDoneCollapsed] = useState(true)
  const [editingName, setEditingName] = useState(false)
  const [editingWhy, setEditingWhy] = useState(false)
  const [customizing, setCustomizing] = useState(false)
  const [editingNotes, setEditingNotes] = useState(false)
  const [editingContext, setEditingContext] = useState(false)
  const [linksEditing, setLinksEditing] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const [composerTpl, setComposerTpl] = useState(null)
  const [quickVal, setQuickVal] = useState('')
  const [nameVal, setNameVal] = useState('')
  const [whyVal, setWhyVal] = useState('')
  const [notesVal, setNotesVal] = useState('')
  const [contextVal, setContextVal] = useState('')
  const [liveVal, setLiveVal] = useState('')
  const [repoVal, setRepoVal] = useState('')

  if (!project) return <ScreenSkeleton />

  function openLinksEdit() {
    setLiveVal(project.liveUrl || '')
    setRepoVal(project.repoUrl || '')
    setLinksEditing(true)
  }
  function saveLinks() {
    const norm = (u) => {
      const v = u.trim()
      if (!v) return ''
      return /^https?:\/\//i.test(v) ? v : 'https://' + v
    }
    updateProject(project.id, { liveUrl: norm(liveVal), repoUrl: norm(repoVal) })
    setLinksEditing(false)
  }

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
    const itemsCopy = items.slice()
    await deleteProject(project.id)
    toast.message(`Slettet «${project.name}»`, {
      action: {
        label: 'Angre',
        onClick: async () => {
          await db.projects.add(project)
          if (itemsCopy.length) await db.projectItems.bulkAdd(itemsCopy)
        },
      },
    })
    onBack()
  }

  const wipItems = items.filter((i) => i.wip && i.stage !== 'done')
  const nowItems = items.filter((i) => i.stage === 'now' && !i.wip)
  const nextItems = items.filter((i) => i.stage === 'next' && !i.wip)
  const laterItems = items.filter((i) => i.stage === 'later' && !i.wip)
  const doneItems = items.filter((i) => i.stage === 'done')
  const queue = [...wipItems, ...nowItems, ...nextItems, ...laterItems]

  const total = items.length
  const pct = total ? Math.round((doneItems.length / total) * 100) : 0
  const col = colorVal(project.color)

  async function addTo(stage, text) {
    await addProjectItem(projectId, text, stage)
    vibrate(8)
  }

  async function addQuick() {
    const lines = quickVal.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    for (const line of lines) await addProjectItem(projectId, line, 'next')
    setQuickVal('')
    vibrate(8)
  }

  async function copyAll() {
    try {
      await navigator.clipboard.writeText(buildAllPrompts(project, queue))
      vibrate(8)
      toast.success(`Kopierte ${queue.length} ${queue.length === 1 ? 'prompt' : 'prompts'}`, {
        description: 'Lim inn i Claude som én liste.',
      })
    } catch {
      toast.error('Kunne ikke kopiere')
    }
  }

  function onDropTo(stage, itemId) {
    const it = items.find((i) => i.id === itemId)
    if (!it) return
    if (it.stage !== stage || it.wip) {
      updateProjectItem(it, { stage, wip: false })
      vibrate(10)
    }
  }

  function onDropWip(itemId) {
    const it = items.find((i) => i.id === itemId)
    if (it && !it.wip) {
      updateProjectItem(it, { wip: true })
      vibrate(10)
    }
  }

  async function addComposed(text, stage) {
    await addProjectItem(projectId, text, stage)
    vibrate(8)
    setComposerTpl(null)
    toast.success('Prompt lagt til', { description: `Havnet i ${PRIO_LABEL[stage]}.` })
  }

  function cycleStatus() {
    setProjectStatus(project.id, NEXT_STATUS[project.status])
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
          {queue.length > 0 && (
            <div className="phead-run">
              <button type="button" className="prun" onClick={() => setQueueOpen(true)}>
                ▶ Kjør prompts <span className="prun-ct">{queue.length}</span>
              </button>
              <button type="button" className="pcopyall" onClick={copyAll} title="Kopier alle som én liste">
                {COPY} Kopier alle
              </button>
            </div>
          )}
          <div className="phead-actions">
            <button type="button" className={'pstatus st-' + project.status} onClick={cycleStatus}>
              {STATUS_LABEL[project.status]}
            </button>
            <button type="button" className="pshare" aria-label="Del prosjekt" title="Del prosjekt" onClick={() => setShareOpen(true)}>
              <svg viewBox="0 0 24 24"><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" /></svg>
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

        <div className="rm-workspace">
        <aside className="rm-rail">
        {linksEditing ? (
          <div className="plinks-edit">
            <input className="plink-input" placeholder="Live-URL (min-side.vercel.app)" value={liveVal} autoFocus onChange={(e) => setLiveVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveLinks(); if (e.key === 'Escape') setLinksEditing(false) }} />
            <input className="plink-input" placeholder="Repo-URL (github.com/…)" value={repoVal} onChange={(e) => setRepoVal(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveLinks(); if (e.key === 'Escape') setLinksEditing(false) }} />
            <button type="button" className="plink-save" onClick={saveLinks}>Lagre lenker</button>
          </div>
        ) : project.liveUrl || project.repoUrl ? (
          <div className="plinks">
            {project.liveUrl && <a className="plink plink-live" href={project.liveUrl} target="_blank" rel="noreferrer">↗ Live</a>}
            {project.repoUrl && <a className="plink plink-repo" href={project.repoUrl} target="_blank" rel="noreferrer">⎇ Repo</a>}
            <button type="button" className="plink-editbtn" onClick={openLinksEdit} aria-label="Rediger lenker">✎</button>
          </div>
        ) : (
          <button type="button" className="plinks-add" onClick={openLinksEdit}>+ Live-URL / repo</button>
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

        {editingContext ? (
          <textarea
            className="pcontext-input"
            value={contextVal}
            autoFocus
            placeholder="Stack, konvensjoner, mappestruktur… Blir limt inn foran hver prompt du kopierer."
            rows={3}
            onChange={(e) => setContextVal(e.target.value)}
            onBlur={() => { updateProject(project.id, { context: contextVal.trim() }); setEditingContext(false) }}
          />
        ) : (
          <button type="button" className="pcontext" onClick={() => { setContextVal(project.context || ''); setEditingContext(true) }}>
            <span className="pcontext-lbl">🧠 Claude-kontekst</span>
            {project.context
              ? <span className="pcontext-txt">{project.context}</span>
              : <span className="pcontext-placeholder">+ stack &amp; konvensjoner — blir med i hver prompt</span>}
          </button>
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
        </aside>

        <section className="rm-board">
        <div className="rm-quickadd">
          <textarea
            className="rm-quickadd-input"
            placeholder="Skriv en idé eller prompt til prosjektet…  (Enter for å legge til, Shift+Enter for ny linje)"
            value={quickVal}
            rows={2}
            onChange={(e) => setQuickVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addQuick() } }}
          />
          <button type="button" className="rm-quickadd-btn" disabled={!quickVal.trim()} onClick={addQuick}>
            Legg til
          </button>
        </div>
        <div className="tpl-bar">
          <span className="tpl-lbl">eller mal</span>
          {PROMPT_TEMPLATES.map((t) => (
            <button key={t.key} type="button" className="tpl-chip" onClick={() => setComposerTpl(t)}>
              <span className="tpl-emoji">{t.emoji}</span>{t.label}
            </button>
          ))}
        </div>
        <WipLane items={wipItems} onActions={setSheetItem} onDropWip={onDropWip} project={project} />
        <div className="road prio-list">
          <StageBlock stage="now" label={PRIO_LABEL.now} note="det viktigste" items={nowItems} onAdd={addTo} onActions={setSheetItem} onDropTo={onDropTo} project={project} />
          <StageBlock stage="next" label={PRIO_LABEL.next} items={nextItems} onAdd={addTo} onActions={setSheetItem} onDropTo={onDropTo} project={project} />
          <StageBlock stage="later" label={PRIO_LABEL.later} note="ingen press" items={laterItems} onAdd={addTo} onActions={setSheetItem} onDropTo={onDropTo} project={project} />
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
        </section>
        </div>
      </div>

      {sheetItem && <StepSheet item={sheetItem} onClose={() => setSheetItem(null)} />}
      {queueOpen && queue.length > 0 && (
        <PromptQueue items={queue} project={project} onClose={() => setQueueOpen(false)} />
      )}
      {composerTpl && (
        <PromptComposer
          template={composerTpl}
          onSwitch={setComposerTpl}
          onAdd={addComposed}
          onClose={() => setComposerTpl(null)}
        />
      )}
      {shareOpen && <ShareSheet project={project} onClose={() => setShareOpen(false)} />}
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
