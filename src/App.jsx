import { useState } from 'react'
import { useObservable } from 'dexie-react-hooks'
import './components/AppShell.css'
import Overview from './components/Overview.jsx'
import Today from './components/Today.jsx'
import WhatNow from './components/WhatNow.jsx'
import IdeaBank from './components/IdeaBank.jsx'
import Habits from './components/Habits.jsx'
import Money from './components/Money.jsx'
import Projects from './components/Projects.jsx'
import { db, exportAll, importAll } from './db.js'

const ICONS = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
    </>
  ),
  ideas: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 00-3.8 10.6c.6.5.8 1.2.8 1.9h6c0-.7.2-1.4.8-1.9A6 6 0 0012 3z" />
    </>
  ),
  habits: (
    <>
      <path d="M21 12a9 9 0 11-2.6-6.4" />
      <path d="M21 4v4h-4" />
    </>
  ),
  money: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18M16.5 14.5h.5" />
    </>
  ),
  projects: (
    <>
      <path d="M3 7a2 2 0 012-2h3.5l2 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
    </>
  ),
  overview: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  whatnow: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  backup: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
}

const MODULES = [
  { k: 'overview', label: 'Oversikt', Comp: Overview },
  { k: 'today', label: 'I dag', Comp: Today },
  { k: 'whatnow', label: 'Hva nå?', Comp: WhatNow },
  { k: 'ideas', label: 'Idébank', Comp: IdeaBank },
  { k: 'habits', label: 'Vaner', Comp: Habits },
  { k: 'money', label: 'Penger', Comp: Money },
  { k: 'projects', label: 'Prosjekter', Comp: Projects },
]

function NavIcon({ name }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      {ICONS[name]}
    </svg>
  )
}

function LoginScreen() {
  return (
    <div className="login-overlay">
      <div className="login-card">
        <h1 className="login-title">Dashboard</h1>
        <p className="login-text">Logg inn for å synke data på tvers av enhetene dine.</p>
        <button
          type="button"
          className="btn login-btn"
          onClick={() => db.cloud.login()}
        >
          Logg inn med e-post
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [active, setActive] = useState('overview')
  const [backupOpen, setBackupOpen] = useState(false)
  const currentUser = useObservable(db.cloud.currentUser)
  const isLoggedIn = currentUser && !currentUser.isAnonymous

  const ActiveComp = MODULES.find((m) => m.k === active).Comp

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
  }

  async function handleImport(e) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = JSON.parse(await file.text())
      const added = await importAll(data)
      const total = Object.values(added).reduce((a, b) => a + b, 0)
      window.alert(
        total > 0
          ? `Importerte ${total} ting:\n` +
              `${added.tasks} oppgaver, ${added.ideas} ideer, ${added.habits} vaner, ` +
              `${added.subscriptions} abonnement, ${added.projects} prosjekter.`
          : 'Ingenting nytt å importere (alt fantes fra før).',
      )
    } catch (err) {
      window.alert('Kunne ikke importere: ' + err.message)
    } finally {
      e.target.value = ''
      setBackupOpen(false)
    }
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-brand">Dashboard</div>
        {MODULES.map((m) => (
          <button
            key={m.k}
            type="button"
            className={'nav-item' + (active === m.k ? ' active' : '')}
            aria-current={active === m.k ? 'page' : undefined}
            onClick={() => setActive(m.k)}
          >
            <NavIcon name={m.k} />
            {m.label}
          </button>
        ))}
        <button
          type="button"
          className="nav-item"
          aria-label="Sikkerhetskopi"
          onClick={() => setBackupOpen(true)}
        >
          <NavIcon name="backup" />
          Backup
        </button>
      </nav>

      <main className="content">
        <ActiveComp onNav={setActive} />
      </main>

      {backupOpen && (
        <div
          className="backup-overlay"
          role="dialog"
          aria-modal="true"
          onClick={() => setBackupOpen(false)}
        >
          <div className="backup-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="backup-title">Sikkerhetskopi</h2>
            <p className="backup-text">
              Alt ligger lokalt på enheten. Last ned en backup av og til, og legg fila i
              iCloud/Drive — så kan du flytte data eller hente alt tilbake.
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
