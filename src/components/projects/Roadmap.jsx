import { useState, useRef } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  db,
  getProject,
  updateProject,
  deleteProject,
  setProjectStatus,
  listProjectItems,
  addProjectItem,
  updateProjectItem,
  todayKey,
} from '../../db.js'
import { vibrate, reduceMotion } from '../../lib/fx.js'
import { toast, ScreenSkeleton } from '../../lib/ui.jsx'
import { buildAllPrompts, buildRecipe, PROJECT_RECIPES, RECIPE_GROUPS, recommendedRecipe, buildTaskList, CLAUDE_SESSION_HOOK } from '../../lib/prompts.js'
import { projectHealth, HEALTH_LABEL } from '../../lib/projectHealth.js'
import { launchChecklist } from '../../lib/launch.js'
import { downscaleImage } from '../../lib/image.js'
import {
  STATUS_LABEL,
  NEXT_STATUS,
  PROJECT_COLORS,
  PROJECT_EMOJIS,
  colorVal,
  fmtDeadline,
  touchedText,
  PROMPT_TEMPLATES,
  PRIO_LABEL,
  COPY,
} from './shared.jsx'
import StepSheet from './StepSheet.jsx'
import WipLane from './WipLane.jsx'
import StageBlock from './StageBlock.jsx'
import PromptQueue from './PromptQueue.jsx'
import PromptComposer from './PromptComposer.jsx'
import ShareSheet from './ShareSheet.jsx'
import './roadmap.css'
import './workspace.css'
import './prompts.css'
import './composer.css'
import './wip-result.css'

