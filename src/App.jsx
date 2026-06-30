import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useObservable, useLiveQuery } from 'dexie-react-hooks'
import { Toaster } from 'sonner'
import { motion } from 'motion/react'
import {
  LayoutGrid,
  Sun,
  ListChecks,
  CalendarDays,
  Compass,
  Lightbulb,
  Repeat,
  Wallet,
  FolderKanban,
  Search as SearchIcon,
  Users,
  CloudUpload,
  MoreHorizontal,
} from 'lucide-react'
import './components/AppShell.css'
import Overview from './components/Overview.jsx'
import Today from './components/Today.jsx'
import TodoList from './components/TodoList.jsx'
import Calendar from './components/Calendar.jsx'
import WhatNow from './components/WhatNow.jsx'
import IdeaBank from './components/IdeaBank.jsx'
import Habits from './components/Habits.jsx'
import Projects from './components/Projects.jsx'
import Search from './components/Search.jsx'
import SharedList from './components/SharedList.jsx'
import { PageTransition, toast, SkeletonCard } from './lib/ui.jsx'
import {
  permission as notifPermission,
  requestPermission as requestNotifPermission,
  getReminderPrefs,
  setReminderPrefs,
  scheduleDailyReminder,
  fireTest,
  triggersSupported,
  setBadge,
} from './lib/notify.js'
import { db, exportAll, importAll, pushAllToCloud, todayKey } from './db.js'

/* Penger drar inn recharts — last den modulen først når den åpnes. */
const Money = lazy(() => import('./components/Money.jsx'))

function ScreenFallback() {
  return (
    <div className="screen">
      <div className="screen-scroll">
        <SkeletonCard lines={2} />
        <SkeletonCard lines={3} />
        <SkeletonCard lines={2} />
      </div>
    </div>
  )
}

/* Lucide-ikoner per modul (konsistent, premium ikonsett). */
const ICONS = {
  overview: LayoutGrid,
  today: Sun,
  todo: ListChecks,
  calendar: CalendarDays,
  whatnow: Compass,
  ideas: Lightbulb,
  habits: Repeat,
  money: Wallet,
  projects: FolderKanban,
  search: SearchIcon,
  shared: Users,
  backup: CloudUpload,
  more: MoreHorizontal,
}

/* Faste faner nederst på mobil. Resten ligger i «Mer» (og i sidemenyen på PC). */
const PRIMARY = ['overview', 'today', 'calendar', 'projects']

const MODULES = [
  { k: 'overview', label: 'Oversikt', Comp: Overview },
  { k: 'today', label: 'I dag', Comp: Today },
  { k: 'todo', label: 'Liste', Comp: TodoList },
  { k: 'calendar', label: 'Kalender', Comp: Calendar },
  { k: 'whatnow', label: 'Hva nå?', Comp: WhatNow },
  { k: 'ideas', label: 'Idébank', Comp: IdeaBank },
  { k: 'habits', label: 'Vaner', Comp: Habits },
  { k: 'money', label: 'Penger', Comp: Money },
  { k: 'projects', label: 'Prosjekter', Comp: Projects },
  { k: 'search', label: 'Søk', Comp: Search },
  { k: 'shared', label: 'Delt', Comp: SharedList },
]

/* Sky-sync-status → norsk etikett + farge-LED. */
function syncLabel(s) {
  if (!s) return 'Kobler til…'
  if (s.status === 'offline' || s.phase === 'offline') return 'Frakoblet (jobber lokalt)'
  if (s.status === 'error' || s.phase === 'error') return 'Sync-feil'
  if (s.phase === 'pushing') return 'Laster opp…'
  if (s.phase === 'pulling') return 'Henter…'
  if (s.status === 'connecting') return 'Kobler til…'
  if (s.phase === 'in-sync') return 'Synket ✓'
  if (s.status === 'connected') return 'Tilkoblet'
  return 'Ikke synket enda'
}
function syncLed(s) {
  if (!s) return 'amber'
  if (s.status === 'error' || s.phase === 'error') return 'red'
  if (s.status === 'offline' || s.phase === 'offline') return 'grey'
  if (s.phase === 'in-sync') return 'green'
  return 'amber'
}

