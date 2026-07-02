import { useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import { db } from '../db.js'
import NavIcon from './NavIcon.jsx'

const GridMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
  </svg>
)

const LOGIN_FEATURES = [
  { k: 'today', label: 'I dag', desc: 'Maks tre ting i fokus' },
  { k: 'habits', label: 'Vaner', desc: 'Små ting, gjentatt' },
  { k: 'projects', label: 'Prosjekter', desc: 'Det du jobber mot' },
  { k: 'money', label: 'Penger', desc: 'Faste utgifter, samlet' },
]

/* Norske tekster for de vanlige innloggings-stegene (Dexie sender engelsk). */
const NO_TITLE = {
  email: 'Logg inn',
  otp: 'Sjekk e-posten din',
}
const NO_SUBMIT = {
  email: 'Send meg en kode',
  otp: 'Logg inn',
}
const NO_ALERT = {
  OTP_SENT: 'Vi sendte en engangskode til e-posten din. Lim den inn her.',
  INVALID_OTP: 'Feil eller utløpt kode. Prøv igjen.',
  INVALID_EMAIL: 'Sjekk at e-postadressen er riktig.',
  USER_NOT_REGISTERED: 'Denne e-posten er ikke registrert på databasen.',
  NO_SEATS_AVAILABLE: 'Ingen ledige plasser på databasen akkurat nå.',
  GENERIC_ERROR: 'Noe gikk galt. Prøv igjen.',
}
const NO_PLACEHOLDER = { email: 'din@epost.no', otp: 'Engangskode' }

/* Egendefinert innloggings-dialog (e-post + engangskode) — matcher designet
   i stedet for Dexies grå standard-GUI. Drives av db.cloud.userInteraction.
   Indre skjema remountes (via key) hver gang interaksjonen endres, så feltene
   nullstilles uten en setState-i-effect. */
export function LoginInteraction() {
  const ui = useObservable(db.cloud.userInteraction)
  if (!ui) return null
  const key = `${ui.type}|${ui.title || ''}|${ui.alerts?.length || 0}`
  return <InteractionForm key={key} ui={ui} />
}

function InteractionForm({ ui }) {
  const [values, setValues] = useState({})
  const [submitting, setSubmitting] = useState(false)

  const fields = Object.entries(ui.fields || {})
  const onlyAlert = ui.type === 'message-alert'
  const title = NO_TITLE[ui.type] || ui.title
  const submitLabel = NO_SUBMIT[ui.type] || ui.submitLabel || 'OK'

  function submit(e) {
    e?.preventDefault()
    setSubmitting(true)
    const payload = {}
    for (const [name] of fields) {
      let v = values[name] ?? ''
      // E-post må normaliseres — ellers blir «Fabrik…» og «fabrik…» to ulike kontoer.
      if (name === 'email') v = v.trim().toLowerCase()
      payload[name] = v
    }
    ui.onSubmit(payload)
  }

  return (
    <div className="lia-overlay" role="dialog" aria-modal="true">
      <form className="lia-card" onSubmit={submit}>
        <h2 className="lia-title">{title}</h2>

        {(ui.alerts || []).map((a, i) => (
          <p key={i} className={'lia-alert ' + a.type}>{NO_ALERT[a.messageCode] || a.message}</p>
        ))}

        {fields.map(([name, f]) => (
          <label key={name} className="lia-field">
            {f.label && <span className="lia-label">{f.label}</span>}
            <input
              type={f.type === 'password' ? 'password' : 'text'}
              inputMode={f.type === 'otp' || name === 'otp' ? 'numeric' : name === 'email' ? 'email' : undefined}
              autoComplete={name === 'email' ? 'email' : name === 'otp' ? 'one-time-code' : 'off'}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="go"
              placeholder={NO_PLACEHOLDER[name] || f.placeholder || ''}
              value={values[name] ?? ''}
              autoFocus={fields[0][0] === name}
              onChange={(e) => setValues((v) => ({ ...v, [name]: e.target.value }))}
            />
          </label>
        ))}

        {(ui.options || []).length > 0 && (
          <div className="lia-options">
            {ui.options.map((o) => (
              <button
                key={o.name + o.value}
                type="button"
                className="lia-opt"
                onClick={() => ui.onSubmit({ [o.name]: o.value })}
              >
                {o.displayName}
              </button>
            ))}
          </div>
        )}

        <button type="submit" className="lia-submit" disabled={submitting}>
          {submitting ? <span className="login-btn-spin" /> : submitLabel}
        </button>

        {ui.cancelLabel && !onlyAlert && (
          <button type="button" className="lia-cancel" onClick={() => ui.onCancel()}>
            Avbryt
          </button>
        )}
      </form>
    </div>
  )
}

export default function LoginScreen() {
  const [busy, setBusy] = useState(false)

  async function login() {
    setBusy(true)
    try {
      await db.cloud.login()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <LoginInteraction />
      <div className="login-panel">
        <aside className="login-showcase">
          <div className="login-brand">
            <span className="login-brand-mark">
              <GridMark />
            </span>
            Fabipilot
          </div>
          <h2 className="login-headline">
            Alt på ett sted.<br />
            På alle enhetene dine.
          </h2>
          <ul className="login-features">
            {LOGIN_FEATURES.map((f) => (
              <li key={f.k} className="login-feature">
                <span className="lf-icon">
                  <NavIcon name={f.k} />
                </span>
                <span className="lf-text">
                  <b>{f.label}</b>
                  <i>{f.desc}</i>
                </span>
              </li>
            ))}
          </ul>
          <div className="login-showglow" aria-hidden="true" />
        </aside>

        <div className="login-action">
          <div className="login-glyph" aria-hidden="true">
            <GridMark />
          </div>
          <h1 className="login-title">Velkommen</h1>
          <p className="login-text">
            Logg inn for å hente dataene dine — eller starte friskt. Alt synces
            automatisk mellom mobil og laptop.
          </p>

          <button type="button" className="login-btn" onClick={login} disabled={busy}>
            {busy ? (
              <>
                <span className="login-btn-spin" />
                Åpner innlogging…
              </>
            ) : (
              'Logg inn med e-post'
            )}
          </button>

          <p className="login-foot">
            Ingen passord — du får en engangskode på e-post. Dataene ligger
            lokalt og fungerer offline.
          </p>
        </div>
      </div>
    </div>
  )
}