export default function Roadmap({ projectId, onBack }) {
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
  const [launchOpen, setLaunchOpen] = useState(false)
  const [hookOpen, setHookOpen] = useState(false)
  const [composerTpl, setComposerTpl] = useState(null)
  const [quickVal, setQuickVal] = useState('')
  const [nameVal, setNameVal] = useState('')
  const [whyVal, setWhyVal] = useState('')
  const [notesVal, setNotesVal] = useState('')
  const [contextVal, setContextVal] = useState('')
  const [liveVal, setLiveVal] = useState('')
  const [repoVal, setRepoVal] = useState('')
  const quickRef = useRef(null)
  const boardRef = useRef(null)
  const photoRef = useRef(null)
  const [photoBusy, setPhotoBusy] = useState(false)

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

  function scrollToBoard() {
    boardRef.current?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' })
    setTimeout(() => quickRef.current?.focus(), reduceMotion() ? 0 : 320)
  }

  /* Trykk på et uløst launch-punkt → hopp rett til der man fikser det. */
  function fixCheck(action) {
    setLaunchOpen(true)
    switch (action) {
      case 'why': startEditWhy(); break
      case 'context': setContextVal(project.context || ''); setEditingContext(true); break
      case 'links': openLinksEdit(); break
      case 'board': scrollToBoard(); break
      default: break
    }
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
  const health = projectHealth(project, items)
  const launch = launchChecklist(project, items)
  const recRecipe = recommendedRecipe(health.state)

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

  async function copyRecipe(recipe) {
    try {
      await navigator.clipboard.writeText(buildRecipe(recipe.key, project, items))
      vibrate(8)
      toast.success(`«${recipe.label}» kopiert`, { description: 'Lim inn i Claude — prosjektet er med.' })
    } catch {
      toast.error('Kunne ikke kopiere')
    }
  }

  async function copyTasks() {
    try {
      await navigator.clipboard.writeText(buildTaskList(project, items))
      vibrate(8)
      toast.success('Oppgaveliste kopiert', { description: 'Lim inn i repoet som TASKS.md — eller rett til Claude.' })
    } catch {
      toast.error('Kunne ikke kopiere')
    }
  }
  function downloadTasks() {
    const blob = new Blob([buildTaskList(project, items)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'TASKS.md'
    a.click()
    URL.revokeObjectURL(url)
    vibrate(8)
    toast.success('TASKS.md lastet ned', { description: 'Legg fila i repoet, så leser Claude oppgavene automatisk.' })
  }
  function copyHook() {
    navigator.clipboard.writeText(CLAUDE_SESSION_HOOK)
      .then(() => { vibrate(8); toast.success('settings.json kopiert', { description: 'Lim inn i .claude/settings.json i repoet.' }) })
      .catch(() => toast.error('Kunne ikke kopiere'))
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

  async function onPickImage(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoBusy(true)
    try {
      const image = await downscaleImage(file)
      await updateProject(project.id, { image })
      vibrate(8)
      toast.success('Bilde lagt til')
    } catch (err) {
      toast.error('Kunne ikke legge til bildet', { description: err?.message })
    } finally {
      setPhotoBusy(false)
    }
  }
  function removeImage() {
    updateProject(project.id, { image: null })
    toast.message('Bilde fjernet')
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
            className={'pemoji-badge' + (project.image ? ' has-photo' : '')}
            style={{ background: col + '22', borderColor: col + '55' }}
            onClick={() => setCustomizing((c) => !c)}
            aria-label="Endre ikon, farge og bilde"
          >
            {project.image
              ? <img className="pemoji-photo" src={project.image} alt="" />
              : (project.emoji || '🗂️')}
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
                ▶ Kjør i Claude <span className="prun-ct">{queue.length}</span>
              </button>
              <button type="button" className="pcopyall" onClick={copyAll} title="Kopier hele prompt-køen som én liste">
                {COPY} Kopier prompt-kø
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
            <div className="pcustom-photo">
              <input
                ref={photoRef}
                type="file"
                accept="image/*"
                hidden
                onChange={onPickImage}
              />
              {project.image && (
                <img className="pcustom-photo-preview" src={project.image} alt="Prosjektbilde" />
              )}
              <button type="button" className="pcustom-photo-btn" disabled={photoBusy} onClick={() => photoRef.current?.click()}>
                {photoBusy ? 'Laster…' : project.image ? '📷 Bytt bilde' : '📷 Legg til bilde'}
              </button>
              {project.image && (
                <button type="button" className="pcustom-photo-rm" onClick={removeImage}>Fjern</button>
              )}
            </div>
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
        <div className={'phealth h-' + health.state}>
          <span className="phealth-top">
            <span className="phealth-dot" />
            <span className="phealth-lbl">{HEALTH_LABEL[health.state]}</span>
          </span>
          <span className="phealth-detail">{health.detail}</span>
          {health.nextAction && (
            <button type="button" className="phealth-next" onClick={() => setSheetItem(health.nextAction)}>
              <span className="phealth-next-lbl">Neste beste steg</span>
              <span className="phealth-next-txt">{health.nextAction.text}</span>
            </button>
          )}
        </div>
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

        <div className={'plaunch' + (launch.ready ? ' ready' : '')}>
          <button
            type="button"
            className="plaunch-head"
            onClick={() => setLaunchOpen((o) => !o)}
            aria-expanded={launchOpen}
          >
            <span className="plaunch-title">
              {launch.ready ? 'Klar til lansering 🚀' : 'Klar til lansering'}
            </span>
            <span className="plaunch-count">{launch.doneCount}/{launch.total}</span>
            <span className={'plaunch-chev' + (launchOpen ? ' open' : '')} aria-hidden="true">▾</span>
          </button>
          <span className="plaunch-bar">
            <i style={{ width: launch.pct + '%', background: launch.ready ? 'var(--forest)' : col }} />
          </span>
          {launch.ready ? (
            <p className="plaunch-ready-note">Alt er på plass — på tide å publisere.</p>
          ) : (
            <button type="button" className="plaunch-fix" onClick={() => fixCheck(launch.firstUnmet.action)}>
              Fiks neste: {launch.firstUnmet.label}
            </button>
          )}
          {launchOpen && (
            <ul className="plaunch-list">
              {launch.checks.map((c) => {
                if (c.done) {
                  return (
                    <li key={c.key} className="plaunch-item done">
                      <span className="plaunch-mark" aria-hidden="true">✓</span>
                      <span className="plaunch-text">{c.label}</span>
                    </li>
                  )
                }
                return (
                  <li key={c.key} className="plaunch-item">
                    <button type="button" className="plaunch-fixitem" onClick={() => fixCheck(c.action)}>
                      <span className="plaunch-mark" aria-hidden="true">○</span>
                      <span className="plaunch-text">
                        {c.label}
                        <span className="plaunch-hint">{c.hint}</span>
                      </span>
                      <span className="plaunch-cta">{c.cta} ›</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="precipes">
          <span className="precipes-lbl">Spør Claude om prosjektet</span>
          {recRecipe && (
            <button type="button" className="precipe-rec" onClick={() => copyRecipe(recRecipe)}>
              <span className="precipe-rec-tag">Anbefalt nå</span>
              <span className="precipe-rec-main">
                <span className="precipe-emoji">{recRecipe.emoji}</span>
                {recRecipe.label}
              </span>
              <span className="precipe-rec-copy">Kopier ›</span>
            </button>
          )}
          {RECIPE_GROUPS.map((g) => (
            <div key={g} className="precipe-group">
              <span className="precipe-group-lbl">{g}</span>
              <div className="precipes-chips">
                {PROJECT_RECIPES.filter((r) => r.group === g).map((r) => (
                  <button key={r.key} type="button" className="precipe-chip" onClick={() => copyRecipe(r)} title="Kopier ferdig prompt med prosjektkontekst">
                    <span className="precipe-emoji">{r.emoji}</span>{r.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {items.length > 0 && (
          <div className="ptasks">
            <span className="precipes-lbl">Ta med til repoet</span>
            <div className="ptasks-actions">
              <button type="button" className="ptasks-btn" onClick={copyTasks}>{COPY} Kopier oppgaveliste</button>
              <button type="button" className="ptasks-btn" onClick={downloadTasks}>⬇ TASKS.md</button>
            </div>
            <p className="ptasks-hint">Legg <code>TASKS.md</code> i prosjektets repo, så leser Claude oppgavene herfra automatisk hver økt.</p>
            <button type="button" className="ptasks-setup-toggle" onClick={() => setHookOpen((o) => !o)} aria-expanded={hookOpen}>
              <span className={'ptasks-chev' + (hookOpen ? ' open' : '')} aria-hidden="true">▸</span>
              Auto-les hver økt — engangsoppsett
            </button>
            {hookOpen && (
              <div className="ptasks-setup">
                <ol>
                  <li>Legg <code>TASKS.md</code> (over) i repoets rot-mappe.</li>
                  <li>Lag fila <code>.claude/settings.json</code> i repoet med dette innholdet:</li>
                </ol>
                <pre className="ptasks-code">{CLAUDE_SESSION_HOOK}</pre>
                <button type="button" className="ptasks-btn" onClick={copyHook}>{COPY} Kopier settings.json</button>
                <p className="ptasks-hint">Da leser Claude oppgavene automatisk ved starten av hver økt — du gjør ingenting under kodingen. Oppdater <code>TASKS.md</code> kun når du endrer planen.</p>
              </div>
            )}
          </div>
        )}
        </aside>

        <section className="rm-board" ref={boardRef}>
        <div className="rm-quickadd">
          <textarea
            ref={quickRef}
            className="rm-quickadd-input"
            placeholder="Skriv et byggesteg eller en prompt…  (Enter for å legge til, Shift+Enter for ny linje)"
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
