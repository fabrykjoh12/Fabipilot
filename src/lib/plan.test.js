import { describe, it, expect } from 'vitest'
import {
  daysBetween, monthlyAverages, runway, dailyAllowance, planProgress, suggestBudgets,
} from './plan.js'

const exp = (date, amount, category = 'dagligvarer') => ({ date, amount, category })

describe('daysBetween', () => {
  it('teller begge endepunktene', () => {
    expect(daysBetween('2026-09-01', '2026-09-01')).toBe(1)
    expect(daysBetween('2026-09-01', '2026-09-30')).toBe(30)
  })
  it('krysser månedsskifte og årsskifte', () => {
    expect(daysBetween('2026-12-30', '2027-01-02')).toBe(4)
  })
  it('er null på tull', () => {
    expect(daysBetween('', '2026-01-01')).toBeNull()
    expect(daysBetween('2026-01-01', null)).toBeNull()
  })
})

describe('monthlyAverages', () => {
  const rows = [
    exp('2026-06-05', 1000), exp('2026-06-20', 1000), // juni: 2000
    exp('2026-07-10', 4000, 'restaurant'), // juli: 4000
    exp('2026-08-01', 3000), // august: 3000
  ]

  it('deler på måneder som FAKTISK har data, ikke på vindusbredden', () => {
    const a = monthlyAverages(rows, { monthsBack: 6, endYM: '2026-08' })
    expect(a.monthsCounted).toBe(3)
    expect(a.perMonth).toBeCloseTo(9000 / 3, 5)
  })

  it('snitter per kategori over de samme månedene', () => {
    const a = monthlyAverages(rows, { monthsBack: 6, endYM: '2026-08' })
    expect(a.byCategory.dagligvarer).toBeCloseTo(5000 / 3, 5)
    expect(a.byCategory.restaurant).toBeCloseTo(4000 / 3, 5)
  })

  it('utelater måneder utenfor vinduet', () => {
    const a = monthlyAverages(rows, { monthsBack: 1, endYM: '2026-08' })
    expect(a.monthsCounted).toBe(1)
    expect(a.perMonth).toBe(3000)
  })

  it('takler tom liste', () => {
    expect(monthlyAverages([]).perMonth).toBe(0)
    expect(monthlyAverages(null).monthsCounted).toBe(0)
  })
})

describe('runway', () => {
  it('regner ut hvor mange måneder pengene varer', () => {
    const r = runway({ startAmount: 100000, monthlyBurn: 20000 })
    expect(r.months).toBe(5)
    expect(r.endless).toBe(false)
  })
  it('trekker fra inntekt underveis', () => {
    expect(runway({ startAmount: 100000, monthlyBurn: 20000, monthlyIncome: 10000 }).months).toBe(10)
  })
  it('er uendelig når inntekten dekker forbruket', () => {
    expect(runway({ startAmount: 5000, monthlyBurn: 10000, monthlyIncome: 10000 }).endless).toBe(true)
  })
})

/* Japan-scenariet: 150 000 kr, 1. sep – 31. jan, ingen lønn,
   2 000 kr/mnd i faste utgifter som løper videre hjemme. */
const JAPAN = {
  startAmount: 150000,
  startDate: '2026-09-01',
  endDate: '2027-01-31',
  income: 0,
  fixedMonthly: 2000,
}

