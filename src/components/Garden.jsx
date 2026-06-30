/* eslint-disable react-refresh/only-export-components */
import { useLiveQuery } from 'dexie-react-hooks'
import { db, todayKey, monthlyCost } from '../db.js'
import './Garden.css'

/* Hagen din — en rolig, levende scene som speiler uka.
   Vaner = blomster (størrelse etter 14-dagers jevnhet, blomstrer hvis gjort i dag),
   aktive prosjekter = trær (knopper hvis et «nå»-steg finnes),
   fullførte oppgaver i dag = sommerfugler, dagens fokus = sol/varme,
   penger på stell = klar himmel vs. en mild sky.
   Ingen skam: ingenting visner eller dør. */

const HABIT_HEX = {
  forest: '#42634a', amber: '#cc882b', blue: '#5f86b0',
  rose: '#b4574a', plum: '#9c7a98', slate: '#5e6b6f',
}
const habitHex = (k) => HABIT_HEX[k] || HABIT_HEX.forest

function lastNKeys(n) {
  return [...Array(n)].map((_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    return todayKey(d)
  })
}

function skyFor(hour) {
  if (hour < 5 || hour >= 22) return { top: '#2b3350', bot: '#3d4a5e', sun: '#cdd6e8', night: true }
  if (hour < 11) return { top: '#cfe6ea', bot: '#eef3e6', sun: '#f0c265', night: false } // morgen
  if (hour < 17) return { top: '#c4e0ea', bot: '#eef3e6', sun: '#f2c14e', night: false } // dag
  return { top: '#e7cdb0', bot: '#f1e6d6', sun: '#e7973f', night: false } // kveld
}

function Flower({ x, ground, scale, color, bloom }) {
  const h = 46 * scale // stilkhøyde
  const headY = ground - h
  const petalR = (bloom ? 7 : 5.4) * scale
  const petals = bloom ? 6 : 5
  return (
    <g className={'g-flower' + (bloom ? ' bloom' : '')} style={{ transformOrigin: `${x}px ${ground}px` }}>
      <path d={`M${x} ${ground} Q ${x - 3} ${ground - h / 2} ${x} ${headY}`} stroke="#5c7d54" strokeWidth={2.2 * scale} fill="none" strokeLinecap="round" />
      <path d={`M${x} ${ground - h * 0.45} q -9 -3 -13 4 q 9 4 13 -4`} fill="#6f9462" opacity="0.9" />
      {[...Array(petals)].map((_, i) => {
        const a = (Math.PI * 2 * i) / petals
        return <circle key={i} cx={x + Math.cos(a) * petalR * 1.05} cy={headY + Math.sin(a) * petalR * 1.05} r={petalR} fill={color} opacity={bloom ? 0.95 : 0.78} />
      })}
      <circle cx={x} cy={headY} r={petalR * 0.7} fill={bloom ? '#f6e7c4' : '#e9ecdf'} />
      {bloom && <circle className="g-dew" cx={x + petalR} cy={headY - petalR} r={1.7} fill="#fff" />}
    </g>
  )
}

function Tree({ x, ground, hasBud }) {
  const top = ground - 70
  return (
    <g className="g-tree">
      <rect x={x - 3} y={top + 26} width="6" height="46" rx="3" fill="#7a5b3f" />
      <circle cx={x} cy={top + 20} r="26" fill="#5a7f50" />
      <circle cx={x - 16} cy={top + 30} r="18" fill="#69906a" />
      <circle cx={x + 16} cy={top + 30} r="18" fill="#4f7449" />
      {hasBud && [[-10, 14], [12, 22], [0, 30]].map(([dx, dy], i) => (
        <circle key={i} className="g-bud" cx={x + dx} cy={top + dy} r="3.2" fill="#e7973f" />
      ))}
    </g>
  )
}

function Butterfly({ x, y, i }) {
  return (
    <g className="g-butterfly" style={{ ['--d']: `${i * 0.7}s`, transformOrigin: `${x}px ${y}px` }}>
      <ellipse cx={x - 3} cy={y} rx="3.4" ry="5" fill="#cc882b" opacity="0.9" />
      <ellipse cx={x + 3} cy={y} rx="3.4" ry="5" fill="#e8a53d" opacity="0.9" />
      <line x1={x} y1={y - 4} x2={x} y2={y + 4} stroke="#3c3326" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  )
}

