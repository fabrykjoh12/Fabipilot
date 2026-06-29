import Dexie from 'dexie'
import dexieCloud from 'dexie-cloud-addon'

// Lokal-først med sky-sync via Dexie Cloud.
export const db = new Dexie('dashboard', { addons: [dexieCloud] })

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

// v5: kalender — events-store.
db.version(5).stores({
  ideas: 'id, category, createdAt',
  tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
  habits: 'id, sortOrder, createdAt',
  subscriptions: 'id, createdAt',
  projects: 'id, status, sortOrder, lastTouched, createdAt',
  projectItems: 'id, projectId, stage, sortOrder, createdAt',
  events: 'id, date, createdAt',
})

// v6: enkel gjøremålsliste uten dato — todos-store.
db.version(6).stores({
  ideas: 'id, category, createdAt',
  tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
  habits: 'id, sortOrder, createdAt',
  subscriptions: 'id, createdAt',
  projects: 'id, status, sortOrder, lastTouched, createdAt',
  projectItems: 'id, projectId, stage, sortOrder, createdAt',
  events: 'id, date, createdAt',
  todos: 'id, isDone, sortOrder, createdAt',
})

// v7: budsjett — expenses (logget forbruk) + budgets (månedsbudsjett per kategori).
db.version(7).stores({
  ideas: 'id, category, createdAt',
  tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
  habits: 'id, sortOrder, createdAt',
  subscriptions: 'id, createdAt',
  projects: 'id, status, sortOrder, lastTouched, createdAt',
  projectItems: 'id, projectId, stage, sortOrder, createdAt',
  events: 'id, date, createdAt',
  todos: 'id, isDone, sortOrder, createdAt',
  expenses: 'id, date, category, createdAt',
  budgets: 'id, category, createdAt',
})

// v8: penger — incomes (månedsinntekt) + goals (sparemål).
db.version(8).stores({
  ideas: 'id, category, createdAt',
  tasks: 'id, isDone, isFocus, dueDate, sortOrder, createdAt',
  habits: 'id, sortOrder, createdAt',
  subscriptions: 'id, createdAt',
  projects: 'id, status, sortOrder, lastTouched, createdAt',
  projectItems: 'id, projectId, stage, sortOrder, createdAt',
  events: 'id, date, createdAt',
  todos: 'id, isDone, sortOrder, createdAt',
  expenses: 'id, date, category, createdAt',
  budgets: 'id, category, createdAt',
  incomes: 'id, createdAt',
  goals: 'id, createdAt',
})

db.cloud.configure({
  databaseUrl: 'https://zl78q9yu3.dexie.cloud',
  requireAuth: false,
  customLoginGui: true,
})

const uid = () => crypto.randomUUID()
const now = () => Date.now()

/** Lokal datonøkkel YYYY-MM-DD (ikke UTC). */
export function todayKey(d = new Date()) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
/** Datonøkkel for i morgen. */
export function tomorrowKey() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return todayKey(d)
}
/** Neste forekomst-dato for en gjentakelse ('daily'|'weekly'|'monthly'). */
export function nextDate(key, repeat) {
  const [y, m, d] = key.split('-').map(Number)
  if (repeat === 'daily') return todayKey(new Date(y, m - 1, d + 1))
  if (repeat === 'weekly') return todayKey(new Date(y, m - 1, d + 7))
  if (repeat === 'monthly') return todayKey(new Date(y, m, d))
  return key
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
    tags: [],
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
    estimate: null,
    repeat: 'none',
    sortOrder: now(),
    createdAt: now(),
  }
  await db.tasks.add(task)
  return task
}
export const updateTask = (id, patch) => db.tasks.update(id, patch)
export const deleteTask = (id) => db.tasks.delete(id)
export async function setTaskDone(id, done) {
  const t = await db.tasks.get(id)
  await db.tasks.update(id, {
    isDone: done,
    isFocus: done ? false : undefined,
    completedAt: done ? now() : null,
    dueDate: done ? undefined : todayKey(),
  })
  // Gjentakende oppgave: lag neste forekomst når den hukes av.
  if (done && t && t.repeat && t.repeat !== 'none') {
    await db.tasks.add({
      id: uid(),
      title: t.title,
      isDone: false,
      isFocus: false,
      dueDate: nextDate(t.dueDate || todayKey(), t.repeat),
      completedAt: null,
      estimate: t.estimate || null,
      repeat: t.repeat,
      sortOrder: now(),
      createdAt: now(),
    })
  }
}
export const setTaskFocus = (id, focus) => db.tasks.update(id, { isFocus: focus })
export const carryTaskToToday = (id) => db.tasks.update(id, { dueDate: todayKey() })
export const snoozeTaskToTomorrow = (id) => db.tasks.update(id, { dueDate: tomorrowKey(), isFocus: false })

/* =========================================================
   VANER
   ========================================================= */
