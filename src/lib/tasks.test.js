import { describe, it, expect } from 'vitest'
import { nextTaskOccurrence, shouldSpawnRepeat } from './tasks.js'

describe('nextTaskOccurrence', () => {
  const base = { id: 'a', title: 'Vann planter', repeat: 'daily', dueDate: '2026-01-01', estimate: 5, isDone: true, isFocus: true, completedAt: 123, subtasks: [{ id: 's', text: 'x', done: true }] }

  it('advances the due date by one interval', () => {
    expect(nextTaskOccurrence(base).dueDate).toBe('2026-01-02')
    expect(nextTaskOccurrence({ ...base, repeat: 'weekly' }).dueDate).toBe('2026-01-08')
  })
  it('resets status fields and subtasks', () => {
    const n = nextTaskOccurrence(base)
    expect(n.isDone).toBe(false)
    expect(n.isFocus).toBe(false)
    expect(n.completedAt).toBe(null)
    expect(n.subtasks).toEqual([])
  })
  it('carries title, repeat and estimate', () => {
    const n = nextTaskOccurrence(base)
    expect(n.title).toBe('Vann planter')
    expect(n.repeat).toBe('daily')
    expect(n.estimate).toBe(5)
  })
  it('does not carry the id (caller assigns a new one)', () => {
    expect(nextTaskOccurrence(base).id).toBeUndefined()
  })
})

describe('shouldSpawnRepeat', () => {
  const task = { id: 'a', title: 'Vann planter', repeat: 'daily', dueDate: '2026-01-01', isDone: true }

  it('is false for non-repeating or undated tasks', () => {
    expect(shouldSpawnRepeat({ ...task, repeat: 'none' }, [])).toBe(false)
    expect(shouldSpawnRepeat({ ...task, repeat: undefined }, [])).toBe(false)
    expect(shouldSpawnRepeat({ ...task, dueDate: null }, [])).toBe(false)
    expect(shouldSpawnRepeat(null, [])).toBe(false)
  })

  it('is true when no next occurrence exists yet', () => {
    expect(shouldSpawnRepeat(task, [])).toBe(true)
  })

  it('is false when an open occurrence already exists on the target date (the duplicate guard)', () => {
    const existing = { id: 'b', title: 'Vann planter', repeat: 'daily', dueDate: '2026-01-02', isDone: false }
    expect(shouldSpawnRepeat(task, [existing])).toBe(false)
  })

  it('ignores a DONE occurrence on the target date (still spawns a fresh one)', () => {
    const doneOne = { id: 'b', title: 'Vann planter', repeat: 'daily', dueDate: '2026-01-02', isDone: true }
    expect(shouldSpawnRepeat(task, [doneOne])).toBe(true)
  })

  it('does not match a different task on the same date', () => {
    const other = { id: 'b', title: 'Noe annet', repeat: 'daily', dueDate: '2026-01-02', isDone: false }
    expect(shouldSpawnRepeat(task, [other])).toBe(true)
  })

  it('never matches the task against itself', () => {
    // the completed task itself is not its own future occurrence
    expect(shouldSpawnRepeat(task, [task])).toBe(true)
  })
})
