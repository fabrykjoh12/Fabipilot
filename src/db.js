import Dexie from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import { todayKey, tomorrowKey, nextDate } from './lib/dates.js'
import { legacyTodoToTask, legacyMoneyCategory } from './lib/migrations.js'
import { nextTaskOccurrence, shouldSpawnRepeat } from './lib/tasks.js'

export { todayKey, tomorrowKey, nextDate }

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

// v9: deling — sharedItems (delt liste i et eget Dexie Cloud-realm).
db.version(9).stores({
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
  sharedItems: 'id, realmId, isDone, sortOrder, createdAt',
})

// v10: slå sammen «Liste» (todos) inn i «Oppgaver» (tasks).
// Flytt hver todo til tasks med SAMME id (idempotent via bulkPut) så sync
// ikke lager duplikater, behold delpunkter, dato (kan være null) og fullført.
db.version(10)
  .stores({
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
    sharedItems: 'id, realmId, isDone, sortOrder, createdAt',
  })
  .upgrade(async (tx) => {
    const todos = await tx.table('todos').toArray()
    if (!todos.length) return
    const rows = todos.map((t) => ({
      id: t.id,
      ...legacyTodoToTask(t),
      sortOrder: t.sortOrder || Date.now(),
      createdAt: t.createdAt || Date.now(),
    }))
    await tx.table('tasks').bulkPut(rows)
    await tx.table('todos').clear()
  })

// v11: Penger-kategoriene erstattet med brukerens faktiske bank-kategorier
// (Dagligvarer/Restaurant og uteliv/Kjøretøy/Fritid/Helse og velvære/Hjem og hage/Øvrig
// forbruk). Remapper gamle kategori-nøkler på expenses/budgets/subscriptions (se
// legacyMoneyCategory) — ingen schema-endring, bare datavask.
db.version(11)
  .stores({
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
    sharedItems: 'id, realmId, isDone, sortOrder, createdAt',
  })
  .upgrade(async (tx) => {
    for (const name of ['expenses', 'budgets', 'subscriptions']) {
      await tx
        .table(name)
        .toCollection()
        .modify((row) => {
          if (row.category) row.category = legacyMoneyCategory(row.category)
        })
    }
  })

db.cloud.configure({
  databaseUrl: 'https://zl78q9yu3.dexie.cloud',
  requireAuth: false,
  customLoginGui: true,
})

const uid = () => crypto.randomUUID()
const now = () => Date.now()


/* =========================================================
   SLETT MED ANGRE — generelle hjelpere for «Angre»-toast
   ---------------------------------------------------------
   `deleteWithRestore` returnerer raden som ble slettet, så kalleren
   kan tilby «Angre» som legger den tilbake uendret (samme id).
   ========================================================= */
export async function deleteWithRestore(tableName, id) {
  const rec = await db.table(tableName).get(id)
  if (rec) await db.table(tableName).delete(id)
  return rec
}
export const restoreRecord = (tableName, rec) => (rec ? db.table(tableName).add(rec) : undefined)

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
/**
 * Lag en oppgave. `opts.dueDate`:
 *  - utelatt → i dag (standard),
 *  - `null` → udatert («Når som helst»),
 *  - 'YYYY-MM-DD' → den datoen.
 */
export async function addTask(title, opts = {}) {
  const task = {
    id: uid(),
    title: title.trim(),
    isDone: false,
    isFocus: false,
    dueDate: opts.dueDate !== undefined ? opts.dueDate : todayKey(),
    completedAt: null,
    estimate: opts.estimate ?? null,
    repeat: opts.repeat ?? 'none',
    subtasks: [],
    sortOrder: now(),
    createdAt: now(),
  }
  await db.tasks.add(task)
  return task
}
export const updateTask = (id, patch) => db.tasks.update(id, patch)
export const deleteTask = (id) => db.tasks.delete(id)
export const setTaskDate = (id, dueDate) => db.tasks.update(id, { dueDate: dueDate || null })
export async function setTaskDone(id, done) {
  const t = await db.tasks.get(id)
  // Behold dueDate (seksjonen styres av isDone, ikke datoen) så datoen ikke nullstilles.
  await db.tasks.update(id, {
    isDone: done,
    isFocus: done ? false : t?.isFocus,
    completedAt: done ? now() : null,
  })
  // Gjentakende oppgave: lag neste forekomst når den hukes av (krever dato).
  // Hopp over hvis en åpen forekomst allerede finnes på måldatoen, ellers får
  // man duplikater når man huker av/på flere ganger (shouldSpawnRepeat).
  if (done && t && t.repeat && t.repeat !== 'none' && t.dueDate) {
    const target = nextDate(t.dueDate, t.repeat)
    const siblings = await db.tasks.where('dueDate').equals(target).toArray()
    if (shouldSpawnRepeat(t, siblings)) {
      await db.tasks.add({
        id: uid(),
        ...nextTaskOccurrence(t),
        sortOrder: now(),
        createdAt: now(),
      })
    }
  }
}
export const setTaskFocus = (id, focus) => db.tasks.update(id, { isFocus: focus })
export const carryTaskToToday = (id) => db.tasks.update(id, { dueDate: todayKey() })
export const snoozeTaskToTomorrow = (id) => db.tasks.update(id, { dueDate: tomorrowKey(), isFocus: false })

