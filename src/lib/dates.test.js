import { describe, it, expect } from 'vitest'
import { todayKey, tomorrowKey, nextDate } from './dates.js'

describe('todayKey', () => {
  it('formats a date as local YYYY-MM-DD', () => {
    expect(todayKey(new Date(2026, 6, 2))).toBe('2026-07-02') // juli = måned-index 6
  })
  it('pads single-digit month and day', () => {
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('defaults to now when no date is given', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('tomorrowKey', () => {
  it('is one day ahead of today', () => {
    const t = todayKey()
    const tm = tomorrowKey()
    expect(tm).not.toBe(t)
    expect(new Date(tm) > new Date(t)).toBe(true)
  })
})

describe('nextDate', () => {
  it('advances a daily repeat by one day', () => {
    expect(nextDate('2026-07-02', 'daily')).toBe('2026-07-03')
  })
  it('advances a weekly repeat by seven days', () => {
    expect(nextDate('2026-07-02', 'weekly')).toBe('2026-07-09')
  })
  it('advances a monthly repeat by one month', () => {
    expect(nextDate('2026-07-02', 'monthly')).toBe('2026-08-02')
  })
  it('rolls over into the next year for December', () => {
    expect(nextDate('2026-12-15', 'monthly')).toBe('2027-01-15')
  })
  it('handles daily month-end rollover', () => {
    expect(nextDate('2026-07-31', 'daily')).toBe('2026-08-01')
  })
  it('returns the same key for an unknown/none repeat', () => {
    expect(nextDate('2026-07-02', 'none')).toBe('2026-07-02')
    expect(nextDate('2026-07-02', undefined)).toBe('2026-07-02')
  })
})