export async function listHabits() {
  return db.habits.orderBy('sortOrder').toArray()
}
export async function addHabit(name) {
  const habit = {
    id: uid(),
    name: name.trim(),
    history: [],
    color: 'forest',
    emoji: '🌿',
    archived: false,
    weeklyGoal: null,
    sortOrder: now(),
    createdAt: now(),
  }
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
export async function addSubscription({ name, amount, cycle = 'monthly', renewDay = null }) {
  const sub = { id: uid(), name: name.trim(), amount: Number(amount) || 0, cycle, renewDay, createdAt: now() }
  await db.subscriptions.add(sub)
  return sub
}
export const updateSubscription = (id, patch) => db.subscriptions.update(id, patch)
export const deleteSubscription = (id) => db.subscriptions.delete(id)
export const monthlyCost = (s) => (s.cycle === 'yearly' ? (s.amount || 0) / 12 : s.amount || 0)

/* =========================================================
   PENGER — forbruk (expenses) + budsjett (budgets)
   - expenses: id, amount, category, note, date('YYYY-MM-DD'), createdAt
   - budgets:  id, category, amount, createdAt  (én rad per kategori; månedsbeløp)
   ========================================================= */
export async function listExpenses() {
  return db.expenses.orderBy('date').reverse().toArray()
}
export async function addExpense({ amount, category = 'annet', note = '', date }) {
  const e = {
    id: uid(),
    amount: Number(amount) || 0,
    category,
    note: note || '',
    date: date || todayKey(),
    createdAt: now(),
  }
  await db.expenses.add(e)
  return e
}
export const updateExpense = (id, patch) => db.expenses.update(id, patch)
export const deleteExpense = (id) => db.expenses.delete(id)

export async function listBudgets() {
  return db.budgets.toArray()
}
/** Setter (eller fjerner ved 0) månedsbudsjett for en kategori. */
export async function setBudget(category, amount) {
  const amt = Number(amount) || 0
  const existing = await db.budgets.where('category').equals(category).first()
  if (amt <= 0) {
    if (existing) await db.budgets.delete(existing.id)
    return
  }
  if (existing) await db.budgets.update(existing.id, { amount: amt })
  else await db.budgets.add({ id: uid(), category, amount: amt, createdAt: now() })
}

/* ---- inntekt (månedlig) ---- */
export async function listIncomes() {
  return db.incomes.orderBy('createdAt').toArray()
}
export async function addIncome({ name, amount }) {
  const i = { id: uid(), name: name.trim(), amount: Number(amount) || 0, createdAt: now() }
  await db.incomes.add(i)
  return i
}
export const updateIncome = (id, patch) => db.incomes.update(id, patch)
export const deleteIncome = (id) => db.incomes.delete(id)

/* ---- sparemål ---- */
export async function listGoals() {
  return db.goals.orderBy('createdAt').toArray()
}
export async function addGoal({ name, target }) {
  const g = { id: uid(), name: name.trim(), target: Number(target) || 0, saved: 0, createdAt: now() }
  await db.goals.add(g)
  return g
}
export const updateGoal = (id, patch) => db.goals.update(id, patch)
export const deleteGoal = (id) => db.goals.delete(id)
export async function addToGoal(id, delta) {
  const g = await db.goals.get(id)
  if (!g) return
  await db.goals.update(id, { saved: Math.max(0, (g.saved || 0) + delta) })
}

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

export async function addProject({ name, why = '', status = 'active', color = 'forest', emoji = '🗂️' }) {
  const maxOrder = await db.projects.orderBy('sortOrder').last()
  const p = {
    id: uid(),
    name: name.trim(),
    why: why.trim ? why.trim() : why,
    status,
    color,
    emoji,
    deadline: null,
    notes: '',
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
export async function updateProjectItem(item, patch) {
  await db.projectItems.update(item.id, patch)
  await touch(item.projectId)
}
export async function deleteProjectItem(item) {
  await db.projectItems.delete(item.id)
  await touch(item.projectId)
}
export async function addItemSubtask(item, text) {
  const subtasks = [...(item.subtasks || []), { id: uid(), text: text.trim(), done: false }]
  await db.projectItems.update(item.id, { subtasks })
  await touch(item.projectId)
}
export async function toggleItemSubtask(item, subId) {
  const subtasks = (item.subtasks || []).map((s) => (s.id === subId ? { ...s, done: !s.done } : s))
  await db.projectItems.update(item.id, { subtasks })
  await touch(item.projectId)
}
export async function deleteItemSubtask(item, subId) {
  await db.projectItems.update(item.id, { subtasks: (item.subtasks || []).filter((s) => s.id !== subId) })
  await touch(item.projectId)
}

/** Flytt et item til en vilkårlig fase (legges nederst i målfasen). */
export async function moveItemToStage(item, stage) {
  if (item.stage === stage) return
  const all = await listProjectItems(item.projectId)
  const inStage = all.filter((i) => i.stage === stage && i.id !== item.id)
  const maxOrder = inStage.length ? Math.max(...inStage.map((i) => i.sortOrder || 0)) : now()
  await db.projectItems.update(item.id, { stage, sortOrder: maxOrder + 1000 })
  await touch(item.projectId)
}

/** Omroker et item opp/ned innenfor sin egen fase. */
export async function reorderItem(item, direction) {
  const all = await listProjectItems(item.projectId)
  const inStage = all.filter((i) => i.stage === item.stage)
  const idx = inStage.findIndex((i) => i.id === item.id)
  const swap = idx + direction
  if (idx < 0 || swap < 0 || swap >= inStage.length) return
  const a = inStage[idx], b = inStage[swap]
  await db.projectItems.update(a.id, { sortOrder: b.sortOrder ?? 0 })
  await db.projectItems.update(b.id, { sortOrder: a.sortOrder ?? 0 })
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
   KALENDER (hendelser)
   - events: id, title, date('YYYY-MM-DD'), time('HH:MM'|''), note, color, createdAt
   ========================================================= */
export async function addEvent({ title, date, time = '', note = '', color = 'amber', repeat = 'none' }) {
  const ev = {
    id: uid(),
    title: title.trim(),
    date,
    time: time || '',
    note: note || '',
    color,
    repeat,
    createdAt: now(),
  }
  await db.events.add(ev)
  return ev
}
export const updateEvent = (id, patch) => db.events.update(id, patch)
export const deleteEvent = (id) => db.events.delete(id)

/* =========================================================
   LISTE (gjøremål uten dato)
   - todos: id, text, isDone, completedAt, sortOrder, createdAt
   ========================================================= */
export async function listTodos() {
  return db.todos.orderBy('sortOrder').toArray()
}
export async function addTodo(text) {
  const t = {
    id: uid(),
    text: text.trim(),
    isDone: false,
    completedAt: null,
    subtasks: [],
    sortOrder: now(),
    createdAt: now(),
  }
  await db.todos.add(t)
  return t
}
export const updateTodo = (id, patch) => db.todos.update(id, patch)
export const deleteTodo = (id) => db.todos.delete(id)
export async function addSubtask(todoId, text) {
  const t = await db.todos.get(todoId)
  if (!t) return
  const subtasks = [...(t.subtasks || []), { id: uid(), text: text.trim(), done: false }]
  await db.todos.update(todoId, { subtasks })
}
export async function toggleSubtask(todoId, subId) {
  const t = await db.todos.get(todoId)
  if (!t) return
  const subtasks = (t.subtasks || []).map((s) => (s.id === subId ? { ...s, done: !s.done } : s))
  await db.todos.update(todoId, { subtasks })
}
export async function deleteSubtask(todoId, subId) {
  const t = await db.todos.get(todoId)
  if (!t) return
  await db.todos.update(todoId, { subtasks: (t.subtasks || []).filter((s) => s.id !== subId) })
}
export async function setTodoDone(id, done) {
  await db.todos.update(id, { isDone: done, completedAt: done ? now() : null })
}
export async function moveTodo(id, direction) {
  const all = await db.todos.orderBy('sortOrder').toArray()
  const open = all.filter((t) => !t.isDone)
  const idx = open.findIndex((t) => t.id === id)
  const swap = idx + direction
  if (idx < 0 || swap < 0 || swap >= open.length) return
  const a = open[idx], b = open[swap]
  await db.todos.update(a.id, { sortOrder: b.sortOrder })
  await db.todos.update(b.id, { sortOrder: a.sortOrder })
}

/* =========================================================
   BACKUP — eksport/import av HELE dashboardet
   ========================================================= */
const TABLES = ['ideas', 'tasks', 'habits', 'subscriptions', 'projects', 'projectItems', 'events', 'todos', 'expenses', 'budgets', 'incomes', 'goals']

export async function exportAll() {
  const out = { type: 'dashboard-backup', version: 8, exportedAt: new Date().toISOString() }
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

/* =========================================================
   SKY-SYNC — tving eksisterende lokal data opp til Dexie Cloud
   ---------------------------------------------------------
   Data som ble laget FØR sync ble skrudd på, er ikke registrert
   for opplasting. Ved å skrive hver rad på nytt (bulkPut) mens man
   er innlogget, registreres de som endringer og lastes opp til
   brukerens egen sky-konto. Kjør dette ÉN gang på enheten som har
   dataen (mens du er innlogget).
   ========================================================= */
export async function pushAllToCloud() {
  const counts = {}
  let total = 0
  for (const t of TABLES) {
    const rows = await db.table(t).toArray()
    counts[t] = rows.length
    total += rows.length
    if (rows.length) await db.table(t).bulkPut(rows)
  }
  try {
    await db.cloud.sync({ purpose: 'push' })
  } catch {
    // Sync skjer uansett i bakgrunnen så snart det er nett.
  }
  return { counts, total }
}
