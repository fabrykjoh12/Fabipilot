import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayKey, monthlyCost } from '../db.js'
import { kr } from '../lib/fx.js'
import './Overview.css'

/* Standard rekkefølge på Oversikt-kortene. Lagres tilpasset i localStorage. */
const DEFAULT_ORDER = ['today', 'habits', 'money', 'projects', 'ideas']
const CARD_LABEL = { today: 'I dag', habits: 'Vaner', money: 'Penger', projects: 'Prosjekter', ideas: 'Idébank' }

function loadCfg() {
  try {
    const raw = JSON.parse(localStorage.getItem('ovCards') || '{}')
    const order = Array.isArray(raw.order) ? raw.order.filter((k) => DEFAULT_ORDER.includes(k)) : []
    for (const k of DEFAULT_ORDER) if (!order.includes(k)) order.push(k) // nye kort havner bakerst
    const hidden = Array.isArray(raw.hidden) ? raw.hidden.filter((k) => DEFAULT_ORDER.includes(k)) : []
    return { order, hidden }
  } catch {
    return { order: [...DEFAULT_ORDER], hidden: [] }
  }
}

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'God natt'
  if (h < 11) return 'God morgen'
  if (h < 17) return 'God dag'
  if (h < 22) return 'God kveld'
  return 'God natt'
}

