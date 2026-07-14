import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach } from 'vitest'
import { db, addTask, setTaskDone, addIdea, addProject, addHabit, addProjectItem, exportAll, importAll } from './db.js'
import { legacyMoneyCategory } from './lib/migrations.js'

// Domenetabellene vi rører i disse testene — nullstilles mellom hver test.
const CLEAR = ['tasks', 'ideas', 'expenses', 'budgets', 'subscriptions', 'projects', 'projectItems']

beforeEach(async () => {
  await db.open()
  await Promise.all(CLEAR.map((t) => db.table(t).clear()))
})

describe('setTaskDone — gjentakende oppgaver', () => {
  it('spawns exactly one next occurrence on the following day', async () => {
    const t = await addTask('Daglig', { dueDate: '2026-01-01', repeat: 'daily' })
    await setTaskDone(t.id, true)
    const next = await db.tasks.where('dueDate').equals('2026-01-02').toArray()
    expect(next).toHaveLength(1)
    expect(next[0].isDone).toBe(false)
    expect(next[0].repeat).toBe('daily')
    expect(next[0].id).not.toBe(t.id)
  })

  it('does NOT duplicate the next occurrence when toggled done/undone/done (the bug fix)', async () => {
    const t = await addTask('Daglig', { dueDate: '2026-01-01', repeat: 'daily' })
    await setTaskDone(t.id, true)   // spawns 2026-01-02
    await setTaskDone(t.id, false)  // un-complete original
    await setTaskDone(t.id, true)   // complete again — must NOT spawn a second
    const next = await db.tasks.where('dueDate').equals('2026-01-02').toArray()
    expect(next).toHaveLength(1)
  })

  it('does not spawn anything for a non-repeating task', async () => {
    const t = await addTask('Engangs', { dueDate: '2026-01-01', repeat: 'none' })
    await setTaskDone(t.id, true)
    expect(await db.tasks.count()).toBe(1)
  })

  it('does not spawn for a repeating task with no due date', async () => {
    const t = await addTask('Udatert', { dueDate: null, repeat: 'weekly' })
    await setTaskDone(t.id, true)
    expect(await db.tasks.count()).toBe(1)
  })
})

describe('data-lags-validering — tom/whitespace input oppretter ingenting', () => {
  it('addTask rejects empty and whitespace titles', async () => {
    expect(await addTask('')).toBe(null)
    expect(await addTask('   ')).toBe(null)
    expect(await db.tasks.count()).toBe(0)
    const ok = await addTask('Ekte oppgave')
    expect(ok).not.toBe(null)
    expect(await db.tasks.count()).toBe(1)
  })

  it('addIdea / addHabit reject blanks', async () => {
    expect(await addIdea('   ')).toBe(null)
    expect(await addHabit('')).toBe(null)
    expect(await db.ideas.count()).toBe(0)
  })

  it('addProject rejects a blank name', async () => {
    expect(await addProject({ name: '  ' })).toBe(null)
    expect(await db.projects.count()).toBe(0)
  })

  it('addProjectItem rejects blank text', async () => {
    const p = await addProject({ name: 'Prosjekt' })
    expect(await addProjectItem(p.id, '   ')).toBe(null)
    expect(await db.projectItems.count()).toBe(0)
  })
})

describe('exportAll / importAll', () => {
  it('round-trips data and is idempotent on a second import', async () => {
    await addTask('Oppgave A', { dueDate: '2026-01-01' })
    await addTask('Oppgave B', { dueDate: null })
    await db.ideas.add({ id: 'idea1', text: 'En idé', category: 'ny', createdAt: Date.now() })

    const backup = await exportAll()
    await Promise.all(CLEAR.map((t) => db.table(t).clear()))

    const first = await importAll(backup)
    expect(first.tasks).toBe(2)
    expect(first.ideas).toBe(1)
    expect(await db.tasks.count()).toBe(2)

    const second = await importAll(backup)
    expect(second.tasks).toBe(0)
    expect(second.ideas).toBe(0)
    expect(await db.tasks.count()).toBe(2) // no duplicates
  })

  it('remaps legacy money categories on import', async () => {
    const data = {
      type: 'dashboard-backup',
      expenses: [{ id: 'e1', amount: 100, category: 'mat', date: '2026-01-01', createdAt: Date.now() }],
    }
    await importAll(data)
    const e = await db.expenses.get('e1')
    expect(e.category).toBe(legacyMoneyCategory('mat'))
  })

  it('rejects a non-object backup', async () => {
    await expect(importAll(null)).rejects.toThrow()
  })
})
