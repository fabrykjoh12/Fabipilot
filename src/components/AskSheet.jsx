import { useEffect, useRef, useState } from 'react'
import { useEscape } from '../lib/ui.jsx'

/* Ark for å spørre om ETT tall eller ETT ja/nei — erstatter `window.prompt` og
   `window.confirm`.

   De native dialogene er grå systembokser som ikke kan styles, ser ut som en
   feilmelding på mobil, og bryter helt med resten av appen. Arket her ser ut som
   alle andre ark i Penger og bruker de samme `.msheet-*`-stilene (Money.css).

   Bruk via `useAskSheet()`:
     const { ask, confirm, sheet } = useAskSheet()
     …
     <button onClick={() => ask({ title: 'Hvor mye?', suffix: 'kr', onSave: v => … })}>
     {sheet}
*/

function Sheet({ cfg, onClose }) {
  useEscape(onClose)
  const isConfirm = cfg.kind === 'confirm'
  const [val, setVal] = useState(cfg.initial == null || cfg.initial === '' ? '' : String(cfg.initial))
  const ref = useRef(null)

  useEffect(() => {
    const id = setTimeout(() => { ref.current?.focus(); ref.current?.select?.() }, 60)
    return () => clearTimeout(id)
  }, [])

  function save() {
    cfg.onSave?.(isConfirm ? true : val)
    onClose()
  }

  return (
    <div className="msheet-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="msheet" onClick={(e) => e.stopPropagation()}>
        <div className="msheet-grip" />
        <h3 className="msheet-title">{cfg.title}</h3>

        {isConfirm ? (
          cfg.label && <p className="msheet-hint msheet-hint-confirm">{cfg.label}</p>
        ) : (
          <>
            <div className="msheet-amount">
              <input
                ref={ref}
                className="msheet-amount-in"
                inputMode={cfg.inputMode || 'numeric'}
                placeholder={cfg.placeholder ?? '0'}
                value={val}
                onChange={(e) => setVal(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') onClose() }}
              />
              {cfg.suffix && <span className="msheet-kr">{cfg.suffix}</span>}
            </div>
            {cfg.label && <span className="msheet-lbl">{cfg.label}</span>}
          </>
        )}

        <button
          ref={isConfirm ? ref : undefined}
          type="button"
          className={'msheet-save' + (cfg.danger ? ' danger' : '')}
          onClick={save}
        >
          {cfg.confirmLabel || (isConfirm ? 'Ja, gjør det' : 'Lagre')}
        </button>
        {isConfirm && (
          <button type="button" className="msheet-cancel" onClick={onClose}>Avbryt</button>
        )}
      </div>
    </div>
  )
}

export default Sheet
