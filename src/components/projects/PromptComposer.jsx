import { useState } from 'react'
import { useEscape } from '../../lib/ui.jsx'
import { PROMPT_TEMPLATES, STAGE_OPTS } from './shared.jsx'

/* Mal-komposer: velg mal, fyll inn enkle felt (med hint), se live
   forhåndsvisning, velg prioritet, legg til. */
export default function PromptComposer({ template, onSwitch, onAdd, onClose }) {
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
