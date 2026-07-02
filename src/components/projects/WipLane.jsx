import { useState } from 'react'
import SpineCard from './SpineCard.jsx'

/* «Pågående»-lane øverst på tavla: det du fikser akkurat nå. Full bredde,
   egen dropp-sone (setter wip=true); prioritet beholdes under. */
export default function WipLane({ items, onActions, onDropWip, project }) {
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
