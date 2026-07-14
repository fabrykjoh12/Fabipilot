import { describe, it, expect } from 'vitest'
import {
  daysInMonth, daysLeftInMonth, daysLeftInWeek, daysUntilRenew,
  upcomingCharges, remainingChargesThisMonth, yearlyReserve,
  safeToSpend, projectMonthEnd,
} from './money.js'

// Fast referansedato: onsdag 15. april 2026 (30 dager i måneden).
const D = (s) => new Date(s + 'T12:00:00')
const APR15 = D('2026-04-15')

describe('kalender-hjelpere', () => {
  it('daysInMonth', () => {
    expect(daysInMonth(APR15)).toBe(30)
    expect(daysInMonth(D('2026-02-10'))).toBe(28)
  })
  it('daysLeftInMonth inkluderer i dag', () => {
    expect(daysLeftInMonth(APR15)).toBe(16) // 30 - 15 + 1
    expect(daysLeftInMonth(D('2026-04-30'))).toBe(1)
  })
  it('daysLeftInWeek teller t.o.m. søndag', () => {
    expect(daysLeftInWeek(D('2026-04-13'))).toBe(7) // mandag
    expect(daysLeftInWeek(D('2026-04-15'))).toBe(5) // onsdag
    expect(daysLeftInWeek(D('2026-04-19'))).toBe(1) // søndag
  })
})

describe('daysUntilRenew', () => {
  it('0 når trekk-dagen er i dag', () => {
    expect(daysUntilRenew(15, APR15)).toBe(0)
  })
  it('teller framover innen måneden', () => {
    expect(daysUntilRenew(20, APR15)).toBe(5)
  })
  it('ruller til neste måned når dagen er passert', () => {
    expect(daysUntilRenew(10, APR15)).toBe(25) // 10. mai
  })
})

describe('upcomingCharges', () => {
  const subs = [
    { id: 'a', name: 'Netflix', amount: 149, renewDay: 20, cycle: 'monthly' },
    { id: 'b', name: 'Spotify', amount: 119, renewDay: 16, cycle: 'monthly' },
    { id: 'c', name: 'Domene', amount: 1200, renewDay: 18, cycle: 'yearly' },
    { id: 'd', name: 'Uten dag', amount: 99, renewDay: null, cycle: 'monthly' },
  ]
  it('tar kun månedlige med trekk-dag, sortert nærmest først', () => {
    const out = upcomingCharges(subs, APR15)
    expect(out.map((c) => c.name)).toEqual(['Spotify', 'Netflix'])
    expect(out[0].days).toBe(1)
  })
})

describe('remainingChargesThisMonth', () => {
  it('summerer månedlige trekk som gjenstår denne måneden', () => {
    const subs = [
      { name: 'A', amount: 100, renewDay: 20, cycle: 'monthly' }, // kommer (≥15)
      { name: 'B', amount: 50, renewDay: 10, cycle: 'monthly' }, // passert
      { name: 'C', amount: 1200, renewDay: 25, cycle: 'yearly' }, // årlig, ignoreres
    ]
    expect(remainingChargesThisMonth(subs, APR15)).toBe(100)
  })
})

describe('yearlyReserve', () => {
  it('deler årlige trekk på 12', () => {
    expect(yearlyReserve([{ amount: 1200, cycle: 'yearly' }, { amount: 100, cycle: 'monthly' }])).toBe(100)
  })
})

describe('safeToSpend', () => {
  it('er utilgjengelig uten inntekt og budsjett', () => {
    expect(safeToSpend({ income: 0, budgetTotal: 0 }, APR15).available).toBe(false)
  })

  it('sprer gjenstående over dagene igjen i måneden', () => {
    // inntekt 20000 − faste 2000 − brukt 2000 = 16000 igjen, 16 dager igjen → 1000/dag
    const s = safeToSpend({ income: 20000, subsMonthly: 2000, spentVariable: 2000 }, APR15)
    expect(s.available).toBe(true)
    expect(s.basis).toBe('income')
    expect(s.month).toBe(16000)
    expect(s.today).toBe(1000)
    expect(s.week).toBe(5000) // 1000 × 5 dager igjen av uka
  })

  it('faller tilbake på budsjett når inntekt mangler', () => {
    const s = safeToSpend({ income: 0, budgetTotal: 16000, subsMonthly: 0, spentVariable: 0 }, APR15)
    expect(s.basis).toBe('budget')
    expect(s.today).toBe(1000)
  })

  it('flagger overforbruk og nuller ut dagsbeløpet', () => {
    const s = safeToSpend({ income: 5000, subsMonthly: 2000, spentVariable: 4000 }, APR15)
    expect(s.over).toBe(true)
    expect(s.today).toBe(0)
    expect(s.week).toBe(0)
    expect(s.month).toBe(-1000)
  })
})

describe('projectMonthEnd', () => {
  it('ekstrapolerer forbruket til månedsslutt og legger til faste trekk', () => {
    // brukt 2000 på 15 dager → 4000 for hele måneden (30 dager) + 2000 faste = 6000
    expect(projectMonthEnd({ spentVariable: 2000, subsMonthly: 2000 }, APR15)).toBe(6000)
  })
})
