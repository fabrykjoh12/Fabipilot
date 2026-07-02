import { moveItemToStage, setItemStage, deleteProjectItem, updateProjectItem, restoreRecord, reorderItem } from '../../db.js'
import { vibrate } from '../../lib/fx.js'
import { toast, useEscape } from '../../lib/ui.jsx'
import { STAGE_OPTS } from './shared.jsx'

/* Handlingssheet for ett steg: flytt fritt mellom faser, omroker, fullfør, slett. */
export default function StepSheet({ item, onClose }) {
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
