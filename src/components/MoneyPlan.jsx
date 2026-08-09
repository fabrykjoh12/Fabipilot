import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addPlan, updatePlan, deletePlan, todayKey } from '../db.js'
import { dailyAllowance, planProgress, monthlyAverages, daysBetween } from '../lib/plan.js'
import { kr, vibrate } from '../lib/fx.js'
import { AnimatedNumber, toast } from '../lib/ui.jsx'

/* Sparemodus / reiseplan — «pengene skal vare til dato X uten lønn».

   Vanlig budsjett antar at det kommer lønn neste måned. Skal du bort i fem
   måneder uten inntekt er spørsmålet et annet: hvor mye per dag, og ligger du
   foran eller bak? Regnestykkene bor i src/lib/plan.js — her er bare skjema,
   hero og statuslinje. */

function Field({ label, hint, children }) {
  return (
    <label className="plan-field">
      <span className="plan-lbl">{label}</span>
      {children}
      {hint && <span className="plan-hint">{hint}</span>}
    </label>
  )
}

function PlanForm({ suggestion, onDone, onCancel }) {
  const [name, setName] = useState('Japan')
  const [startDate, setStartDate] = useState(todayKey())
  const [endDate, setEndDate] = useState('')
  const [startAmount, setStartAmount] = useState('')
  const [income, setIncome] = useState('')
  const [fixedMonthly, setFixedMonthly] = useState('')

  // Live forhåndsvisning mens du skriver — du ser dagsbeløpet før du lagrer.
  const preview = dailyAllowance({
    startAmount: Number(startAmount) || 0,
    startDate,
    endDate,
    income: Number(income) || 0,
    fixedMonthly: Number(fixedMonthly) || 0,
  })

  async function save() {
    const p = await addPlan({ name, startDate, endDate, startAmount, income, fixedMonthly })
    if (!p) { toast.error('Fyll inn navn, fra-dato og til-dato'); return }
    vibrate(12)
    toast.success(`Planen «${p.name}» er satt`)
    onDone()
  }

  return (
    <div className="plan-form card">
      <h3 className="plan-form-ttl">Ny spareperiode</h3>
      <p className="plan-form-sub">
        For en periode uten (eller med lite) inntekt — f.eks. en lang reise. Appen regner ut hvor mye
        du kan bruke per dag for at pengene skal vare hele veien.
      </p>

      <Field label="Hva kaller vi den?">
        <input className="plan-in" value={name} onChange={(e) => setName(e.target.value)} placeholder="Japan" />
      </Field>

      <div className="plan-row">
        <Field label="Fra">
          <input className="plan-in" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Til">
          <input className="plan-in" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </Field>
      </div>

      <Field label="Hvor mye har du å bruke?" hint="Alt du har tilgjengelig når perioden starter.">
        <input className="plan-in" type="number" inputMode="numeric" placeholder="kr" value={startAmount} onChange={(e) => setStartAmount(e.target.value)} />
      </Field>

      <Field label="Inntekt i HELE perioden" hint="0 hvis du er uten lønn. Stipend, utleie, oppdrag — legg sammen.">
        <input className="plan-in" type="number" inputMode="numeric" placeholder="0" value={income} onChange={(e) => setIncome(e.target.value)} />
      </Field>

      <Field label="Faste utgifter per måned som løper videre" hint="Abonnement, forsikring, mobil — det som trekkes selv om du er borte.">
        <input className="plan-in" type="number" inputMode="numeric" placeholder="kr / mnd" value={fixedMonthly} onChange={(e) => setFixedMonthly(e.target.value)} />
      </Field>

      {suggestion?.monthsCounted > 0 && (
        <p className="plan-tip">
          💡 Du har brukt <strong>{kr(Math.round(suggestion.perMonth))}</strong> i snitt per måned de siste
          {' '}{suggestion.monthsCounted} månedene. Det tilsvarer{' '}
          <strong>{kr(Math.round(suggestion.perMonth * 5))}</strong> på fem måneder.
        </p>
      )}

      {preview.ok && (
        <div className={'plan-preview' + (preview.short ? ' bad' : '')}>
          {preview.short ? (
            <span>De faste utgiftene alene er større enn det du har. Sjekk tallene.</span>
          ) : (
            <span>
              <strong>{kr(Math.round(preview.freePerDay))}</strong> per dag i {preview.days} dager
              {' '}(≈ {kr(Math.round(preview.freePerMonth))} per måned)
            </span>
          )}
        </div>
      )}

      <div className="plan-actions">
        <button type="button" className="plan-save" onClick={save} disabled={!endDate || !Number(startAmount)}>
          Lagre planen
        </button>
        {onCancel && <button type="button" className="plan-cancel" onClick={onCancel}>Avbryt</button>}
      </div>
    </div>
  )
}

