import { describe, it, expect } from 'vitest'
import { projectHealth, HEALTH_LABEL, HEALTH_STATUS_EN } from './projectHealth.js'

const DAY = 86400000
const NOW = 1_700_000_000_000

const item = (stage, sortOrder = 0) => ({ stage, sortOrder })

describe('projectHealth', () => {
  it('reports shipped for done projects regardless of steps', () => {
    const h = projectHealth({ status: 'done', lastTouched: NOW }, [item('now')], NOW)
    expect(h.state).toBe('shipped')
  })

  it('reports onice for parked projects', () => {
    const h = projectHealth({ status: 'onice', lastTouched: NOW }, [item('now')], NOW)
    expect(h.state).toBe('onice')
  })

  it('reports empty for an active project with no steps', () => {
    const h = projectHealth({ status: 'active', lastTouched: NOW }, [], NOW)
    expect(h.state).toBe('empty')
    expect(h.nextAction).toBe(null)
  })

  it('reports ready when every step is done', () => {
    const h = projectHealth({ status: 'active', lastTouched: NOW }, [item('done'), item('done')], NOW)
    expect(h.state).toBe('ready')
    expect(h.openCount).toBe(0)
    expect(h.doneCount).toBe(2)
  })

  it('reports stuck when active with open steps and untouched for 10+ days', () => {
    const h = projectHealth({ status: 'active', lastTouched: NOW - 12 * DAY }, [item('now')], NOW)
    expect(h.state).toBe('stuck')
    expect(h.moving).toBe(false)
  })

  it('reports building when recently touched with open steps', () => {
    const h = projectHealth({ status: 'active', lastTouched: NOW - 1 * DAY }, [item('next')], NOW)
    expect(h.state).toBe('building')
    expect(h.moving).toBe(true)
  })

  it('picks the highest-priority open step as the next action', () => {
    const items = [item('later', 1), item('now', 2), item('next', 3)]
    const h = projectHealth({ status: 'active', lastTouched: NOW }, items, NOW)
    expect(h.nextAction.stage).toBe('now')
  })

  it('breaks priority ties by sortOrder', () => {
    const items = [item('now', 50), item('now', 10)]
    const h = projectHealth({ status: 'active', lastTouched: NOW }, items, NOW)
    expect(h.nextAction.sortOrder).toBe(10)
  })

  it('never treats a done step as the next action', () => {
    const h = projectHealth({ status: 'active', lastTouched: NOW }, [item('done', 1), item('later', 2)], NOW)
    expect(h.nextAction.stage).toBe('later')
  })

  it('has a label for every state', () => {
    for (const state of ['building', 'stuck', 'ready', 'shipped', 'onice', 'empty']) {
      expect(HEALTH_LABEL[state]).toBeTruthy()
      expect(HEALTH_STATUS_EN[state]).toBeTruthy()
    }
  })
})