/* delpunkter på oppgaver */
export async function addTaskSubtask(taskId, text) {
  const t = await db.tasks.get(taskId)
  if (!t) return
  const subtasks = [...(t.subtasks || []), { id: uid(), text: text.trim(), done: false }]
  await db.tasks.update(taskId, { subtasks })
}
export async function toggleTaskSubtask(taskId, subId) {
  const t = await db.tasks.get(taskId)
  if (!t) return
  const subtasks = (t.subtasks || []).map((s) => (s.id === subId ? { ...s, done: !s.done } : s))
  await db.tasks.update(taskId, { subtasks })
}
export async function deleteTaskSubtask(taskId, subId) {
  const t = await db.tasks.get(taskId)
  if (!t) return
  await db.tasks.update(taskId, { subtasks: (t.subtasks || []).filter((s) => s.id !== subId) })
}

/** Bytt rekkefølge mellom to oppgaver (manuell sortering i «Når som helst»). */
export async function swapTaskOrder(aId, bId) {
  const [a, b] = await Promise.all([db.tasks.get(aId), db.tasks.get(bId)])
  if (!a || !b) return
  await db.tasks.update(a.id, { sortOrder: b.sortOrder })
  await db.tasks.update(b.id, { sortOrder: a.sortOrder })
}

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
   - expenses: id, amount, category, note, date('YYYY-MM-DD'), bulk, createdAt
     `bulk` (uindeksert, valgfri): true for rader satt via «Fyll inn måned»
     (setMonthlyTotal) i stedet for enkeltregistrert kjøp — telles likt med
     vanlige rader i alle summeringer, bare skilt ut for gjenfinning/redigering.
   - budgets:  id, category, amount, createdAt  (én rad per kategori; månedsbeløp)
   ========================================================= */