function ActivePlan({ plan, expenses, history, onGone }) {
  const p = planProgress(plan, expenses, todayKey())
  const [editing, setEditing] = useState(false)
  if (!p.ok) return null

  /* Realitetssjekk: tåler planen vanene dine? Sammenligner budsjettet med det du
     FAKTISK brukte per måned før perioden. Uten dette kan et pent dagsbeløp se
     greit ut selv om det er langt under måten du lever på. */
  const usual = history?.monthsCounted >= 2 ? history.perMonth : null
  const gap = usual ? p.freePerMonth - usual : null

  const state = p.beforeStart ? 'soon' : p.finished ? 'done' : p.onTrack ? 'ok' : 'over'
  const totalDays = daysBetween(plan.startDate, plan.endDate)

  async function bumpAmount() {
    const v = window.prompt('Hvor mye har du igjen nå? (kr)', String(Math.round(p.left)))
    if (v === null) return
    const n = Number(v)
    if (!Number.isFinite(n)) return
    // Ny startsum fra i dag — behold historikken ved å flytte startdatoen hit.
    await updatePlan(plan.id, { startAmount: n + p.spent })
    toast.success('Justert')
  }

  async function remove() {
    if (!window.confirm(`Slette planen «${plan.name}»?`)) return
    await deletePlan(plan.id)
    onGone()
  }

  return (
    <>
      <div className={'plan-hero ' + state}>
        <div className="plan-hero-top">
          <span className="plan-hero-name">{plan.name}</span>
          <button type="button" className="plan-del" onClick={remove} aria-label="Slett planen"><Trash2 /></button>
        </div>

        {p.beforeStart ? (
          <>
            <span className="plan-lbl-big">Du kan bruke</span>
            <AnimatedNumber className="plan-amount" value={Math.round(p.freePerDay)} format={kr} />
            <span className="plan-sub">per dag i {p.days} dager · starter {plan.startDate.slice(8)}.{plan.startDate.slice(5, 7)}</span>
          </>
        ) : p.finished ? (
          <>
            <span className="plan-lbl-big">Perioden er over</span>
            <AnimatedNumber className="plan-amount" value={Math.round(p.left)} format={kr} />
            <span className="plan-sub">igjen av {kr(Math.round(p.available))} · du brukte {kr(Math.round(p.spent))}</span>
          </>
        ) : (
          <>
            <span className="plan-lbl-big">Trygt å bruke per dag</span>
            <AnimatedNumber className="plan-amount" value={Math.round(p.perDayLeft)} format={kr} />
            <span className="plan-sub">
              {kr(Math.round(p.left))} igjen · {p.daysLeft} {p.daysLeft === 1 ? 'dag' : 'dager'} til {plan.endDate.slice(8)}.{plan.endDate.slice(5, 7)}
            </span>
          </>
        )}

        <div className="plan-bar" role="img" aria-label={`Dag ${p.dayNo} av ${totalDays}`}>
          <i style={{ width: p.pct + '%' }} />
        </div>
        <div className="plan-bar-foot">
          <span>Dag {p.dayNo} av {totalDays}</span>
          <span>{p.pct}%</span>
        </div>
      </div>

      {!p.beforeStart && !p.finished && (
        <div className={'plan-status ' + (p.onTrack ? 'ok' : 'over')}>
          {p.onTrack ? (
            <>
              <strong>Du ligger {kr(Math.round(Math.abs(p.diff)))} under plan.</strong>{' '}
              Holder du dette tempoet, har du {kr(Math.round(p.projectedEnd))} igjen når du er ferdig.
            </>
          ) : (
            <>
              <strong>Du ligger {kr(Math.round(Math.abs(p.diff)))} over plan.</strong>{' '}
              {p.projectedEnd < 0
                ? `Med dagens tempo er pengene brukt opp på dag ${p.runsOutOnDay} av ${totalDays} — du må ned til ${kr(Math.round(p.perDayLeft))} per dag.`
                : `Det går fortsatt opp, men marginen er nede i ${kr(Math.round(p.projectedEnd))}.`}
            </>
          )}
        </div>
      )}

      {usual !== null && (
        <div className={'plan-reality ' + (gap >= 0 ? 'ok' : 'tight')}>
          {gap >= 0 ? (
            <>Du pleier å bruke <strong>{kr(Math.round(usual))}</strong> i måneden. Planen gir deg{' '}
              <strong>{kr(Math.round(p.freePerMonth))}</strong> — {kr(Math.round(gap))} mer enn vanlig, så dette
              bør gå fint.</>
          ) : (
            <>Du pleier å bruke <strong>{kr(Math.round(usual))}</strong> i måneden, men planen gir bare{' '}
              <strong>{kr(Math.round(p.freePerMonth))}</strong>. Du må ned <strong>{kr(Math.round(-gap))}</strong>{' '}
              i måneden mot vanlig forbruk.</>
          )}
        </div>
      )}

      <div className="plan-facts card">
        <div className="plan-fact"><span>Å bruke totalt</span><strong>{kr(Math.round(p.available))}</strong></div>
        <div className="plan-fact"><span>Faste utgifter i perioden</span><strong>−{kr(Math.round(p.fixedTotal))}</strong></div>
        <div className="plan-fact"><span>Fritt å bruke</span><strong>{kr(Math.round(p.free))}</strong></div>
        <div className="plan-fact"><span>Brukt hittil</span><strong>{kr(Math.round(p.spent))}</strong></div>
        <div className="plan-fact"><span>Snitt per dag hittil</span><strong>{kr(Math.round(p.pace))}</strong></div>
      </div>

      <button type="button" className="budget-add" onClick={bumpAmount}>
        ⚖️ Juster: hvor mye har du igjen nå?
      </button>

      {editing && <PlanForm onDone={() => setEditing(false)} onCancel={() => setEditing(false)} />}
    </>
  )
}

export default function MoneyPlan({ plans, expenses }) {
  const [adding, setAdding] = useState(false)
  const plan = plans?.[0] || null
  const suggestion = monthlyAverages(expenses, { monthsBack: 6 })

  if (!plan || adding) {
    return (
      <>
        {!plan && (
          <div className="empty">
            <div className="glyph">🗾</div>
            <p className="em-ttl">Skal du en periode uten lønn?</p>
            <p>Sett en spareperiode — så regner appen ut hvor mye du kan bruke per dag for at pengene varer hele veien, og følger med underveis.</p>
          </div>
        )}
        <PlanForm
          suggestion={suggestion}
          onDone={() => setAdding(false)}
          onCancel={plan ? () => setAdding(false) : null}
        />
      </>
    )
  }

  return <ActivePlan plan={plan} expenses={expenses} history={suggestion} onGone={() => setAdding(false)} />
}
