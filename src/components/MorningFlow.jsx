import { useLiveQuery } from 'dexie-react-hooks'
import { motion } from 'motion/react'
import { Sunrise, Star, CalendarClock, Wallet, ArrowRight, Check } from 'lucide-react'
import { db, todayKey, monthlyCost, setTaskFocus, carryTaskToToday } from '../db.js'
import { kr, vibrate } from '../lib/fx.js'
import { toast } from '../lib/ui.jsx'
import './MorningFlow.css'

const MAX_FOCUS = 3

function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'God natt'
  if (h < 11) return 'God morgen'
  if (h < 17) return 'God dag'
  if (h < 22) return 'God kveld'
  return 'God natt'
}

const PEP = [
  'Velg én ting. Start der.',
  'Tre ting er nok. Resten kan vente.',
  'Du trenger ikke gjøre alt — bare det neste.',
  'Rolig start teller også.',
  'Litt i dag er bedre enn alt i morgen.',
]

export default function MorningFlow({ onNav, onDone }) {
  const today = todayKey()

  const data = useLiveQuery(async () => {
    const [tasks, events, incomes, subs, expenses] = await Promise.all([
      db.tasks.filter((t) => !t.isDone).toArray(),
      db.events.where('date').equals(today).toArray(),
      db.incomes.toArray(),
      db.subscriptions.toArray(),
      db.expenses.toArray(),
    ])
    const carried = tasks.filter((t) => t.dueDate && t.dueDate < today)
    const todays = tasks.filter((t) => !t.dueDate || t.dueDate >= today)
    const ym = today.slice(0, 7)
    const monthSpent =
      expenses.filter((e) => (e.date || '').slice(0, 7) === ym).reduce((s, e) => s + (e.amount || 0), 0) +
      subs.reduce((s, x) => s + monthlyCost(x), 0)
    const income = incomes.reduce((s, i) => s + (i.amount || 0), 0)
    return {
      carried,
      todays,
      events: events.sort((a, b) => (a.time || '99').localeCompare(b.time || '99')),
      left: income > 0 ? income - monthSpent : null,
    }
  }, [today], null)

  if (!data) return null

  const { carried, todays, events, left } = data
  const focusCount = todays.filter((t) => t.isFocus).length
  const nextEvent = events.find((e) => e.time) || events[0]

  function toggleFocus(t) {
    if (!t.isFocus && focusCount >= MAX_FOCUS) {
      toast.message('Maks 3 i fokus — hold det enkelt 🌱')
      return
    }
    vibrate(8)
    setTaskFocus(t.id, !t.isFocus)
  }

  async function carryAll() {
    await Promise.all(carried.map((t) => carryTaskToToday(t.id)))
    vibrate(8)
    toast.success(`Tok med ${carried.length} ${carried.length === 1 ? 'ting' : 'ting'} til i dag`)
  }

  return (
    <motion.section
      className="mf"
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mf-glow" aria-hidden="true" />
      <header className="mf-head">
        <span className="mf-eyebrow"><Sunrise /> Start dagen</span>
        <h2 className="mf-title">{greeting()}, Fabi</h2>
        <p className="mf-pep">{PEP[new Date().getDate() % PEP.length]}</p>
      </header>

      {carried.length > 0 && (
        <div className="mf-carry">
          <span className="mf-carry-txt">
            {carried.length} {carried.length === 1 ? 'ting henger' : 'ting henger'} igjen fra før
          </span>
          <button type="button" className="mf-carry-btn" onClick={carryAll}>
            Ta med i dag
          </button>
        </div>
      )}

      <div className="mf-block">
        <span className="mf-block-lbl">Velg inntil 3 å fokusere på</span>
        {todays.length === 0 ? (
          <p className="mf-empty">Ingenting planlagt enda. Legg til noe i «I dag» når du er klar.</p>
        ) : (
          <ul className="mf-tasks">
            {todays.slice(0, 7).map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={'mf-task' + (t.isFocus ? ' on' : '')}
                  aria-pressed={t.isFocus}
                  onClick={() => toggleFocus(t)}
                >
                  <span className="mf-task-star"><Star /></span>
                  <span className="mf-task-ttl">{t.title}</span>
                  {t.estimate ? <span className="mf-task-est">{t.estimate}m</span> : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mf-stats">
        <button type="button" className="mf-stat" onClick={() => onNav('calendar')}>
          <CalendarClock />
          <span className="mf-stat-main">
            {events.length === 0
              ? 'Ingen avtaler'
              : `${events.length} ${events.length === 1 ? 'avtale' : 'avtaler'}`}
          </span>
          {nextEvent?.time && <span className="mf-stat-sub">neste {nextEvent.time}</span>}
        </button>
        {left !== null && (
          <button type="button" className="mf-stat" onClick={() => onNav('money')}>
            <Wallet />
            <span className="mf-stat-main">{kr(left)}</span>
            <span className="mf-stat-sub">igjen å bruke</span>
          </button>
        )}
      </div>

      <button type="button" className="mf-go" onClick={onDone}>
        <Check /> Sett i gang
      </button>
      <button type="button" className="mf-skip" onClick={() => onNav('today')}>
        Hopp til «I dag» <ArrowRight />
      </button>
    </motion.section>
  )
}
