import { describe, it, expect } from 'vitest'
import { legacyTodoToTask, legacyMoneyCategory } from './migrations.js'

describe('legacyTodoToTask', () => {
  it('maps text to title and trims it', () => {
    const out = legacyTodoToTask({ text: '  handle melk  ', isDone: false })
    expect(out.title).toBe('handle melk')
  })
  it('defaults isFocus to false regardless of input', () => {
    expect(legacyTodoToTask({ text: 'x', isFocus: true }).isFocus).toBe(false)
  })
  it('coerces isDone to a boolean', () => {
    expect(legacyTodoToTask({ text: 'x', isDone: 1 }).isDone).toBe(true)
    expect(legacyTodoToTask({ text: 'x' }).isDone).toBe(false)
  })
  it('preserves a null dueDate as null (udatert)', () => {
    expect(legacyTodoToTask({ text: 'x', dueDate: null }).dueDate).toBe(null)
    expect(legacyTodoToTask({ text: 'x' }).dueDate).toBe(null)
  })
  it('keeps a set dueDate', () => {
    expect(legacyTodoToTask({ text: 'x', dueDate: '2026-07-02' }).dueDate).toBe('2026-07-02')
  })
  it('carries completedAt through unchanged', () => {
    expect(legacyTodoToTask({ text: 'x', completedAt: 12345 }).completedAt).toBe(12345)
    expect(legacyTodoToTask({ text: 'x' }).completedAt).toBe(null)
  })
  it('always sets estimate null and repeat none (todos never had these)', () => {
    const out = legacyTodoToTask({ text: 'x' })
    expect(out.estimate).toBe(null)
    expect(out.repeat).toBe('none')
  })
  it('preserves an existing subtasks array', () => {
    const subs = [{ id: '1', text: 'a', done: false }]
    expect(legacyTodoToTask({ text: 'x', subtasks: subs }).subtasks).toEqual(subs)
  })
  it('defaults subtasks to an empty array when missing or malformed', () => {
    expect(legacyTodoToTask({ text: 'x' }).subtasks).toEqual([])
    expect(legacyTodoToTask({ text: 'x', subtasks: 'not-an-array' }).subtasks).toEqual([])
  })
  it('does not include id/sortOrder/createdAt — caller supplies those', () => {
    const out = legacyTodoToTask({ id: 'abc', text: 'x', sortOrder: 1, createdAt: 2 })
    expect(out.id).toBeUndefined()
    expect(out.sortOrder).toBeUndefined()
    expect(out.createdAt).toBeUndefined()
  })
})

describe('legacyMoneyCategory', () => {
  it('maps known legacy category keys to their new bank-matched category', () => {
    expect(legacyMoneyCategory('mat')).toBe('dagligvarer')
    expect(legacyMoneyCategory('transport')).toBe('kjoretoy')
    expect(legacyMoneyCategory('bolig')).toBe('hjem')
    expect(legacyMoneyCategory('moro')).toBe('fritid')
    expect(legacyMoneyCategory('strømming')).toBe('fritid')
    expect(legacyMoneyCategory('musikk')).toBe('fritid')
  })
  it('maps miscellaneous legacy keys to the catch-all øvrig bucket', () => {
    expect(legacyMoneyCategory('klar')).toBe('ovrig')
    expect(legacyMoneyCategory('software')).toBe('ovrig')
    expect(legacyMoneyCategory('annet')).toBe('ovrig')
  })
  it('leaves helse unchanged (same meaning in the new taxonomy)', () => {
    expect(legacyMoneyCategory('helse')).toBe('helse')
  })
  it('passes already-migrated or unknown keys through unchanged', () => {
    expect(legacyMoneyCategory('dagligvarer')).toBe('dagligvarer')
    expect(legacyMoneyCategory('some-future-key')).toBe('some-future-key')
  })
})