function fmtDate() {
  return new Intl.DateTimeFormat('nb-NO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())
}

const PEPTALK = [
  'Én ting av gangen er nok i dag.',
  'Du trenger ikke gjøre alt — bare det neste.',
  'Små steg teller. Virkelig.',
  'Ferdig er bedre enn perfekt.',
  'Pust. Du har dette.',
  'Velg én ting. Start der.',
  'Det er lov å gjøre lite i dag.',
  'Fremgang, ikke press.',
]
function peptalk() {
  const d = new Date()
  return PEPTALK[d.getDate() % PEPTALK.length]
}

const ICONS = {
  today: (
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" /></svg>
  ),
  habits: (
    <svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 11-2.6-6.4" /><path d="M21 4v4h-4" /></svg>
  ),
  money: (
    <svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M16.5 14.5h.5" /></svg>
  ),
  projects: (
    <svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 012-2h3.5l2 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
  ),
  ideas: (
    <svg viewBox="0 0 24 24"><path d="M9.5 18h5M10.5 21h3" /><path d="M12 3a6 6 0 00-3.8 10.6c.6.5.8 1.2.8 1.9h6c0-.7.2-1.4.8-1.9A6 6 0 0012 3z" /></svg>
  ),
  arrow: (
    <svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
  ),
}

function OvCard({ icon, color, title, sub, onClick, children }) {
  return (
    <button type="button" className="ov-card" onClick={onClick}>
      <div className="ov-card-top">
        <div className="ov-icon" style={{ background: color + '22', color }}>
          {icon}
        </div>
        <div className="ov-card-label">
          <span className="ov-title">{title}</span>
          <span className="ov-sub">{sub}</span>
        </div>
        <div className="ov-arrow">{ICONS.arrow}</div>
      </div>
      {children && <div className="ov-card-body">{children}</div>}
    </button>
  )
}

function ProgressCircle({ pct }) {
  const r = 20
  const circ = 2 * Math.PI * r
  const dash = circ * (pct / 100)
  return (
    <svg className="ov-prog-circle" viewBox="0 0 52 52">
      <circle cx="26" cy="26" r={r} className="ov-prog-bg" />
      <circle cx="26" cy="26" r={r} className="ov-prog-fill" strokeDasharray={`${dash} ${circ}`} />
      <text x="26" y="26" className="ov-prog-pct">{pct}%</text>
      <text x="26" y="36" className="ov-prog-lbl">FERDIG</text>
    </svg>
  )
}

export default function Overview({ onNav }) {
  const today = todayKey()
  const [cfg, setCfg] = useState(loadCfg)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    localStorage.setItem('ovCards', JSON.stringify(cfg))
  }, [cfg])

  function move(key, dir) {
    setCfg((c) => {
      const order = [...c.order]
      const i = order.indexOf(key)
      const j = i + dir
      if (j < 0 || j >= order.length) return c
      ;[order[i], order[j]] = [order[j], order[i]]
      return { ...c, order }
    })
  }
  function toggleHide(key) {
    setCfg((c) => ({
      ...c,
      hidden: c.hidden.includes(key) ? c.hidden.filter((k) => k !== key) : [...c.hidden, key],
    }))
  }

  const tasks = useLiveQuery(() => db.tasks.where('dueDate').belowOrEqual(today).toArray(), [today], [])
  const habits = useLiveQuery(() => db.habits.toArray(), [], [])
  const subs = useLiveQuery(() => db.subscriptions.toArray(), [], [])
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray(), [], [])
  const ideas = useLiveQuery(() => db.ideas.count(), [], 0)
  const nowItems = useLiveQuery(() => db.projectItems.where('stage').equals('now').sortBy('sortOrder'), [], [])

  const todayTasks = tasks.filter((t) => !t.isDone)
  const doneTasks = tasks.filter((t) => t.isDone)
  const total = tasks.length
  const pct = total ? Math.round((doneTasks.length / total) * 100) : 0

  const habitsDoneToday = habits.filter((h) => (h.history || []).includes(today)).length

  const totalMonth = subs.reduce((sum, s) => sum + monthlyCost(s), 0)

  const nextByProject = {}
  for (const it of nowItems) if (!nextByProject[it.projectId]) nextByProject[it.projectId] = it

  const last7 = [...Array(7)].map((_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (6 - i))
    const key = todayKey(d)
    return { key, done: habits.some((h) => (h.history || []).includes(key)) }
  })

  const CARDS = {
    today: (
      <OvCard
        icon={ICONS.today}
        color="var(--accent)"
        title="I dag"
        sub={total === 0 ? 'ingenting planlagt' : `${todayTasks.length} igjen av ${total}`}
        onClick={editing ? undefined : () => onNav('today')}
      >
        <div className="ov-today-body">
          <ProgressCircle pct={pct} />
          <p className="ov-today-msg">
            {total === 0
              ? 'Blank dag — legg til det første du vil få gjort.'
              : pct === 100
              ? 'Alt gjort. Bra jobba.'
              : todayTasks.length === 1
              ? 'Én ting igjen — det klarer du.'
              : `${todayTasks.length} ting igjen.`}
          </p>
        </div>
      </OvCard>
    ),
    habits: (
      <OvCard
        icon={ICONS.habits}
        color="var(--forest)"
        title="Vaner"
        sub={habits.length === 0 ? 'ingen enda' : `${habitsDoneToday} av ${habits.length} i dag`}
        onClick={editing ? undefined : () => onNav('habits')}
      >
        {habits.length > 0 && (
          <div className="ov-habit-dots">
            {last7.map((d) => (
              <span key={d.key} className={'ov-hdot' + (d.done ? ' on' : '') + (d.key === today ? ' today' : '')} />
            ))}
          </div>
        )}
      </OvCard>
    ),
    money: (
      <OvCard
        icon={ICONS.money}
        color="#6b8cba"
        title="Penger"
        sub={`${subs.length} abonnement · per måned`}
        onClick={editing ? undefined : () => onNav('money')}
      >
        <span className="ov-total">{kr(totalMonth)}</span>
      </OvCard>
    ),
    projects: (
      <OvCard
        icon={ICONS.projects}
        color="var(--forest)"
        title="Prosjekter"
        sub={projects.length === 0 ? 'ingen enda' : `${projects.length} aktive`}
        onClick={editing ? undefined : () => onNav('projects')}
      >
        {projects.length === 0 ? (
          <p className="ov-desc">Legg til en større ting du jobber mot.</p>
        ) : (
          <ul className="ov-list">
            {projects.slice(0, 3).map((p) => (
              <li key={p.id}>
                <span className="ov-list-emoji">{p.emoji || '🗂️'}</span>
                {p.name}
              </li>
            ))}
          </ul>
        )}
      </OvCard>
    ),
    ideas: (
      <OvCard
        icon={ICONS.ideas}
        color="var(--accent)"
        title="Idébank"
        sub={ideas === 0 ? 'tom enda' : `${ideas} ideer`}
        onClick={editing ? undefined : () => onNav('ideas')}
      >
        <p className="ov-desc">
          {ideas === 0
            ? 'Neste gang noe kult slår deg — dump det her og sorter senere.'
            : `${ideas} ting lagret.`}
        </p>
      </OvCard>
    ),
  }

  const visible = cfg.order.filter((k) => !cfg.hidden.includes(k))

  return (
    <div className="screen ov-screen">
      <div className="screen-scroll">
        <div className="ov-head">
          <div>
            <p className="ov-date">{fmtDate()}</p>
            <h1 className="ov-greeting">{greeting()}, Fabi</h1>
            <p className="ov-peptalk">{peptalk()}</p>
          </div>
          <button type="button" className={'ov-edit-btn' + (editing ? ' on' : '')} onClick={() => setEditing((e) => !e)}>
            {editing ? 'Ferdig' : 'Tilpass'}
          </button>
        </div>

        {visible.length === 0 && !editing && (
          <div className="empty">
            <div className="glyph">🫥</div>
            <p className="em-ttl">Alle kort er skjult</p>
            <p>Trykk «Tilpass» for å hente dem tilbake.</p>
          </div>
        )}

        <div className="ov-grid">
          {visible.map((key, i) => (
            <div key={key} className={'ov-cell' + (editing ? ' editing' : '')}>
              {editing && (
                <div className="ov-edit-bar">
                  <button type="button" className="ov-eb" aria-label="Flytt opp" disabled={i === 0} onClick={() => move(key, -1)}>▲</button>
                  <button type="button" className="ov-eb" aria-label="Flytt ned" disabled={i === visible.length - 1} onClick={() => move(key, 1)}>▼</button>
                  <button type="button" className="ov-eb ov-eb-hide" onClick={() => toggleHide(key)}>Skjul</button>
                </div>
              )}
              {CARDS[key]}
            </div>
          ))}
        </div>

        {editing && cfg.hidden.length > 0 && (
          <div className="ov-hidden">
            <span className="ov-hidden-lbl">Skjulte kort</span>
            <div className="ov-hidden-chips">
              {cfg.hidden.map((key) => (
                <button key={key} type="button" className="ov-chip" onClick={() => toggleHide(key)}>
                  + {CARD_LABEL[key]}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
