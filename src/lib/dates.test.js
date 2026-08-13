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

describe('nextDate: månedlig på slutten av måneden', () => {
  /* `new Date(2026, 1, 31)` ruller videre til 3. mars — februar forsvant, og
     datoen forskjøv seg. Dagen må klemmes til siste dag i målmåneden. */
  it('klemmer 31. januar til siste dag i februar i stedet for å hoppe over den', () => {
    expect(nextDate('2026-01-31', 'monthly')).toBe('2026-02-28')
  })

  it('treffer 29. februar i skuddår', () => {
    expect(nextDate('2028-01-31', 'monthly')).toBe('2028-02-29')
  })

  it('klemmer 31. mars til 30. april', () => {
    expect(nextDate('2026-03-31', 'monthly')).toBe('2026-04-30')
  })

  it('lar dager som finnes i begge måneder stå i fred', () => {
    expect(nextDate('2026-01-15', 'monthly')).toBe('2026-02-15')
    expect(nextDate('2026-01-28', 'monthly')).toBe('2026-02-28')
  })
})
