import { useState } from 'react'
import { updateProjectItem, setItemEnergy, addItemSubtask, toggleItemSubtask, deleteItemSubtask } from '../../db.js'
import { vibrate } from '../../lib/fx.js'
import { toast } from '../../lib/ui.jsx'
import { buildPrompt, hasContext } from '../../lib/prompts.js'
import { ENERGY_NEXT, AI_NEXT, AI_LABEL, MORE, COPY } from './shared.jsx'

export default function SpineCard({ item, onActions, project }) {
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
