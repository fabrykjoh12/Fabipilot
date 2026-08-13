import { describe, it, expect } from 'vitest'
import { normalizeName, sameMerchant, fixedThisMonth, detectRecurring } from './recurring.js'

const exp = (date, amount, note, category = 'ovrig') => ({ date, amount, note, category })
const monthly = (s) => (s.cycle === 'yearly' ? s.amount / 12 : s.amount)

describe('sameMerchant', () => {
  it('kjenner igjen samme selskap på tvers av bankens skrivemåte', () => {
    expect(sameMerchant('Telia Norge AS', 'Telia')).toBe(true)
    expect(sameMerchant('SPOTIFY', 'Spotify')).toBe(true)
    expect(sameMerchant('Elkjøp Tønsberg', 'Elkjøp')).toBe(true)
  })

  it('lar seg ikke lure av selskapsformer alene', () => {
    // «AS» og «Norge» er felles, men bærer ingen informasjon
    expect(sameMerchant('Rema 1000 Norge AS', 'Telia Norge AS')).toBe(false)
  })

  it('krever at fellesordet er langt nok til å bety noe', () => {
    expect(sameMerchant('Circle K', 'Kiwi K')).toBe(false)
  })

  it('er tom-sikker', () => {
    expect(sameMerchant('', 'Telia')).toBe(false)
    expect(sameMerchant(null, undefined)).toBe(false)
  })
})

describe('fixedThisMonth', () => {
  const subs = [
    { name: 'Spotify', amount: 129, cycle: 'monthly' },
    { name: 'Telia', amount: 811, cycle: 'monthly' },
    { name: 'Forsikring', amount: 8400, cycle: 'yearly' },
  ]

  it('legger IKKE til abonnementer som allerede ligger som importerte kjøp', () => {
    const rows = [exp('2026-08-12', 129, 'Spotify'), exp('2026-08-20', 811, 'Telia Norge AS')]
    const f = fixedThisMonth(subs, rows, monthly)
    expect(f.covered.map((c) => c.sub.name).sort()).toEqual(['Spotify', 'Telia'])
    expect(f.pending.map((s) => s.name)).toEqual(['Forsikring'])
    expect(f.total).toBe(700) // bare årsforsikringen, delt på 12
  })

  it('legger til alt når ingenting er importert ennå', () => {
    const f = fixedThisMonth(subs, [], monthly)
    expect(f.total).toBe(129 + 811 + 700)
    expect(f.covered).toHaveLength(0)
  })

  it('rapporterer hvor mye av kjøpssummen som ER faste trekk', () => {
    const rows = [exp('2026-08-12', 129, 'Spotify'), exp('2026-08-03', 450, 'Rema 1000')]
    expect(fixedThisMonth(subs, rows, monthly).coveredAmount).toBe(129)
  })

  it('er tom-sikker', () => {
    expect(fixedThisMonth(null, null, monthly).total).toBe(0)
  })
})

describe('detectRecurring', () => {
  const today = new Date(2026, 7, 15) // 15. august 2026

  /* Telia hver måned, samme beløp, samme dag — et fast trekk. */
  const telia = ['2026-05-20', '2026-06-20', '2026-07-21', '2026-08-20'].map((d) => exp(d, 811, 'Telia Norge AS', 'hjem'))
  /* Rema: mange kjøp hver måned, ulike beløp — en butikk, ikke et abonnement. */
  const rema = ['2026-06-02', '2026-06-14', '2026-07-03', '2026-07-19', '2026-08-01'].map((d, i) => exp(d, 200 + i * 90, 'Rema 1000', 'dagligvarer'))

  it('finner et fast trekk og oppsummerer beløp, dag og antall måneder', () => {
    const [hit] = detectRecurring([...telia, ...rema], { today })
    expect(hit.name).toBe('Telia Norge AS')
    expect(hit.amount).toBe(811)
    expect(hit.day).toBe(20)
    expect(hit.months).toBe(4)
    expect(hit.category).toBe('hjem')
  })

  it('foreslår ikke dagligvarebutikker — flere kjøp samme måned er ikke et abonnement', () => {
    expect(detectRecurring(rema, { today })).toHaveLength(0)
  })

  it('krever minst tre måneder — to kan være tilfeldig', () => {
    expect(detectRecurring(telia.slice(0, 2), { today })).toHaveLength(0)
  })

  it('foreslår ikke det du allerede har lagt inn', () => {
    expect(detectRecurring(telia, { today, subs: [{ name: 'Telia' }] })).toHaveLength(0)
  })

  it('hopper over trekk som stoppet for flere måneder siden', () => {
    const gammel = ['2026-01-10', '2026-02-10', '2026-03-10'].map((d) => exp(d, 199, 'Viaplay'))
    expect(detectRecurring(gammel, { today })).toHaveLength(0)
  })

  it('krever stabilt beløp — svingninger på 20 %+ er ikke et abonnement', () => {
    const ustabil = [exp('2026-06-10', 200, 'Bensin AS'), exp('2026-07-10', 400, 'Bensin AS'), exp('2026-08-10', 700, 'Bensin AS')]
    expect(detectRecurring(ustabil, { today })).toHaveLength(0)
  })

  it('krever at dagen holder seg — spredt over måneden er tilfeldige kjøp', () => {
    const spredt = [exp('2026-06-02', 300, 'Kino AS'), exp('2026-07-18', 300, 'Kino AS'), exp('2026-08-27', 300, 'Kino AS')]
    expect(detectRecurring(spredt, { today })).toHaveLength(0)
  })

  it('sorterer forslagene på beløp', () => {
    const smatt = ['2026-06-05', '2026-07-05', '2026-08-05'].map((d) => exp(d, 99, 'Avisa AS'))
    const navn = detectRecurring([...telia, ...smatt], { today }).map((r) => r.name)
    expect(navn).toEqual(['Telia Norge AS', 'Avisa AS'])
  })

  it('er tom-sikker', () => {
    expect(detectRecurring(null, { today })).toEqual([])
  })
})

describe('normalizeName', () => {
  it('tåler norske bokstaver og tegnsetting', () => {
    expect(normalizeName('Elkjøp Tønsberg, AS.')).toBe('elkjøp tønsberg as')
  })
})
