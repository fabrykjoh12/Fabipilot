import { useLiveQuery } from 'dexie-react-hooks'
import {
  listTasks,
  listHabits,
  listSubscriptions,
  listProjects,
  listIdeas,
  monthlyCost,
  todayKey,
} from '../db.js'
import { kr } from '../lib/fx.js'

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'God natt'
  if (h < 11) return 'God morgen'
  if (h < 17) return 'God dag'
  if (h < 22) return 'God kveld'
  return 'God natt'
}

const STAR = (
  <svg viewBox="0 0 24 24">
    <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7 6.9 19.2l1-5.6-4.1-4 5.7-.8z" />
  </svg>
)
const ARROW = (
  <svg viewBox="0 0 24 24">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
)

const ICONS = {
  today: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.4 1.4M17.6 17.6L19 19M19 5l-1.4 1.4M6.4 17.6L5 19" />
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
  projects: <path d="M3 7a2 2 0 012-2h3.5l2 2H19a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />,
  ideas: (
    <>
      <path d="M9.5 18h5M10.5 21h3" />
      <path d="M12 3a6 6 0 00-3.8 10.6c.6.5.8 1.2.8 1.9h6c0-.7.2-1.4.8-1.9A6 6 0 0012 3z" />
    </>
  ),
}

function Badge({ name, forest }) {
  return (
    <span className={'ov-badge' + (forest ? ' forest' : '')}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        {ICONS[name]}
      </svg>
    </span>
  )
}

function Card({ icon, forest, title, sub, span, onClick, children }) {
  return (
    <button type="button" className={'ov-card' + (span ? ' ' + span : '')} onClick={onClick}>
      <div className="ov-card-top">
        <Badge name={icon} forest={forest} />
        <div style={{ minWidth: 0 }}>
          <div className="ov-card-title">{title}</div>
          {sub && <div className="ov-card-sub">{sub}</div>}
        </div>
        <span className="ov-go">{ARROW}</span>
      </div>
      {children}
    </button>
  )
}

function last7Keys() {
  return [...Array(7)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (6 - i))
    return todayKey(d)
  })
}