function NavIcon({ name }) {
  const Ic = ICONS[name] || ICONS.more
  return <Ic aria-hidden="true" strokeWidth={2} />
}

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
function LoginInteraction() {
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

function LoginScreen() {
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
            Dashboard
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

export default function App() {
  const [active, setActive] = useState('overview')
  const [backupOpen, setBackupOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('theme')
    if (saved) return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const currentUser = useObservable(db.cloud.currentUser)
  const syncState = useObservable(db.cloud.syncState)
  const isLoggedIn = !!currentUser?.isLoggedIn
  const [pushing, setPushing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [reminder, setReminder] = useState(getReminderPrefs)
  const [perm, setPerm] = useState(notifPermission())
  const navRef = useRef(null)

  const itemCount = useLiveQuery(async () => {
    const tabs = ['ideas', 'tasks', 'habits', 'subscriptions', 'projects', 'projectItems', 'events', 'todos', 'expenses', 'budgets', 'incomes', 'goals']
    let n = 0
    for (const t of tabs) n += await db.table(t).count()
    return n
  }, [], null)

  // Antall ting igjen i dag (åpne oppgaver med forfall i dag eller før) → app-ikon-badge.
  const todayRemaining = useLiveQuery(
    () => db.tasks.where('dueDate').belowOrEqual(todayKey()).filter((t) => !t.isDone).count(),
    [],
    0,
  )

  useEffect(() => {
    if (isLoggedIn) setBadge(todayRemaining || 0)
  }, [isLoggedIn, todayRemaining])

  // Hold den daglige påminnelses-kjeden i live (best-effort, der enheten støtter det).
  useEffect(() => {
    if (isLoggedIn) scheduleDailyReminder()
  }, [isLoggedIn, reminder])

  async function toggleReminder() {
    const next = { ...reminder, enabled: !reminder.enabled }
    if (next.enabled && perm !== 'granted') {
      const p = await requestNotifPermission()
      setPerm(p)
      if (p !== 'granted') {
        toast.error('Varsler er ikke tillatt', { description: 'Skru på varsler for appen i enhetsinnstillingene.' })
        return
      }
    }
    setReminder(next)
    setReminderPrefs(next)
    toast.success(next.enabled ? `Påminnelse satt til ${next.time}` : 'Påminnelse av')
  }

  function changeReminderTime(time) {
    const next = { ...reminder, time }
    setReminder(next)
    setReminderPrefs(next)
  }

  async function testNotif() {
    let p = perm
    if (p !== 'granted') {
      p = await requestNotifPermission()
      setPerm(p)
    }
    if (p === 'granted') await fireTest()
    else toast.error('Varsler er ikke tillatt')
  }

  useEffect(() => {
    const el = navRef.current?.querySelector('.nav-item.active')
    if (el) el.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [active])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('theme', theme)
  }, [theme])

  const ActiveComp = MODULES.find((m) => m.k === active).Comp

  if (currentUser === undefined) {
    return (
      <div className="login-overlay">
        <div className="login-loading" aria-label="Laster">
          <span className="login-spinner" />
        </div>
      </div>
    )
  }

  if (!isLoggedIn) return <LoginScreen />

  async function handleExport() {
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    setBackupOpen(false)
    toast.success('Backup lastet ned', { description: 'JSON-fila ligger i Nedlastinger.' })
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const added = await importAll(data)
      const total = Object.values(added).reduce((a, b) => a + b, 0)
      if (total > 0) {
        toast.success(`Importerte ${total} ting`, {
          description: `${added.tasks} oppgaver · ${added.ideas} ideer · ${added.habits} vaner · ${added.subscriptions} abonnement · ${added.projects} prosjekter · ${added.events} hendelser · ${added.todos} gjøremål · ${added.expenses} forbruk.`,
        })
      } else {
        toast.info('Ingenting nytt å importere', { description: 'Alt fantes fra før.' })
      }
    } catch (err) {
      toast.error('Kunne ikke importere', { description: err.message })
    } finally {
      e.target.value = ''
      setBackupOpen(false)
    }
  }

  async function handlePush() {
    setPushing(true)
    try {
      const { total } = await pushAllToCloud()
      toast.success(`Lastet opp ${total} ting til skyen`, {
        description:
          'La appen være åpen på nett noen sekunder til. Logg så inn med samme e-post på de andre enhetene dine.',
        duration: 6000,
      })
    } catch (err) {
      toast.error('Kunne ikke laste opp', { description: err?.message || String(err) })
    } finally {
      setPushing(false)
    }
  }

  async function handleSyncNow() {
    setSyncing(true)
    try {
      await db.cloud.sync({ purpose: 'pull', wait: true })
      toast.success('Synket fra skyen')
    } catch (err) {
      toast.error('Sync feilet', { description: err?.message || String(err) })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="app">
      <LoginInteraction />
      <nav className="nav" ref={navRef}>
        <div className="nav-brand">Dashboard</div>
        {MODULES.map((m) => {
          const on = active === m.k
          return (
            <button
              key={m.k}
              type="button"
              className={'nav-item' + (on ? ' active' : '') + (PRIMARY.includes(m.k) ? '' : ' nav-secondary')}
              aria-current={on ? 'page' : undefined}
              onClick={() => setActive(m.k)}
            >
              {on && (
                <motion.span
                  className="nav-pill"
                  layoutId="nav-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                />
              )}
              <NavIcon name={m.k} />
              <span className="nav-lbl">{m.label}</span>
            </button>
          )
        })}
        <button
          type="button"
          className="nav-item nav-secondary"
          aria-label="Sikkerhetskopi"
          onClick={() => setBackupOpen(true)}
        >
          <NavIcon name="backup" />
          Backup
        </button>
        <button
          type="button"
          className={'nav-item nav-more' + (PRIMARY.includes(active) ? '' : ' active')}
          aria-label="Mer"
          onClick={() => setMoreOpen(true)}
        >
          <NavIcon name="more" />
          Mer
        </button>
      </nav>

      <main className="content">
        <PageTransition id={active}>
          <Suspense fallback={<ScreenFallback />}>
            <ActiveComp onNav={setActive} />
          </Suspense>
        </PageTransition>
      </main>

      <Toaster
        position="bottom-center"
        offset={88}
        gap={8}
        toastOptions={{ duration: 2600 }}
        visibleToasts={3}
      />

      {moreOpen && (
        <div className="more-overlay" role="dialog" aria-modal="true" onClick={() => setMoreOpen(false)}>
          <div className="more-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="more-grip" />
            <h2 className="more-title">Mer</h2>
            <div className="more-grid">
              {MODULES.filter((m) => !PRIMARY.includes(m.k)).map((m) => (
                <button
                  key={m.k}
                  type="button"
                  className={'more-item' + (active === m.k ? ' active' : '')}
                  onClick={() => { setActive(m.k); setMoreOpen(false) }}
                >
                  <NavIcon name={m.k} />
                  <span>{m.label}</span>
                </button>
              ))}
              <button
                type="button"
                className="more-item"
                onClick={() => { setMoreOpen(false); setBackupOpen(true) }}
              >
                <NavIcon name="backup" />
                <span>Backup</span>
              </button>
              <button
                type="button"
                className="more-item"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              >
                <span className="more-theme-glyph">{theme === 'dark' ? '☀️' : '🌙'}</span>
                <span>{theme === 'dark' ? 'Lys modus' : 'Mørk modus'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {backupOpen && (
        <div
          className="backup-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setBackupOpen(false)}
        >
          <div className="backup-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="backup-title">Sky-sync & backup</h2>

            <button
              type="button"
              className="theme-toggle"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            >
              <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
              {theme === 'dark' ? 'Bytt til lys modus' : 'Bytt til mørk modus'}
            </button>

            <div className="rem-box">
              <div className="rem-head">
                <div>
                  <span className="rem-title">Daglig påminnelse</span>
                  <span className="rem-sub">En vennlig dytt om å planlegge dagen.</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={reminder.enabled}
                  className={'rem-switch' + (reminder.enabled ? ' on' : '')}
                  onClick={toggleReminder}
                >
                  <span className="rem-knob" />
                </button>
              </div>

              {reminder.enabled && (
                <div className="rem-time-row">
                  <label className="rem-time-lbl" htmlFor="rem-time">Tidspunkt</label>
                  <input
                    id="rem-time"
                    type="time"
                    className="rem-time"
                    value={reminder.time}
                    onChange={(e) => changeReminderTime(e.target.value)}
                  />
                </div>
              )}

              <button type="button" className="rem-test" onClick={testNotif}>
                Test varsel nå
              </button>

              <p className="rem-note">
                {perm === 'unsupported'
                  ? 'Enheten din støtter ikke varsler.'
                  : !triggersSupported()
                  ? 'På denne enheten (f.eks. iPhone) kan ikke appen sende varsler når den er helt lukket. Du blir minnet på ved neste åpning — og app-ikonet viser hvor mye som gjenstår.'
                  : 'Varselet kan komme selv når appen er lukket. Hold appen installert på hjemskjermen.'}
              </p>
            </div>

            <div className="sync-box">
              <div className="sync-row">
                <span className={'sync-led ' + syncLed(syncState)} />
                <span className="sync-status">{syncLabel(syncState)}</span>
              </div>

              <dl className="sync-diag">
                <div><dt>Ting her nå</dt><dd>{itemCount ?? '…'}</dd></div>
                <div><dt>E-post</dt><dd>{currentUser?.email || '—'}</dd></div>
                <div><dt>Bruker-ID</dt><dd className="mono">{currentUser?.userId || '—'}</dd></div>
              </dl>

              <button
                type="button"
                className="btn backup-action sync-push"
                disabled={pushing}
                onClick={handlePush}
              >
                {pushing ? 'Laster opp…' : 'Last opp alt til skyen'}
              </button>
              <button
                type="button"
                className="btn backup-action sync-now"
                disabled={syncing}
                onClick={handleSyncNow}
              >
                {syncing ? 'Synker…' : 'Synk nå (hent fra skyen)'}
              </button>
              <p className="sync-hint">
                Last opp på enheten som har dataen. På de andre enhetene: logg inn med samme
                e-post og trykk «Synk nå». Bruker-ID må være lik på alle enhetene.
              </p>
              <button
                type="button"
                className="sync-logout"
                onClick={() => db.cloud.logout({ force: true })}
              >
                Logg ut
              </button>
            </div>

            <p className="backup-text">
              Vil du ha en kopi på fil i tillegg? Eksporter en JSON og legg den i iCloud/Drive.
            </p>
            <button type="button" className="btn backup-action" onClick={handleExport}>
              Eksporter alt (last ned JSON)
            </button>
            <label className="btn backup-action">
              Importer fra fil…
              <input type="file" accept="application/json,.json" hidden onChange={handleImport} />
            </label>
            <button
              type="button"
              className="btn btn-ghost backup-action"
              onClick={() => setBackupOpen(false)}
            >
              Lukk
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