describe('dailyAllowance — Japan', () => {
  const a = dailyAllowance(JAPAN)

  it('teller hele perioden', () => {
    expect(a.ok).toBe(true)
    expect(a.days).toBe(153) // sep 30 + okt 31 + nov 30 + des 31 + jan 31
    expect(a.months).toBeCloseTo(5.03, 1)
  })

  it('skiller «alt per dag» fra «fritt per dag» etter faste utgifter', () => {
    expect(a.perDay).toBeCloseTo(150000 / 153, 5)
    expect(a.fixedTotal).toBeCloseTo((2000 * 153) / 30.4375, 2)
    expect(a.freePerDay).toBeLessThan(a.perDay)
    expect(a.freePerMonth).toBeCloseTo(a.freePerDay * 30.4375, 5)
  })

  it('flagger når de faste utgiftene alene spiser opp alt', () => {
    expect(dailyAllowance({ ...JAPAN, startAmount: 5000 }).short).toBe(true)
    expect(a.short).toBe(false)
  })

  it('gir ok:false uten gyldige datoer', () => {
    expect(dailyAllowance({ ...JAPAN, endDate: '' }).ok).toBe(false)
    expect(dailyAllowance({}).ok).toBe(false)
  })
})

describe('planProgress — Japan', () => {
  it('før avreise: ingenting brukt, full periode igjen', () => {
    const p = planProgress(JAPAN, [], '2026-08-15')
    expect(p.beforeStart).toBe(true)
    expect(p.dayNo).toBe(0)
    expect(p.daysLeft).toBe(153)
    expect(p.spent).toBe(0)
  })

  it('teller bare forbruk INNI perioden', () => {
    const rows = [
      exp('2026-08-31', 9999), // før avreise — skal ikke telle
      exp('2026-09-01', 500),
      exp('2026-09-10', 700),
      exp('2027-02-05', 8888), // etter hjemkomst — skal ikke telle
    ]
    const p = planProgress(JAPAN, rows, '2026-09-10')
    expect(p.spent).toBe(1200)
    expect(p.dayNo).toBe(10)
  })

  it('sier fra når du ligger under budsjett', () => {
    // dag 10 av 153: burde ha brukt 10 × (150000/153) ≈ 9804
    const p = planProgress(JAPAN, [exp('2026-09-05', 5000)], '2026-09-10')
    expect(p.onTrack).toBe(true)
    expect(p.diff).toBeGreaterThan(0)
    expect(p.projectedEnd).toBeGreaterThan(0) // holder ut perioden
  })

  it('sier fra når tempoet ikke holder ut perioden', () => {
    const p = planProgress(JAPAN, [exp('2026-09-05', 30000)], '2026-09-10')
    expect(p.onTrack).toBe(false)
    expect(p.projectedEnd).toBeLessThan(0) // går tom før 31. januar
    expect(p.runsOutOnDay).toBeLessThan(153)
  })

  it('justerer dagsbeløpet for resten når du har brukt for mye', () => {
    const p = planProgress(JAPAN, [exp('2026-09-05', 20000)], '2026-09-10')
    expect(p.left).toBe(130000)
    expect(p.perDayLeft).toBeCloseTo(130000 / 143, 5)
    expect(p.perDayLeft).toBeLessThan(p.perDay)
  })

  it('etter hjemkomst fryses regnestykket på sluttdatoen', () => {
    const rows = [exp('2027-01-20', 1000), exp('2027-03-01', 5000)]
    const p = planProgress(JAPAN, rows, '2027-03-15')
    expect(p.finished).toBe(true)
    expect(p.dayNo).toBe(153)
    expect(p.daysLeft).toBe(0)
    expect(p.spent).toBe(1000) // mars-kjøpet er utenfor
    expect(p.perDayLeft).toBe(0) // ingen deling på null
  })
})

describe('suggestBudgets', () => {
  it('runder til nærmeste hundrelapp', () => {
    const rows = [exp('2026-07-01', 3247), exp('2026-08-01', 3247)]
    const s = suggestBudgets(rows, { endYM: '2026-08' })
    expect(s.budgets.dagligvarer).toBe(3200)
    expect(s.monthsCounted).toBe(2)
  })

  it('dropper kategorier som runder til null', () => {
    const s = suggestBudgets([exp('2026-08-01', 20, 'ovrig')], { endYM: '2026-08' })
    expect(s.budgets.ovrig).toBeUndefined()
  })
})
