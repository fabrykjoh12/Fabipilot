import { useState } from 'react'
import { Landmark } from 'lucide-react'
import { buildImportPlan } from '../lib/bankImport.js'
import { CATEGORIES, subsFor } from '../lib/categories.js'
import { importBankExpenses, listExpenseImportKeys, importBankInflows, listInflowImportKeys } from '../db.js'
import { toast, useEscape } from '../lib/ui.jsx'
import { kr, vibrate } from '../lib/fx.js'

/* Bankimport-arket (Penger → Forbruk → «Importer fra banken»).

   Flyt: velg CSV-fila fra DNB-nettbanken → vi viser en plan GRUPPERT PER
   BUTIKK (294 grupper er håndterbart, 1000 enkeltrader er det ikke): antall,
   sum og gjettet kategori per butikk. Brukeren retter kategori der gjettingen
   bommer og krysser vekk butikker som ikke skal med — så importeres alt.

   Kategorivalgene huskes per butikk (localStorage) og brukes som fasit ved
   neste import, så rettejobben bare skjer én gang. */

const OVERRIDES_KEY = 'bankCatOverrides'

function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(OVERRIDES_KEY)) || {} } catch { return {} }
}

export default function MoneyImportSheet({ onClose }) {
  const categories = CATEGORIES
  const [plan, setPlan] = useState(null)
  const [error, setError] = useState('')
  const [skip, setSkip] = useState(() => new Set()) // butikk-nøkler som ikke skal med
  const [cats, setCats] = useState({}) // butikk-nøkkel → {category, sub} overstyrt denne økta
  const [busy, setBusy] = useState(false)
  useEscape(onClose)

  const catMeta = (k) => categories.find((c) => c.k === k) || categories[categories.length - 1]
  const gkey = (g) => g.merchant.toLowerCase()
  const chosenCat = (g) => cats[gkey(g)]?.category ?? g.category
  const chosenSub = (g) => (gkey(g) in cats ? cats[gkey(g)].sub : g.sub)

  async function onFile(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError('')
    try {
      const text = await file.text()
      const existingKeys = await listExpenseImportKeys()
      const existingInflowKeys = await listInflowImportKeys()
      const p = buildImportPlan(text, { existingKeys, existingInflowKeys, overrides: loadOverrides() })
      if (!p.ok) { setError(p.error); return }
      if (p.count === 0 && p.inflows.length === 0) {
        const d = p.skipped.duplicates
        setError(d > 0 ? `Alt i fila (${d} kjøp) er importert fra før — ingenting nytt å hente.` : 'Fant ingen kjøp å importere i fila.')
        return
      }
      setPlan(p)
      setSkip(new Set())
      setCats({})
    } catch {
      setError('Klarte ikke å lese fila.')
    }
  }

  const activeGroups = plan ? plan.groups.filter((g) => !skip.has(gkey(g))) : []
  const activeCount = activeGroups.reduce((s, g) => s + g.count, 0)
  const activeTotal = activeGroups.reduce((s, g) => s + g.total, 0)

  async function doImport() {
    if (busy || !activeCount) return
    setBusy(true)
    try {
      const rows = activeGroups.flatMap((g) => g.rows.map((r) => ({ ...r, category: chosenCat(g), sub: chosenSub(g) })))
      const n = await importBankExpenses(rows)
      // Innbetalinger lagres alltid — de trenger ingen kategorisering, og de er
      // det saldoen rulles framover med.
      const nIn = await importBankInflows(plan.inflows)
      // husk kategorivalget per butikk til neste import
      const overrides = loadOverrides()
      for (const g of plan.groups) overrides[gkey(g)] = { category: chosenCat(g), sub: chosenSub(g) }
      localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides))
      vibrate(12)
      toast.success(`Importerte ${n} kjøp fra banken`, {
        description: `${kr(Math.round(activeTotal))} fordelt på ${activeGroups.length} steder`
          + (nIn ? ` · ${nIn} innbetalinger` : ''),
      })
      onClose()
    } catch (err) {
      setError(err?.message || 'Importen feilet.')
      setBusy(false)
    }
  }

  const fmtDate = (iso) => (iso ? `${iso.slice(8)}.${iso.slice(5, 7)}.${iso.slice(2, 4)}` : '')

  return (
    <div className="msheet-overlay" onClick={onClose}>
      <div className="msheet imp-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="msheet-grip" />
        <h2 className="msheet-title">Importer fra banken</h2>

        {!plan && (
          <>
            <p className="imp-help">
              Hent fila i DNB-nettbanken: <strong>Konto → Siste bevegelser</strong>, velg periode og trykk
              <strong> «Lagre til fil»</strong>. Velg CSV-fila her — kjøpene grupperes per butikk før noe lagres.
            </p>
            <label className="imp-file-btn">
              <input type="file" accept=".csv,.txt,text/csv,text/plain" onChange={onFile} />
              <Landmark /> Velg fil fra banken…
            </label>
            <p className="imp-note">
              Overføringer mellom egne kontoer og alt som er importert før, hoppes over automatisk.
              Ingenting lagres før du bekrefter.
            </p>
          </>
        )}

        {error && <p className="imp-error" role="alert">{error}</p>}

        {plan && (
          <>
            <div className="imp-summary">
              <span className="imp-sum-big">{plan.count} kjøp · {kr(Math.round(plan.total))}</span>
              <span className="imp-sum-sub">{fmtDate(plan.from)} – {fmtDate(plan.to)}</span>
              {(plan.skipped.transfers > 0 || plan.skipped.duplicates > 0 || plan.skipped.reserved > 0) && (
                <span className="imp-sum-skip">
                  Hoppet over: {[
                    plan.skipped.transfers > 0 && `${plan.skipped.transfers} overføringer`,
                    plan.skipped.duplicates > 0 && `${plan.skipped.duplicates} allerede importert`,
                    plan.skipped.reserved > 0 && `${plan.skipped.reserved} reserverte`,
                  ].filter(Boolean).join(' · ')}
                </span>
              )}
            </div>

            {plan.inflows.length > 0 && (
              <div className="imp-inflow">
                <strong>{plan.inflows.length} innbetalinger · {kr(Math.round(plan.inflowTotal))}</strong>
                <span>
                  {kr(Math.round(plan.inflowByKind.inntekt + plan.inflowByKind.refusjon))} inntekt og refusjon ·{' '}
                  {kr(Math.round(plan.inflowByKind.overforing))} overført fra egne kontoer
                </span>
                <span className="imp-inflow-note">
                  Alt teller for saldoen. Bare det som ikke er overføringer regnes som inntekt.
                </span>
              </div>
            )}

            <p className="imp-hint">Sjekk kategoriene — valgene huskes til neste import.</p>

            <div className="imp-groups">
              {plan.groups.map((g) => {
                const k = gkey(g)
                const off = skip.has(k)
                const c = catMeta(chosenCat(g))
                return (
                  <div key={k} className={'imp-group' + (off ? ' off' : '')}>
                    <label className="imp-check">
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={() => setSkip((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n })}
                        aria-label={`Ta med ${g.merchant}`}
                      />
                    </label>
                    <div className="imp-group-main">
                      <span className="imp-merchant">{g.merchant}</span>
                      <span className="imp-meta">{g.count} {g.count === 1 ? 'kjøp' : 'kjøp'} · {kr(Math.round(g.total))}</span>
                    </div>
                    <div className="imp-cats">
                      <label className="imp-cat" style={{ background: c.color + '22' }}>
                        <select
                          value={chosenCat(g)}
                          disabled={off}
                          aria-label={`Kategori for ${g.merchant}`}
                          onChange={(e) => setCats((m) => ({ ...m, [k]: { category: e.target.value, sub: null } }))}
                        >
                          {categories.map((cat) => (
                            <option key={cat.k} value={cat.k}>{cat.emoji} {cat.label}</option>
                          ))}
                        </select>
                      </label>
                      {subsFor(chosenCat(g)).length > 0 && (
                        <label className="imp-sub">
                          <select
                            value={chosenSub(g) || ''}
                            disabled={off}
                            aria-label={`Underkategori for ${g.merchant}`}
                            onChange={(e) => setCats((m) => ({ ...m, [k]: { category: chosenCat(g), sub: e.target.value || null } }))}
                          >
                            <option value="">– uten –</option>
                            {subsFor(chosenCat(g)).map((sc) => (
                              <option key={sc.k} value={sc.k}>{sc.label}</option>
                            ))}
                          </select>
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            <button type="button" className="msheet-save" disabled={busy || (activeCount === 0 && plan.inflows.length === 0)} onClick={doImport}>
              {busy ? 'Importerer…' : `Importer ${activeCount} kjøp (${kr(Math.round(activeTotal))})`}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