export async function listExpenses() {
  return db.expenses.orderBy('date').reverse().toArray()
}
export async function addExpense({ amount, category = 'ovrig', note = '', date }) {
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

/** Nåværende månedstotaler (kun «Fyll inn måned»-rader) for `ym` ('YYYY-MM'), per
    kategori — brukes til å forhåndsutfylle skjemaet. */
export async function getMonthlyTotals(ym) {
  const rows = await db.expenses.toArray()
  const map = {}
  for (const r of rows) if (r.bulk && (r.date || '').startsWith(ym)) map[r.category] = r.amount
  return map
}
/** Setter (eller fjerner ved 0) totalt forbruk for én kategori i én måned — raskere
    alternativ til å logge hvert enkelt kjøp. Ment som ENTEN/ELLER med vanlig
    enkeltregistrering for samme kategori/måned (begge telles med, så bruk av begge
    samtidig dobbelttéller). */
export async function setMonthlyTotal(ym, category, amount) {
  const amt = Number(amount) || 0
  const rows = await db.expenses.toArray()
  const existing = rows.find((e) => e.bulk && e.category === category && (e.date || '').startsWith(ym))
  if (amt <= 0) {
    if (existing) await db.expenses.delete(existing.id)
    return
  }
  if (existing) await db.expenses.update(existing.id, { amount: amt })
  else await db.expenses.add({ id: uid(), amount: amt, category, note: '', date: `${ym}-01`, bulk: true, createdAt: now() })
}

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

export async function setProjectStatus(id, status) {
  await db.projects.update(id, { status, lastTouched: now() })
  return true
}

/* ---- items ---- */
export async function listProjectItems(projectId) {
  return db.projectItems.where('projectId').equals(projectId).sortBy('sortOrder')
}
const touch = (projectId) => db.projects.update(projectId, { lastTouched: now() })

export async function addProjectItem(projectId, text, stage = 'next') {
  const project = await db.projects.get(projectId)
  const item = {
    id: uid(),
    projectId,
    text: text.trim(),
    stage,
    energy: null,
    sortOrder: now(),
    createdAt: now(),
    // arv prosjektets realm så nye steg i et delt prosjekt også synces
    ...(project?.realmId ? { realmId: project.realmId } : {}),
  }
  await db.projectItems.add(item)
  await touch(projectId)
  return item
}
export async function setItemStage(item, stage) {
  // doneAt stemples når steget fullføres (brukes av «Denne uka»-oppsummeringen)
  await db.projectItems.update(item.id, { stage, doneAt: stage === 'done' ? now() : null })
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
  await db.projectItems.update(item.id, { stage, sortOrder: maxOrder + 1000, doneAt: stage === 'done' ? now() : null })
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

/** Forfremm en idé til et nytt aktivt prosjekt. */
export async function promoteIdeaToProject(idea) {
  const project = await addProject({ name: idea.text, why: '', status: 'active' })
  await db.ideas.delete(idea.id)
  return { project }
}

/* =========================================================
   KALENDER (hendelser)
   - events: id, title, date('YYYY-MM-DD'), time('HH:MM'|''), note, color, repeat, realmId, createdAt
   `realmId` er uindeksert; fraværende/`currentUserId` = privat, det delte realmet (samme som
   «Delt»/«Handleliste», se `ensureSharedRealm`) = delt med kjæresten. Delte hendelser dukker
   automatisk opp i kalenderen på begge enheter — ingen egen spørring nødvendig.
   ========================================================= */
export async function addEvent({ title, date, time = '', note = '', color = 'amber', repeat = 'none', shared = false }) {
  const ev = {
    id: uid(),
    title: title.trim(),
    date,
    time: time || '',
    note: note || '',
    color,
    repeat,
    createdAt: now(),
    ...(shared ? { realmId: await ensureSharedRealm() } : {}),
  }
  await db.events.add(ev)
  return ev
}
export const updateEvent = (id, patch) => db.events.update(id, patch)
export const deleteEvent = (id) => db.events.delete(id)
/** Del/avslutt deling av en hendelse — bruker samme delte realm som «Delt»/«Handleliste». */
export async function setEventShared(id, shared) {
  const realmId = shared ? await ensureSharedRealm() : db.cloud.currentUserId
  await db.events.update(id, { realmId })
}

/* =========================================================
   STARTPAKKE — eksempeldata for helt ferske brukere.
   Vanlige rader (slettbare); viser flyten uten å forplikte.
   ========================================================= */
export async function seedStarterPack() {
  await addTask('Prøv å hake av meg ✓')
  await addTask('Trykk på tittelen min for å se detaljer')
  await addTask('Uten dato havner ting i «Når som helst»', { dueDate: null })
  await addHabit('Drikke vann')
  await addHabit('5 min rydding')
  const p = await addProject({ name: 'Min første nettside', why: 'Lære Fabipilot-flyten', status: 'active' })
  await updateProject(p.id, { emoji: '🚀', color: 'blue', context: 'React + Vite, deployes på Vercel.' })
  await addProjectItem(p.id, 'Build a landing page with a hero section', 'now')
  await addProjectItem(p.id, 'Add a contact form with validation', 'next')
  await addProjectItem(p.id, 'Improve the design of the navbar', 'later')
}

/* =========================================================
   DELING — delte lister med én annen person (Dexie Cloud realm)
   ---------------------------------------------------------
   Alt i `sharedItems` legges i ÉT delt realm, uansett hvilken liste
   (`list`) et item hører til — «Delt» og «Handleliste» er begge bare
   filtrerte visninger av samme store/realm, så de deles automatisk med
   de(n) samme personen(e). Den andre personen inviteres på e-post og
   får full tilgang. Krever at begge er innlogget (samme Dexie Cloud-
   database). Personlige stores røres ikke — kun disse listene deles.
   ========================================================= */
const SHARED_REALM_NAME = 'Delt liste'

/** Finn (eller lag) det delte realmet og returner realmId.
    `realms`-tabellen fra dexie-cloud-addon indekserer kun `@realmId` — `name`
    er ikke en indeksert keyPath, så vi må filtrere i minnet i stedet for
    `.where({ name })` (som kaster «KeyPath name … is not indexed»). */
export async function ensureSharedRealm() {
  const all = await db.realms.toArray()
  const mine = all.filter((r) => r.name === SHARED_REALM_NAME)
  // Bruk det realmet jeg eier hvis det finnes.
  const owned = mine.find((r) => r.owner === db.cloud.currentUserId) || mine[0]
  if (owned) return owned.realmId
  const realmId = await db.realms.add({ name: SHARED_REALM_NAME })
  return realmId
}

/** Alle delte realms jeg er med i (eier eller invitert). */
export async function listSharedRealms() {
  return db.realms.toArray()
}

export async function listSharedItems(list = 'general') {
  return db.sharedItems.orderBy('sortOrder').filter((i) => (i.list || 'general') === list).toArray()
}

export async function addSharedItem(text, list = 'general') {
  const t = text.trim()
  if (!t) return
  const realmId = await ensureSharedRealm()
  const item = {
    id: uid(),
    realmId,
    owner: db.cloud.currentUserId,
    text: t,
    list,
    isDone: false,
    completedAt: null,
    sortOrder: now(),
    createdAt: now(),
  }
  await db.sharedItems.add(item)
  return item
}

export const updateSharedItem = (id, patch) => db.sharedItems.update(id, patch)
export const deleteSharedItem = (id) => db.sharedItems.delete(id)
export async function setSharedItemDone(id, done) {
  await db.sharedItems.update(id, { isDone: done, completedAt: done ? now() : null })
}

/** Inviter en person på e-post til den delte lista (full tilgang). */
export async function inviteToShared(email) {
  const e = (email || '').trim().toLowerCase()
  if (!e) throw new Error('Mangler e-post.')
  const realmId = await ensureSharedRealm()
  await db.members.add({
    realmId,
    email: e,
    invite: true,
    permissions: { manage: '*' },
  })
}

/** Medlemmer i det delte realmet (inkl. ventende invitasjoner). */
export async function listSharedMembers() {
  const realmId = await ensureSharedRealm()
  return db.members.where('realmId').equals(realmId).toArray()
}

export const removeSharedMember = (memberId) => db.members.delete(memberId)

/* ---------------------------------------------------------
   DELING AV PROSJEKTER — del et helt prosjekt (med steg) via e-post.
   Hvert delt prosjekt får sitt eget Dexie Cloud-realm; prosjektet og alle
   `projectItems` flyttes dit (realmId), og den inviterte får full tilgang.
   --------------------------------------------------------- */
/** Er dette realmet privat (mitt eget) eller udefinert? */
export const isPrivateRealm = (realmId) => !realmId || realmId === db.cloud.currentUserId

/** Del et prosjekt: flytt prosjekt + steg inn i et eget realm og inviter på e-post. */
export async function shareProject(projectId, email) {
  const e = (email || '').trim().toLowerCase()
  if (!e) throw new Error('Mangler e-post.')
  const project = await db.projects.get(projectId)
  if (!project) throw new Error('Fant ikke prosjektet.')
  let realmId = project.realmId
  if (isPrivateRealm(realmId)) {
    realmId = await db.realms.add({ name: `Prosjekt: ${project.name}` })
    await db.projects.update(projectId, { realmId })
    const items = await db.projectItems.where('projectId').equals(projectId).toArray()
    for (const it of items) await db.projectItems.update(it.id, { realmId })
  }
  await db.members.add({ realmId, email: e, invite: true, permissions: { manage: '*' } })
  return realmId
}

/** Medlemmer i prosjektets realm (tom liste hvis ikke delt / ikke innlogget). */
export async function listProjectMembers(projectId) {
  const project = await db.projects.get(projectId)
  if (!project || isPrivateRealm(project.realmId)) return []
  return db.members.where('realmId').equals(project.realmId).toArray()
}

export const removeProjectMember = (memberId) => db.members.delete(memberId)

/** Slutt å dele: flytt prosjekt + steg tilbake til privat realm og fjern de andre. */
export async function stopSharingProject(projectId) {
  const project = await db.projects.get(projectId)
  if (!project || isPrivateRealm(project.realmId)) return
  const oldRealm = project.realmId
  const priv = db.cloud.currentUserId
  await db.projects.update(projectId, { realmId: priv })
  const items = await db.projectItems.where('projectId').equals(projectId).toArray()
  for (const it of items) await db.projectItems.update(it.id, { realmId: priv })
  const members = await db.members.where('realmId').equals(oldRealm).toArray()
  for (const m of members) if (m.userId !== priv) await db.members.delete(m.id)
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
      .map((row) => (
        ['expenses', 'budgets', 'subscriptions'].includes(t) && row.category
          ? { ...row, category: legacyMoneyCategory(row.category) }
          : row
      ))
      .filter((row) => !existing.has(row.id))
    if (toAdd.length) await db.table(t).bulkAdd(toAdd)
    added[t] = toAdd.length
  }

  // Eldre backup: «Liste»-gjøremål (todos) flyttes inn i den samlede oppgavelista.
  const legacyTodos = Array.isArray(data.todos) ? data.todos : []
  if (legacyTodos.length) {
    const existingTasks = new Set(await db.tasks.toCollection().primaryKeys())
    const mapped = legacyTodos
      .filter((row) => row && typeof row === 'object')
      .map((t) => ({
        id: typeof t.id === 'string' && t.id ? t.id : uid(),
        ...legacyTodoToTask(t),
        sortOrder: t.sortOrder || now(),
        createdAt: t.createdAt || now(),
      }))
      .filter((row) => !existingTasks.has(row.id))
    if (mapped.length) await db.tasks.bulkAdd(mapped)
    added.tasks = (added.tasks || 0) + mapped.length
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
