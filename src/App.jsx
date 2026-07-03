import { useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useObservable, useLiveQuery } from 'dexie-react-hooks'
import { Toaster } from 'sonner'
import { motion } from 'motion/react'
import { Plus } from 'lucide-react'
import './components/AppShell.css'
import Overview from './components/Overview.jsx'
import Tasks from './components/Tasks.jsx'
import Calendar from './components/Calendar.jsx'
import WhatNow from './components/WhatNow.jsx'
import IdeaBank from './components/IdeaBank.jsx'
import Habits from './components/Habits.jsx'
import SharedList from './components/SharedList.jsx'
import ShoppingList from './components/ShoppingList.jsx'
import Garden from './components/Garden.jsx'
import Capture from './components/Capture.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import NavIcon from './components/NavIcon.jsx'
import LoginScreen, { LoginInteraction } from './components/Login.jsx'
import BackupSheet from './components/BackupSheet.jsx'
import { PageTransition, toast, ScreenSkeleton } from './lib/ui.jsx'
import { syncLabel, syncLed } from './lib/sync.js'
import {
  permission as notifPermission,
  requestPermission as requestNotifPermission,
  getReminderPrefs,
  setReminderPrefs,
  scheduleDailyReminder,
  fireTest,
  setBadge,
} from './lib/notify.js'
import { db, exportAll, importAll, pushAllToCloud, seedStarterPack, todayKey } from './db.js'

/* Tunge moduler lastes først når de åpnes (Penger drar inn recharts,
   Prosjekter er den største modulen). */
const Money = lazy(() => import('./components/Money.jsx'))
const Projects = lazy(() => import('./components/Projects.jsx'))

function ScreenFallback() {
  return <ScreenSkeleton />
}

/* Faste faner nederst på mobil. Resten ligger i «Mer» (og i sidemenyen på PC). */
const PRIMARY = ['overview', 'today', 'calendar', 'projects']

/* Moduler med egen «legg til»-linje nederst — der skjuler vi den flytende capture-knappen. */
const HAS_COMPOSER = new Set(['today', 'ideas', 'habits', 'projects', 'whatnow', 'shared', 'shopping'])