/* Delt aggregering — brukt av både Hage-siden og mini-kortet på Oversikt. */
export function useGardenData() {
  const today = todayKey()
  return useLiveQuery(async () => {
    const [habits, tasks, projects, nowItems, incomes, subs, expenses] = await Promise.all([
      db.habits.filter((h) => !h.archived).toArray(),
      db.tasks.where('dueDate').belowOrEqual(today).toArray(),
      db.projects.where('status').equals('active').toArray(),
      db.projectItems.where('stage').equals('now').toArray(),
      db.incomes.toArray(),
      db.subscriptions.toArray(),
      db.expenses.toArray(),
    ])
    const win = lastNKeys(14)
    const flowers = habits.map((h) => {
      const hist = new Set(h.history || [])
      const recent = win.filter((k) => hist.has(k)).length
      return { color: habitHex(h.color), consistency: recent / 14, bloom: hist.has(today), name: h.name }
    })
    const dayTasks = tasks
    const doneToday = dayTasks.filter((t) => t.isDone && t.completedAt && todayKey(new Date(t.completedAt)) === today).length
    const totalToday = dayTasks.length
    const focusPct = totalToday ? doneToday / totalToday : 0
    const budProjects = new Set(nowItems.map((i) => i.projectId))
    const trees = projects.map((p) => ({ hasBud: budProjects.has(p.id), name: p.name }))
    const ym = today.slice(0, 7)
    const spent = expenses.filter((e) => (e.date || '').slice(0, 7) === ym).reduce((s, e) => s + (e.amount || 0), 0) + subs.reduce((s, x) => s + monthlyCost(x), 0)
    const income = incomes.reduce((s, i) => s + (i.amount || 0), 0)
    return {
      flowers, trees,
      doneToday, totalToday, focusPct,
      moneyOk: income === 0 ? true : income - spent >= 0,
      habitsDone: flowers.filter((f) => f.bloom).length,
    }
  }, [today], null)
}

export function gardenCaption(data) {
  if (!data) return ''
  const { flowers, trees, doneToday, totalToday, habitsDone } = data
  const empty = flowers.length === 0 && trees.length === 0 && totalToday === 0
  if (empty) return 'Hagen din vokser når du tar vare på ting. Begynn med én liten ting i dag.'
  return [
    habitsDone > 0 && `${habitsDone} ${habitsDone === 1 ? 'vane' : 'vaner'} passet på`,
    doneToday > 0 && `${doneToday} gjort i dag`,
    trees.length > 0 && `${trees.length} ${trees.length === 1 ? 'prosjekt' : 'prosjekter'} gror`,
  ].filter(Boolean).join(' · ') || 'Rolig dag. Hagen hviler.'
}

