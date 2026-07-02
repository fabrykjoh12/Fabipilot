import { useState } from 'react'
import SpineCard from './SpineCard.jsx'

export default function StageBlock({ stage, label, note, items, onAdd, onActions, onDropTo, project }) {
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
