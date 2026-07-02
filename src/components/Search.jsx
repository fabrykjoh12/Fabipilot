import { useState, useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'

/* Moduler en treff kan hoppe til (matcher MODULES-nøklene i App.jsx). */
const TYPES = {
  task: { label: 'Oppgave', emoji: '✅', mod: 'today' },
  idea: { label: 'Idébank', emoji: '💡', mod: 'ideas' },
  project: { label: 'Prosjekt', emoji: '📁', mod: 'projects' },
  step: { label: 'Prosjektsteg', emoji: '↳', mod: 'projects' },
  event: { label: 'Kalender', emoji: '📅', mod: 'calendar' },
  habit: { label: 'Vane', emoji: '🌿', mod: 'habits' },
  expense: { label: 'Forbruk', emoji: '💸', mod: 'money' },
  sub: { label: 'Abonnement', emoji: '💳', mod: 'money' },
}

/** Marker treffene i teksten. */
function Highlight({ text, q }) {
  const i = text.toLowerCase().indexOf(q.toLowerCase())
  if (i < 0 || !q) return <>{text}</>
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

export default function Search({ onNav }) {
  const [q, setQ] = useState('')

  const all = useLiveQuery(async () => {
    const [tasks, ideas, projects, steps, events, habits, expenses, subs] = await Promise.all([
      db.tasks.toArray(),
      db.ideas.toArray(),
      db.projects.toArray(),
      db.projectItems.toArray(),
      db.events.toArray(),
      db.habits.toArray(),
      db.expenses.toArray(),
      db.subscriptions.toArray(),
    ])
    const out = []
    for (const t of tasks) out.push({ id: 't' + t.id, type: 'task', text: t.title, sub: t.dueDate || '' })
    for (const i of ideas) out.push({ id: 'i' + i.id, type: 'idea', text: i.text, sub: (i.tags || []).map((x) => '#' + x).join(' ') })
    for (const p of projects) out.push({ id: 'p' + p.id, type: 'project', text: p.name, sub: p.why || '' })
    for (const s of steps) out.push({ id: 's' + s.id, type: 'step', text: s.text, sub: '' })
    for (const e of events) out.push({ id: 'e' + e.id, type: 'event', text: e.title, sub: [e.date, e.time].filter(Boolean).join(' ') })
    for (const h of habits) out.push({ id: 'h' + h.id, type: 'habit', text: h.name, sub: '' })
    for (const x of expenses) out.push({ id: 'x' + x.id, type: 'expense', text: x.note || '(forbruk)', sub: x.date || '' })
    for (const s of subs) out.push({ id: 'b' + s.id, type: 'sub', text: s.name, sub: '' })
    return out
  }, [], [])

  const query = q.trim().toLowerCase()
  const results = useMemo(() => {
    if (!query) return []
    return all
      .filter((r) => (r.text || '').toLowerCase().includes(query) || (r.sub || '').toLowerCase().includes(query))
      .slice(0, 60)
  }, [all, query])

  return (
    <div className="screen">
      <div className="screen-scroll">
        <h1 className="scr-title">Søk</h1>
        <p className="scr-sub">Finn alt — oppgaver, idéer, prosjekter, hendelser, forbruk.</p>

        <div className="search-box">
          <svg className="search-ico" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            className="search-input"
            type="search"
            placeholder="Søk på tvers…"
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {q && (
            <button type="button" className="search-clear" aria-label="Tøm" onClick={() => setQ('')}>×</button>
          )}
        </div>

        {!query ? (
          <div className="empty">
            <div className="glyph">🔎</div>
            <p className="em-ttl">Begynn å skrive</p>
            <p>Ett søkefelt for hele dashbordet. Trykk på et treff for å hoppe rett dit.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="empty">
            <div className="glyph">🤷</div>
            <p className="em-ttl">Ingen treff på «{q}»</p>
            <p>Prøv et annet ord.</p>
          </div>
        ) : (
          <>
            <p className="search-count">{results.length} treff</p>
            <div className="search-results">
              {results.map((r) => {
                const meta = TYPES[r.type]
                return (
                  <button
                    key={r.id}
                    type="button"
                    className="search-row"
                    onClick={() => onNav?.(meta.mod)}
                  >
                    <span className="search-emoji">{meta.emoji}</span>
                    <span className="search-main">
                      <span className="search-text"><Highlight text={r.text || ''} q={query} /></span>
                      {r.sub && <span className="search-meta"><Highlight text={r.sub} q={query} /></span>}
                    </span>
                    <span className="search-tag">{meta.label}</span>
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
