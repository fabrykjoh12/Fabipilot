import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { Sun, Repeat, Wallet, FolderKanban, Lightbulb, ArrowRight, Flower2, Star } from 'lucide-react'
import { db, todayKey, monthlyCost, setTaskDone } from '../db.js'
import { kr, burst, vibrate } from '../lib/fx.js'
import { AnimatedNumber, Reveal } from '../lib/ui.jsx'
import MorningFlow from './MorningFlow.jsx'
import { useGardenData, GardenScene } from './Garden.jsx'
import './Overview.css'

/* Standard rekkefølge på Oversikt-kortene. Lagres tilpasset i localStorage. */
const DEFAULT_ORDER = ['today', 'habits', 'money', 'projects', 'ideas', 'garden']
const CARD_LABEL = { today: 'I dag', habits: 'Vaner', money: 'Penger', projects: 'Prosjekter', ideas: 'Idébank', garden: 'Hage' }

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
  today: <Sun />,
  habits: <Repeat />,
  money: <Wallet />,
  projects: <FolderKanban />,
  ideas: <Lightbulb />,
  garden: <Flower2 />,
  arrow: <ArrowRight />,
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
  const [showRitual, setShowRitual] = useState(() => !localStorage.getItem(`ritual:${today}`))

  function dismissRitual(e) {
    localStorage.setItem(`ritual:${today}`, '1')
    if (e?.currentTarget) burst(e.currentTarget)
    vibrate([10, 24, 10])
    setShowRitual(false)
  }

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
  const gardenData = useGardenData()

  const todayTasks = tasks.filter((t) => !t.isDone)
  const nextTasks = [...todayTasks.filter((t) => t.isFocus), ...todayTasks.filter((t) => !t.isFocus)].slice(0, 3)
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
          <div className="ov-today-right">
            {nextTasks.length === 0 ? (
              <p className="ov-today-msg">
                {total === 0 ? 'Blank dag — legg til det første du vil få gjort.' : 'Alt gjort. Bra jobba.'}
              </p>
            ) : (
              <div className="ov-tasklist">
                {nextTasks.map((t) => (
                  <div key={t.id} className="ov-task-row">
                    <span
                      className="ov-check"
                      role="checkbox"
                      tabIndex={0}
                      aria-checked="false"
                      aria-label={`Fullfør ${t.title}`}
                      onClick={(e) => { e.stopPropagation(); vibrate([12, 30, 12]); burst(e.currentTarget); setTaskDone(t.id, true) }}
                      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); setTaskDone(t.id, true) } }}
                    />
                    <span className="ov-task-ttl">
                      {t.isFocus && <Star className="ov-task-star" />}
                      {t.title}
                    </span>
                  </div>
                ))}
                {todayTasks.length > nextTasks.length && (
                  <span className="ov-more">+{todayTasks.length - nextTasks.length} til</span>
                )}
              </div>
            )}
          </div>
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
        <AnimatedNumber className="ov-total" value={totalMonth} format={kr} />
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
    garden: (
      <OvCard
        icon={ICONS.garden}
        color="var(--forest)"
        title="Hagen din"
        sub={
          gardenData && (gardenData.habitsDone > 0 || gardenData.doneToday > 0)
            ? `${gardenData.habitsDone} vaner passet på · ${gardenData.doneToday} gjort i dag`
            : 'et speil av uka'
        }
        onClick={editing ? undefined : () => onNav('garden')}
      >
        <div className="ov-garden-scene">
          {gardenData && <GardenScene data={gardenData} compact />}
        </div>
      </OvCard>
    ),
  }

  const visible = cfg.order.filter((k) => !cfg.hidden.includes(k))

  return (
    <div className="screen ov-screen">
      <div className="screen-scroll">
        {showRitual && <MorningFlow onNav={onNav} onDone={dismissRitual} />}
        {!showRitual && (
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
        )}

        {visible.length === 0 && !editing && (
          <div className="empty">
            <div className="glyph">🫥</div>
            <p className="em-ttl">Alle kort er skjult</p>
            <p>Trykk «Tilpass» for å hente dem tilbake.</p>
          </div>
        )}

        <div className="ov-grid">
          {visible.map((key, i) => (
            <Reveal key={key} i={i} className={'ov-cell ov-cell-' + key + (editing ? ' editing' : '')}>
              {editing && (
                <div className="ov-edit-bar">
                  <button type="button" className="ov-eb" aria-label="Flytt opp" disabled={i === 0} onClick={() => move(key, -1)}>▲</button>
                  <button type="button" className="ov-eb" aria-label="Flytt ned" disabled={i === visible.length - 1} onClick={() => move(key, 1)}>▼</button>
                  <button type="button" className="ov-eb ov-eb-hide" onClick={() => toggleHide(key)}>Skjul</button>
                </div>
              )}
              {CARDS[key]}
            </Reveal>
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
