import { useState } from 'react'
import { updateProjectItem } from '../../db.js'
import { vibrate } from '../../lib/fx.js'
import { toast, useEscape } from '../../lib/ui.jsx'
import { buildPrompt, hasContext } from '../../lib/prompts.js'
import { PRIO_LABEL } from './shared.jsx'

/* Kø-/fokusmodus: jobb gjennom prompts én om gangen — kopier, åpne Claude,
   marker «spurt», neste. Jobber på et øyeblikksbilde av køen (stabil rekkefølge). */
export default function PromptQueue({ items, project, onClose }) {
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