const MODULES = [
  { k: 'overview', label: 'Oversikt', Comp: Overview },
  { k: 'today', label: 'Oppgaver', Comp: Tasks },
  { k: 'calendar', label: 'Kalender', Comp: Calendar },
  { k: 'whatnow', label: 'Hva nå?', Comp: WhatNow },
  { k: 'ideas', label: 'Idébank', Comp: IdeaBank },
  { k: 'habits', label: 'Vaner', Comp: Habits },
  { k: 'money', label: 'Penger', Comp: Money },
  { k: 'projects', label: 'Prosjekter', Comp: Projects },
  { k: 'shared', label: 'Delt', Comp: SharedList },
  { k: 'shopping', label: 'Handleliste', Comp: ShoppingList },
  { k: 'garden', label: 'Hage', Comp: Garden },
]

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
  const led = syncLed(syncState)
  const itemCount = useLiveQuery(async () => {
    const tabs = ['ideas', 'tasks', 'habits', 'subscriptions', 'projects', 'projectItems', 'events', 'expenses', 'budgets', 'incomes', 'goals']
    let n = 0
    for (const t of tabs) n += await db.table(t).count()
    return n
  }, [], null)
  const [pushing, setPushing] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [reminder, setReminder] = useState(getReminderPrefs)
  const [perm, setPerm] = useState(notifPermission())
  const [captureOpen, setCaptureOpen] = useState(false)
  const navRef = useRef(null)
  const syncErrNotified = useRef(false)

  // Ny app-versjon: service workeren venter til brukeren sier ja (registerType: 'prompt').
  useEffect(() => {
    let updateSW
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        updateSW = registerSW({
          onNeedRefresh() {
            toast.message('Ny versjon klar ✨', {
              description: 'Oppdater for å få de siste endringene.',
              duration: Infinity,
              action: { label: 'Oppdater', onClick: () => updateSW?.(true) },
            })
          },
        })
      })
      .catch(() => {}) // dev uten SW-støtte — helt ok
  }, [])

  // Startpakke: tilby eksempler første gang en helt tom konto er i synk.
  const [starterOpen, setStarterOpen] = useState(false)
  useEffect(() => {
    if (!isLoggedIn || localStorage.getItem('starterOffered')) return
    if (itemCount === 0 && (led === 'green' || led === 'grey')) {
      // liten pause så synken får satt seg før vi tilbyr eksempler
      const id = setTimeout(() => setStarterOpen(true), 400)
      return () => clearTimeout(id)
    }
  }, [isLoggedIn, itemCount, led])

  async function chooseStarter(withExamples) {
    localStorage.setItem('starterOffered', '1')
    setStarterOpen(false)
    if (withExamples) {
      await seedStarterPack()
      toast.success('Eksempler lagt inn ✨', {
        description: 'Et lite prosjekt, tre oppgaver og to vaner — alt kan slettes.',
      })
    }
  }

  // Mild backup-påminnelse: >30 dager siden sist (eller siden første besøk),
  // og aldri oftere enn ukentlig. Ett trykk åpner backup-panelet.
  useEffect(() => {
    if (!isLoggedIn) return
    const first = Number(localStorage.getItem('backupFirstSeen') || 0)
    if (!first) { localStorage.setItem('backupFirstSeen', String(Date.now())); return }
    const ref = Number(localStorage.getItem('lastBackup') || 0) || first
    const nudged = Number(localStorage.getItem('backupNudgedAt') || 0)
    const DAY = 86400000
    if (Date.now() - ref > 30 * DAY && Date.now() - nudged > 7 * DAY) {
      localStorage.setItem('backupNudgedAt', String(Date.now()))
      toast.message('🗄️ En stund siden sist backup', {
        description: 'Ta en rask JSON-backup — god samvittighet på 5 sekunder.',
        duration: 12000,
        action: { label: 'Ta backup', onClick: () => setBackupOpen(true) },
      })
    }
  }, [isLoggedIn])

  // Sync-feil: si fra én gang (ikke mas), nullstill når vi er i synk igjen.
  useEffect(() => {
    if (led === 'red' && !syncErrNotified.current) {
      syncErrNotified.current = true
      toast.error('Synkronisering feiler', {
        description: 'Endringene dine lagres trygt lokalt. Sjekk nett — eller prøv igjen fra Mer → Synk nå.',
      })
    }
    if (led === 'green') syncErrNotified.current = false
  }, [led])

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

  // ⌘K / Ctrl+K åpner hurtiglagring fra hvor som helst; Escape lukker skallets ark.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault()
        setCaptureOpen((o) => !o)
      }
      if (e.key === 'Escape') {
        setMoreOpen(false)
        setBackupOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

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
    a.download = `fabipilot-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    localStorage.setItem('lastBackup', String(Date.now()))
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
        <div className="nav-brand">
          Fabipilot
          {(led === 'red' || led === 'grey') && (
            <span className={'sync-dot ' + led} title={syncLabel(syncState)} aria-label={syncLabel(syncState)} />
          )}
        </div>
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
          {(led === 'red' || led === 'grey') && <span className={'sync-dot ' + led} aria-hidden="true" />}
        </button>
      </nav>

      <main className="content">
        <PageTransition id={active}>
          {/* key={active}: bytter du fane etter et krasj, prøver den nye skjermen automatisk på nytt */}
          <ErrorBoundary key={active}>
            <Suspense fallback={<ScreenFallback />}>
              <ActiveComp onNav={setActive} />
            </Suspense>
          </ErrorBoundary>
        </PageTransition>
      </main>

      {!HAS_COMPOSER.has(active) && (
        <button
          type="button"
          className="cap-fab"
          aria-label="Legg til noe (⌘K)"
          title="Legg til noe (⌘K)"
          onClick={() => setCaptureOpen(true)}
        >
          <Plus />
        </button>
      )}

      <Capture open={captureOpen} onClose={() => setCaptureOpen(false)} onNav={setActive} />

      {starterOpen && (
        <div className="backup-overlay" role="dialog" aria-modal="true">
          <div className="backup-card starter-card">
            <div className="starter-glyph" aria-hidden="true">🌱</div>
            <h2 className="backup-title">Vil du starte med eksempler?</h2>
            <p className="backup-text">
              Jeg kan legge inn et lite demo-prosjekt, tre oppgaver og to vaner, så du ser
              hvordan alt henger sammen. Alt kan slettes etterpå.
            </p>
            <button type="button" className="btn backup-action" onClick={() => chooseStarter(true)}>
              Ja, vis meg med eksempler
            </button>
            <button type="button" className="btn btn-ghost backup-action" onClick={() => chooseStarter(false)}>
              Start blankt
            </button>
          </div>
        </div>
      )}

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
        <BackupSheet
          theme={theme}
          onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
          reminder={reminder}
          onToggleReminder={toggleReminder}
          onChangeReminderTime={changeReminderTime}
          onTestNotif={testNotif}
          perm={perm}
          syncState={syncState}
          currentUser={currentUser}
          itemCount={itemCount}
          pushing={pushing}
          onPush={handlePush}
          syncing={syncing}
          onSyncNow={handleSyncNow}
          onExport={handleExport}
          onImport={handleImport}
          onClose={() => setBackupOpen(false)}
        />
      )}
    </div>
  )
}
