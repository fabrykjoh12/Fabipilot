import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { addPlan, updatePlan, deletePlan, todayKey } from '../db.js'
import { dailyAllowance, planProgress, planMonths, monthlyAverages, daysBetween } from '../lib/plan.js'
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

const MONTHS = ['januar', 'februar', 'mars', 'april', 'mai', 'juni', 'juli', 'august', 'september', 'oktober', 'november', 'desember']
const dm = (iso) => `${iso.slice(8)}.${iso.slice(5, 7)}`

/* Måned-for-måned. Ferdige måneder viser fasit, inneværende viser hva som er
   igjen, kommende viser hva de får når det som allerede er brukt er trukket fra. */
function MonthRow({ row }) {
  const label = `${MONTHS[row.month].charAt(0).toUpperCase()}${MONTHS[row.month].slice(1)}`
  return (
    <div className={'pm-row ' + row.status + (row.over ? ' over' : '')}>
      <div className="pm-top">
        <span className="pm-name">
          {label}
          {row.status === 'current' && <em> · nå</em>}
          {row.days < 28 && <small> ({row.days} dager)</small>}
        </span>
        <span className="pm-amt">
          {row.status === 'past'
            ? kr(Math.round(row.spent))
            : `${kr(Math.round(row.left))} igjen`}
        </span>
      </div>
      <div className="pm-bar">
        <i style={{ width: Math.min(100, row.pct) + '%' }} />
      </div>
      <div className="pm-foot">
        <span>
          {row.status === 'future'
            ? `Budsjett ${kr(Math.round(row.budget))}`
            : `${kr(Math.round(row.spent))} av ${kr(Math.round(row.budget))}`}
        </span>
        {row.status === 'current' && <span>{row.daysLeftInMonth} dager igjen</span>}
        {row.status === 'past' && <span>{row.over ? `${kr(Math.round(-row.left))} over` : `${kr(Math.round(row.left))} til overs`}</span>}
      </div>
    </div>
  )
}

function ActivePlan({ plan, expenses, history, onGone }) {
  const today = todayKey()
  const p = planProgress(plan, expenses, today)
  const months = planMonths(plan, expenses, today)
  if (!p.ok) return null

  /* Realitetssjekk: tåler planen vanene dine? Sammenligner budsjettet med det du
     FAKTISK brukte per måned før perioden. Uten dette kan et pent dagsbeløp se
     greit ut selv om det er langt under måten du lever på. */
  const usual = history?.monthsCounted >= 2 ? history.perMonth : null
  const gap = usual ? p.freePerMonth - usual : null

  const cur = months.find((m) => m.status === 'current')
  const state = p.beforeStart ? 'soon' : p.finished ? 'done' : p.onTrack ? 'ok' : 'over'
  const totalDays = daysBetween(plan.startDate, plan.endDate)

  async function bumpAmount() {
    const v = window.prompt('Hvor mye har du igjen på konto nå? (kr)', String(Math.round(p.left)))
    if (v === null) return
    const n = Number(v)
    if (!Number.isFinite(n)) return
    // Startsummen justeres slik at «igjen» treffer det du oppgir — det du
    // allerede har brukt i perioden blir stående.
    await updatePlan(plan.id, { startAmount: n + p.spent - (Number(plan.income) || 0) })
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
            <span className="plan-sub">per dag i {p.days} dager · starter {dm(plan.startDate)}</span>
          </>
        ) : p.finished ? (
          <>
            <span className="plan-lbl-big">Perioden er over</span>
            <AnimatedNumber className="plan-amount" value={Math.round(p.left)} format={kr} />
            <span className="plan-sub">igjen av {kr(Math.round(p.available))} · du brukte {kr(Math.round(p.spent))}</span>
          </>
        ) : (
          <>
            <span className="plan-lbl-big">Igjen i {MONTHS[cur?.month ?? 0]}</span>
            {/* Rødt tall = du har brukt opp månedens andel. Rammen kan være rød
                (over plan totalt) uten at selve beløpet er negativt. */}
            <AnimatedNumber
              className={'plan-amount' + ((cur?.left ?? 0) < 0 ? ' neg' : '')}
              value={Math.round(cur?.left ?? 0)}
              format={kr}
            />
            <span className="plan-sub">
              {kr(Math.round(p.perDayLeft))} per dag · {cur?.daysLeftInMonth ?? 0} dager igjen av måneden
            </span>
          </>
        )}

        <div className="plan-bar" role="img" aria-label={`Dag ${p.dayNo} av ${totalDays}`}>
          <i style={{ width: p.pct + '%' }} />
        </div>
        <div className="plan-bar-foot">
          <span>Dag {p.dayNo} av {totalDays} · til {dm(plan.endDate)}</span>
          <span>{kr(Math.round(p.left))} igjen totalt</span>
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

      {months.length > 0 && (
        <div className="pm-list card">
          <span className="trend-lbl">Måned for måned</span>
          {months.map((row) => <MonthRow key={row.ym} row={row} />)}
          <p className="pm-note">
            Bruker du mer én måned, krymper de neste automatisk — beløpene er alltid det som
            faktisk er igjen.
          </p>
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