/* Selve SVG-scenen. `compact` brukes på mini-kortet (litt færre detaljer). */
export function GardenScene({ data, compact = false }) {
  const hour = new Date().getHours()
  const sky = skyFor(hour)
  const { flowers, trees, doneToday, totalToday } = data
  const focusPct = data.focusPct
  const empty = flowers.length === 0 && trees.length === 0 && totalToday === 0

  const W = 400, H = 280, ground = 214
  const sunX = hour < 11 ? 80 : hour < 17 ? 200 : 320
  const sunY = hour < 11 || hour >= 17 ? 92 : 66
  const sunGlow = 0.35 + 0.65 * focusPct

  const fShown = flowers.slice(0, compact ? 6 : 9)
  const tShown = trees.slice(0, compact ? 3 : 5)
  const butterflies = Math.min(doneToday, compact ? 3 : 6)
  const uid = compact ? 'c' : 'f'

  return (
    <svg className={'g-svg' + (sky.night ? ' night' : '')} viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Hagen din" preserveAspectRatio="xMidYMax slice">
      <defs>
        <linearGradient id={`g-sky-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={sky.top} />
          <stop offset="100%" stopColor={sky.bot} />
        </linearGradient>
        <radialGradient id={`g-sun-${uid}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={sky.sun} stopOpacity={sunGlow} />
          <stop offset="100%" stopColor={sky.sun} stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width={W} height={H} fill={`url(#g-sky-${uid})`} />

      <circle className="g-sunglow" cx={sunX} cy={sunY} r="58" fill={`url(#g-sun-${uid})`} />
      <circle className="g-sun" cx={sunX} cy={sunY} r="20" fill={sky.sun} opacity={sky.night ? 0.7 : 0.9} />

      {sky.night && [[60, 50], [140, 36], [330, 60], [280, 40], [200, 30]].map(([x, y], i) => (
        <circle key={i} className="g-star" cx={x} cy={y} r="1.4" fill="#fff" style={{ ['--d']: `${i * 0.5}s` }} />
      ))}

      {!data.moneyOk && (
        <g className="g-cloud" opacity="0.85">
          <ellipse cx="300" cy="70" rx="30" ry="15" fill="#dfe3da" />
          <ellipse cx="320" cy="64" rx="20" ry="13" fill="#e8ebe3" />
          <ellipse cx="284" cy="64" rx="16" ry="11" fill="#e8ebe3" />
        </g>
      )}

      <path d={`M0 ${ground} Q 120 ${ground - 46} 240 ${ground - 8} T ${W} ${ground - 20} L ${W} ${H} L 0 ${H} Z`} fill="#9cc08f" opacity="0.55" />
      <path d={`M0 ${ground + 6} Q 160 ${ground - 14} ${W} ${ground + 10} L ${W} ${H} L 0 ${H} Z`} fill="#7aa46f" />

      {tShown.map((t, i) => (
        <Tree key={i} x={tShown.length === 1 ? 300 : 70 + i * (260 / Math.max(1, tShown.length - 1))} ground={ground - 4} hasBud={t.hasBud} />
      ))}

      {fShown.map((f, i) => {
        const n = fShown.length
        const x = n === 1 ? W / 2 : 36 + i * ((W - 72) / (n - 1))
        const scale = 0.62 + f.consistency * 0.7
        return <Flower key={i} x={x} ground={ground + 40} scale={scale} color={f.color} bloom={f.bloom} />
      })}

      {[...Array(butterflies)].map((_, i) => (
        <Butterfly key={i} i={i} x={70 + ((i * 67) % 260)} y={120 + ((i * 37) % 60)} />
      ))}

      {empty && (
        <g className="g-sprout">
          <path d={`M${W / 2} ${ground + 36} L ${W / 2} ${ground + 4}`} stroke="#5c7d54" strokeWidth="3" strokeLinecap="round" />
          <path d={`M${W / 2} ${ground + 16} q -12 -6 -16 4 q 12 5 16 -4`} fill="#6f9462" />
          <path d={`M${W / 2} ${ground + 22} q 12 -6 16 4 q -12 5 -16 -4`} fill="#7aa46f" />
        </g>
      )}
    </svg>
  )
}

export default function Garden({ onNav }) {
  const data = useGardenData()
  if (!data) return <div className="screen" />

  const { flowers, trees, totalToday } = data
  const empty = flowers.length === 0 && trees.length === 0 && totalToday === 0
  const caption = gardenCaption(data)

  return (
    <div className="screen garden">
      <div className="screen-scroll">
        <h1 className="scr-title">Hagen din</h1>
        <p className="scr-sub">Et speil av uka — den vokser når du viser opp.</p>

        <div className="g-frame">
          <GardenScene data={data} />
          <p className="g-caption">{caption}</p>
        </div>

        {!empty && (
          <div className="g-legend">
            <button type="button" className="g-leg" onClick={() => onNav?.('habits')}>
              <span className="g-leg-dot flower" /> Vaner = blomster
            </button>
            <button type="button" className="g-leg" onClick={() => onNav?.('projects')}>
              <span className="g-leg-dot tree" /> Prosjekter = trær
            </button>
            <button type="button" className="g-leg" onClick={() => onNav?.('today')}>
              <span className="g-leg-dot fly" /> Gjort i dag = sommerfugler
            </button>
          </div>
        )}

        {empty && (
          <button type="button" className="g-start" onClick={() => onNav?.('today')}>
            Plant noe i dag
          </button>
        )}
      </div>
    </div>
  )
}
