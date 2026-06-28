import Dexie from 'dexie'

// Lokal-først: all data ligger på enheten i IndexedDB. Ingen backend.
export const db = new Dexie('dashboard')

// v1: bare idébanken.
db.version(1).stores({
  ideas: 'id, category, createdAt',
})

// v2: hele dashboardet — én store per modul.
db.version(2).stores({
  ideas: 'id, category, createdAt',
  tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
  habits: 'id, sortOrder, createdAt',
  subscriptions: 'id, createdAt',
  projects: 'id, status, sortOrder, createdAt',
})

const uid = () => crypto.randomUUID()
const now = () => Date.now()

/** Lokal datonøkkel YYYY-MM-DD (ikke UTC). */
export function todayKey(d = new Date()) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/* =========================================================
   IDÉBANK
   ========================================================= */
export async function listIdeas() {
  return db.ideas.orderBy('createdAt').reverse().toArray()
}
export async function addIdea(text) {
  const idea = {
    id: uid(),
    text: text.trim(),
    category: 'ny',
    isFavorite: false,
    note: '',
    createdAt: now(),
  }
  await db.ideas.add(idea)
  return idea
}
export const updateIdea = (id, patch) => db.ideas.update(id, patch)
export const deleteIdea = (id) => db.ideas.delete(id)

/* =========================================================
   I DAG (oppgaver)
   - dueDate = YYYY-MM-DD. «Henger igjen» = dueDate før i dag og ikke gjort.
   ========================================================= */
export async function listTasks() {
  return db.tasks.orderBy('createdAt').reverse().toArray()
}
export async function addTask(title) {
  const task = {
    id: uid(),
    title: title.trim(),
    isDone: false,
    isFocus: false,
    dueDate: todayKey(),
    completedAt: null,
    sortOrder: now(),
    createdAt: now(),
  }
  await db.tasks.add(task)
  return task
}
export const updateTask = (id, patch) => db.tasks.update(id, patch)
export const deleteTask = (id) => db.tasks.delete(id)
export async function setTaskDone(id, done) {
  await db.tasks.update(id, {
    isDone: done,
    isFocus: done ? false : undefined,
    completedAt: done ? now() : null,
    // når man angrer fullføring havner den tilbake på i dag
    dueDate: done ? undefined : todayKey(),
  })
}
export const setTaskFocus = (id, focus) => db.tasks.update(id, { isFocus: focus })
export const carryTaskToToday = (id) => db.tasks.update(id, { dueDate: todayKey() })

/* =========================================================
   VANER
   - history = liste av YYYY-MM-DD der vanen ble gjort. Ingen skam-streaks.
   ========================================================= */
export async function listHabits() {
  return db.habits.orderBy('sortOrder').toArray()
}
export async function addHabit(name) {
  const habit = { id: uid(), name: name.trim(), history: [], sortOrder: now(), createdAt: now() }
  await db.habits.add(habit)
  return habit
}
export const updateHabit = (id, patch) => db.habits.update(id, patch)
export const deleteHabit = (id) => db.habits.delete(id)
export async function toggleHabitDay(id, dayKey = todayKey()) {
  const h = await db.habits.get(id)
  if (!h) return
  const history = new Set(h.history || [])
  if (history.has(dayKey)) history.delete(dayKey)
  else history.add(dayKey)
  await db.habits.update(id, { history: [...history] })
}

/* =========================================================
   PENGER (abonnement)
   - cycle: 'monthly' | 'yearly'. amount i kr.
   ========================================================= */
export async function listSubscriptions() {
  return db.subscriptions.orderBy('createdAt').reverse().toArray()
}
export async function addSubscription({ name, amount, cycle = 'monthly' }) {
  const sub = { id: uid(), name: name.trim(), amount: Number(amount) || 0, cycle, createdAt: now() }
  await db.subscriptions.add(sub)
  return sub
}
export const updateSubscription = (id, patch) => db.subscriptions.update(id, patch)
export const deleteSubscription = (id) => db.subscriptions.delete(id)
/** Månedlig kostnad for ett abonnement (årlig deles på 12). */
export const monthlyCost = (s) => (s.cycle === 'yearly' ? (s.amount || 0) / 12 : s.amount || 0)

/* =========================================================
   PROSJEKTER
   - status: 'aktiv' | 'pause' | 'ferdig'
   ========================================================= */
export async function listProjects() {
  return db.projects.orderBy('sortOrder').reverse().toArray()
}
export async function addProject(name) {
  const p = {
    id: uid(),
    name: name.trim(),
    status: 'aktiv',
    note: '',
    sortOrder: now(),
    createdAt: now(),
  }
  await db.projects.add(p)
  return p
}
export const updateProject = (id, patch) => db.projects.update(id, patch)
export const deleteProject = (id) => db.projects.delete(id)

/* =========================================================
   BACKUP — eksport/import av HELE dashboardet
   ========================================================= */
const TABLES = ['ideas', 'tasks', 'habits', 'subscriptions', 'projects']

export async function exportAll() {
  const out = { type: 'dashboard-backup', version: 2, exportedAt: new Date().toISOString() }
  for (const t of TABLES) out[t] = await db.table(t).toArray()
  return out
}

/** Slår sammen alle stores på id (eksisterende hoppes over). Returnerer antall nye per modul. */
export async function importAll(data) {
  if (!data || typeof data !== 'object') throw new Error('Ugyldig backup-fil.')
  const added = {}
  for (const t of TABLES) {
    const incoming = Array.isArray(data[t]) ? data[t] : []
    if (!incoming.length) {
      added[t] = 0
      continue
    }
    const existing = new Set(await db.table(t).toCollection().primaryKeys())
    const toAdd = incoming
      .filter((row) => row && typeof row === 'object')
      .map((row) => ({ ...row, id: typeof row.id === 'string' && row.id ? row.id : uid() }))
      .filter((row) => !existing.has(row.id))
    if (toAdd.length) await db.table(t).bulkAdd(toAdd)
    added[t] = toAdd.length
  }
  return added
}