export default function Overview({ go }) {
  const tasks = useLiveQuery(() => listTasks(), [], [])
  const habits = useLiveQuery(() => listHabits(), [], [])
  const subs = useLiveQuery(() => listSubscriptions(), [], [])
  const projects = useLiveQuery(() => listProjects(), [], [])
  const ideas = useLiveQuery(() => listIdeas(), [], [])
  const today = todayKey()

  // I dag
  const open = tasks.filter((t) => !t.isDone)
  const todays = open.filter((t) => !t.dueDate || t.dueDate >= today)
  const carry = open.filter((t) => t.dueDate && t.dueDate < today)
  const focus = todays.filter((t) => t.isFocus)
  const doneToday = tasks.filter(
    (t) => t.isDone && t.completedAt && todayKey(new Date(t.completedAt)) === today,
  )
  const openCount = todays.length + carry.length
  const totalTasks = openCount + doneToday.length
  const pct = totalTasks ? Math.round((doneToday.length / totalTasks) * 100) : 0

  // Ring-geometri
  const R = 42
  const C = 2 * Math.PI * R
  const dash = C * (1 - pct / 100)

  // Vaner
  const habitsDone = habits.filter((h) => (h.history || []).includes(today)).length
  const week = last7Keys()
  const anyHabitWeek = week.map((k) => habits.some((h) => (h.history || []).includes(k)))

  // Penger
  const totalMonth = subs.reduce((sum, s) => sum + monthlyCost(s), 0)

  // Prosjekter
  const activeProjects = projects.filter((p) => p.status !== 'ferdig')

  // Ideer
  const recentIdeas = ideas.slice(0, 3)

  return (
    <div className="screen wide">
      <div className="screen-scroll">
        <div className="ov-head">
          <div className="ov-greet">
            <p className="scr-eyebrow">
              {new Intl.DateTimeFormat('nb-NO', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              }).format(new Date())}
            </p>
            <h1 className="scr-title">{greeting()}, Fabi</h1>
          </div>
        </div>

        <div className="ov-grid">
          {/* I dag */}
          <Card
            icon="today"
            title="I dag"
            sub={
              totalTasks === 0
                ? 'ingenting planlagt'
                : `${doneToday.length} av ${totalTasks} gjort`
            }
            span="span2"
            onClick={() => go('today')}
          >
            <div className="ov-today-body">
              <div className="ring" aria-hidden="true">
                <svg viewBox="0 0 100 100">
                  <circle className="track" cx="50" cy="50" r={R} />
                  <circle
                    className="bar"
                    cx="50"
                    cy="50"
                    r={R}
                    strokeDasharray={C}
                    strokeDashoffset={dash}
                  />
                </svg>
                <div className="ring-label">
                  <span className="ring-pct">{pct}%</span>
                  <span className="ring-cap">ferdig</span>
                </div>
              </div>
              <div className="ov-focus">
                {focus.length > 0 ? (
                  focus.slice(0, 3).map((t) => (
                    <div key={t.id} className="ov-focus-row">
                      <span className="star">{STAR}</span>
                      <span className="txt">{t.title}</span>
                    </div>
                  ))
                ) : openCount > 0 ? (
                  <p className="ov-empty-line">
                    {openCount} {openCount === 1 ? 'oppgave' : 'oppgaver'} igjen. Stjernemerk det
                    viktigste for å sette fokus.
                  </p>
                ) : totalTasks > 0 ? (
                  <p className="ov-empty-line">Alt unnagjort for i dag. Fint jobba. 🌿</p>
                ) : (
                  <p className="ov-empty-line">Blank dag — legg til det første du vil få gjort.</p>
                )}
              </div>
            </div>
          </Card>

          {/* Vaner */}
          <Card
            icon="habits"
            forest
            title="Vaner"
            sub={
              habits.length === 0
                ? 'ingen enda'
                : `${habitsDone} av ${habits.length} i dag`
            }
            onClick={() => go('habits')}
          >
            <div className="ov-week" aria-hidden="true">
              {anyHabitWeek.map((on, i) => (
                <span key={i} className={'d' + (on ? ' on' : '')} />
              ))}
            </div>
          </Card>

          {/* Penger */}
          <Card
            icon="money"
            title="Penger"
            sub={`${subs.length} ${subs.length === 1 ? 'abonnement' : 'abonnement'} · per måned`}
            onClick={() => go('money')}
          >
            <div className="ov-big">{kr(totalMonth)}</div>
          </Card>

          {/* Prosjekter */}
          <Card
            icon="projects"
            forest
            title="Prosjekter"
            sub={
              projects.length === 0
                ? 'ingen enda'
                : `${activeProjects.length} i gang`
            }
            onClick={() => go('projects')}
          >
            {activeProjects.length > 0 ? (
              <div className="ov-list">
                {activeProjects.slice(0, 3).map((p) => (
                  <div key={p.id} className="ov-li">
                    <span className={'ov-dot' + (p.status === 'pause' ? ' muted' : ' forest')} />
                    <span className="txt">{p.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ov-empty-line">Legg til en større ting du jobber mot.</p>
            )}
          </Card>

          {/* Idébank */}
          <Card
            icon="ideas"
            title="Idébank"
            sub={ideas.length === 0 ? 'tom enda' : `${ideas.length} fanget`}
            onClick={() => go('ideas')}
          >
            {recentIdeas.length > 0 ? (
              <div className="ov-list">
                {recentIdeas.map((i) => (
                  <div key={i.id} className="ov-li">
                    <span className={'ov-dot' + (i.isFavorite ? '' : ' muted')} />
                    <span className="txt">{i.text}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="ov-empty-line">
                Neste gang noe kult slår deg — dump det her og sorter senere.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
