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

// v3: prosjekter blir roadmaps (projects + projectItems).
db.version(3)
  .stores({
    ideas: 'id, category, createdAt',
    tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
    habits: 'id, sortOrder, createdAt',
    subscriptions: 'id, createdAt',
    projects: 'id, status, lastTouched, createdAt',
    projectItems: 'id, projectId, stage, sortOrder, createdAt',
  })
  .upgrade(async (tx) => {
    const map = { aktiv: 'active', pause: 'onice', ferdig: 'done' }
    await tx
      .table('projects')
      .toCollection()
      .modify((p) => {
        p.status = map[p.status] || (['active', 'onice', 'done'].includes(p.status) ? p.status : 'active')
        if (p.why === undefined) p.why = p.note || ''
        if (p.lastTouched === undefined) p.lastTouched = p.createdAt || Date.now()
        delete p.note
        delete p.sortOrder
      })
  })

// v4: legg sortOrder tilbake på projects for manuell sortering.
db.version(4)
  .stores({
    ideas: 'id, category, createdAt',
    tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
    habits: 'id, sortOrder, createdAt',
    subscriptions: 'id, createdAt',
    projects: 'id, status, sortOrder, lastTouched, createdAt',
    projectItems: 'id, projectId, stage, sortOrder, createdAt',
  })
  .upgrade(async (tx) => {
    const all = await tx.table('projects').orderBy('lastTouched').reverse().toArray()
    for (let i = 0; i < all.length; i++) {
      await tx.table('projects').update(all[i].id, { sortOrder: i * 1000 })
    }
  })

const uid = () => crypto.randomUUID()
const now = () => Date.now()

/** Lokal datonøkkel YYYY-MM-DD (ikke UTC). */
export function todayKey(d = new Date()) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const MAX_ACTIVE_PROJECTS = 3

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
    dueDate: done ? undefined : todayKey(),
  })
}
export const setTaskFocus = (id, focus) => db.tasks.update(id, { isFocus: focus })
export const carryTaskToToday = (id) => db.tasks.update(id, { dueDate: todayKey() })

/* =========================================================
   VANER
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
export const monthlyCost = (s) => (s.cycle === 'yearly' ? (s.amount || 0) / 12 : s.amount || 0)

/* =========================================================
   PROSJEKTER (roadmaps)
   - projects: id, name, why, status('active'|'onice'|'done'), createdAt, lastTouched
   - projectItems: id, projectId, text, stage('now'|'next'|'later'|'done'), energy('lav'|'hoy'|null), sortOrder, createdAt
   - «Neste steg» = første item med stage='now' (etter sortOrder).
   ========================================================= */
export async function listProjects() {
  return db.projects.orderBy('sortOrder').toArray()
}
export const getProject = (id) => db.projects.get(id)
export const countActiveProjects = () => db.projects.where('status').equals('active').count()

export async function addProject({ name, why = '', status = 'active' }) {
  const maxOrder = await db.projects.orderBy('sortOrder').last()
  const p = {
    id: uid(),
    name: name.trim(),
    why: why.trim ? why.trim() : why,
    status,
    sortOrder: maxOrder ? (maxOrder.sortOrder ?? 0) + 1000 : 0,
    createdAt: now(),
    lastTouched: now(),
  }
  await db.projects.add(p)
  return p
}

export async function moveProject(id, direction) {
  const all = await db.projects.orderBy('sortOrder').toArray()
  const idx = all.findIndex((p) => p.id === id)
  const swapIdx = idx + direction
  if (swapIdx < 0 || swapIdx >= all.length) return
  const a = all[idx], b = all[swapIdx]
  const aOrder = a.sortOrder ?? idx * 1000
  const bOrder = b.sortOrder ?? swapIdx * 1000
  await db.projects.update(a.id, { sortOrder: bOrder })
  await db.projects.update(b.id, { sortOrder: aOrder })
}
export const updateProject = (id, patch) => db.projects.update(id, { ...patch, lastTouched: now() })
export async function deleteProject(id) {
  await db.projectItems.where('projectId').equals(id).delete()
  await db.projects.delete(id)
}

/** Returnerer true hvis status ble satt, false hvis WIP-taket blokkerte. */
export async function setProjectStatus(id, status) {
  if (status === 'active') {
    const current = await db.projects.get(id)
    if (current?.status !== 'active') {
      const active = await countActiveProjects()
      if (active >= MAX_ACTIVE_PROJECTS) return false
    }
  }
  await db.projects.update(id, { status, lastTouched: now() })
  return true
}

/* ---- items ---- */
export async function listProjectItems(projectId) {
  return db.projectItems.where('projectId').equals(projectId).sortBy('sortOrder')
}
const touch = (projectId) => db.projects.update(projectId, { lastTouched: now() })

export async function addProjectItem(projectId, text, stage = 'next') {
  const item = {
    id: uid(),
    projectId,
    text: text.trim(),
    stage,
    energy: null,
    sortOrder: now(),
    createdAt: now(),
  }
  await db.projectItems.add(item)
  await touch(projectId)
  return item
}
export async function setItemStage(item, stage) {
  await db.projectItems.update(item.id, { stage })
  await touch(item.projectId)
}
const FORWARD = { later: 'next', next: 'now', now: 'done', done: 'done' }
export async function advanceItem(item) {
  await db.projectItems.update(item.id, { stage: FORWARD[item.stage] || item.stage })
  await touch(item.projectId)
}
export async function setItemEnergy(item, energy) {
  await db.projectItems.update(item.id, { energy })
  await touch(item.projectId)
}
export async function deleteProjectItem(item) {
  await db.projectItems.delete(item.id)
  await touch(item.projectId)
}

/** Forfremm en idé til et nytt prosjekt. Respekterer WIP-taket. */
export async function promoteIdeaToProject(idea) {
  const active = await countActiveProjects()
  const status = active >= MAX_ACTIVE_PROJECTS ? 'onice' : 'active'
  const project = await addProject({ name: idea.text, why: '', status })
  await db.ideas.delete(idea.id)
  return { project, status, capReached: status === 'onice' }
}

/* =========================================================
   BACKUP — eksport/import av HELE dashboardet
   ========================================================= */
const TABLES = ['ideas', 'tasks', 'habits', 'subscriptions', 'projects', 'projectItems']

export async function exportAll() {
  const out = { type: 'dashboard-backup', version: 3, exportedAt: new Date().toISOString() }
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
