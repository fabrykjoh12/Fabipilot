/* eslint-disable react-refresh/only-export-components */
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db.js'

/* Søkeindeks på tvers av modulene — brukes av ⌘K-paletten (Capture).
   Hvert treff peker på modulen sin (matcher MODULES-nøklene i App.jsx). */
export const SEARCH_TYPES = {
  task: { label: 'Oppgave', emoji: '✅', mod: 'today' },
  idea: { label: 'Idébank', emoji: '💡', mod: 'ideas' },
  project: { label: 'Prosjekt', emoji: '📁', mod: 'projects' },
  step: { label: 'Prosjektsteg', emoji: '↳', mod: 'projects' },
  event: { label: 'Kalender', emoji: '📅', mod: 'calendar' },
  habit: { label: 'Vane', emoji: '🌿', mod: 'habits' },
  expense: { label: 'Forbruk', emoji: '💸', mod: 'money' },
  sub: { label: 'Abonnement', emoji: '💳', mod: 'money' },
}

/** Bygger hele indeksen. `enabled=false` → tom liste (koster ingenting). */
export function useSearchIndex(enabled = true) {
  return useLiveQuery(
    async () => {
      if (!enabled) return []
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
    },
    [enabled],
    [],
  )
}

/** Marker søketreffet i teksten. */
export function Highlight({ text, q }) {
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
