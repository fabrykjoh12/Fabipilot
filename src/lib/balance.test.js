import { describe, it, expect } from 'vitest'
import { balanceAt, latestSnapshot, monthlyFlow, accountBalance, totalBalance } from './balance.js'

const snap = (date, amount) => ({ date, amount })
const inn = (date, amount, kind = 'inntekt') => ({ date, amount, kind })
const ut = (date, amount) => ({ date, amount })

describe('latestSnapshot', () => {
  const snaps = [snap('2026-06-01', 1000), snap('2026-08-01', 5000), snap('2026-07-01', 3000)]

  it('finner siste holdepunkt på eller før datoen, uansett rekkefølge i lista', () => {
    expect(latestSnapshot(snaps, '2026-07-15').date).toBe('2026-07-01')
    expect(latestSnapshot(snaps, '2026-08-01').date).toBe('2026-08-01')
  })

  it('er null når alt ligger etter datoen', () => {
    expect(latestSnapshot(snaps, '2026-05-01')).toBeNull()
    expect(latestSnapshot([], '2026-08-01')).toBeNull()
  })
})

describe('balanceAt', () => {
  const snaps = [snap('2026-08-01', 50000)]
  const inflows = [inn('2026-08-05', 6000), inn('2026-08-20', 2000, 'overforing')]
  const expenses = [ut('2026-08-03', 1500), ut('2026-08-10', 500)]

  it('ruller holdepunktet framover med inn minus ut', () => {
    const b = balanceAt(snaps, inflows, expenses, '2026-08-31')
    expect(b.balance).toBe(50000 + 8000 - 2000)
    expect(b.inSince).toBe(8000)
    expect(b.outSince).toBe(2000)
    expect(b.exact).toBe(false)
  })

  it('teller bare bevegelser ETTER holdepunktet — selve dagen er allerede med i tallet', () => {
    const b = balanceAt([snap('2026-08-05', 50000)], inflows, expenses, '2026-08-31')
    // 5. aug-innbetalingen er med i avlesningen, ikke oppå den
    expect(b.inSince).toBe(2000)
    expect(b.balance).toBe(50000 + 2000 - 500)
  })

  it('stopper på datoen du spør om', () => {
    expect(balanceAt(snaps, inflows, expenses, '2026-08-04').balance).toBe(50000 - 1500)
  })

  it('bruker det NYESTE holdepunktet — en ny avlesning overstyrer avvik', () => {
    const b = balanceAt([...snaps, snap('2026-08-15', 41234)], inflows, expenses, '2026-08-31')
    expect(b.anchor.date).toBe('2026-08-15')
    expect(b.balance).toBe(41234 + 2000) // bare 20. aug-overføringen ligger etter
  })

  it('er null uten holdepunkt — vi gjetter ikke på saldo', () => {
    expect(balanceAt([], inflows, expenses, '2026-08-31')).toBeNull()
    expect(balanceAt(snaps, inflows, expenses, '2026-07-01')).toBeNull()
  })

  it('markerer avlesningen som eksakt når ingenting har skjedd etterpå', () => {
    expect(balanceAt(snaps, [], [], '2026-08-01').exact).toBe(true)
  })
})

describe('monthlyFlow', () => {
  /* Speiler brukerens ekte konto: nesten alt inn er overføringer fra egen konto.
     Blandes de med inntekt, ser måneden ut som om han tjente 45 000. */
  const inflows = [
    inn('2026-08-02', 6256), // lønn
    inn('2026-08-04', 959, 'refusjon'), // penger tilbake fra Telia
    inn('2026-08-06', 38000, 'overforing'), // flyttet fra sparekonto
    inn('2026-07-01', 9999), // annen måned
  ]
  const expenses = [ut('2026-08-03', 4000), ut('2026-08-11', 2000), ut('2026-07-05', 5555)]

  it('skiller ekte inntekt fra flyttede penger', () => {
    const f = monthlyFlow(inflows, expenses, '2026-08')
    expect(f.in).toBe(45215)
    expect(f.income).toBe(6256 + 959)
    expect(f.transfers).toBe(38000)
  })

  it('regner netto endring i saldo av ALT inn og ut', () => {
    const f = monthlyFlow(inflows, expenses, '2026-08')
    expect(f.out).toBe(6000)
    expect(f.net).toBe(45215 - 6000)
  })

  it('måler sparerate mot ekte inntekt, ikke mot overføringene', () => {
    const f = monthlyFlow(inflows, expenses, '2026-08')
    expect(f.savingRate).toBeCloseTo((7215 - 6000) / 7215, 5)
  })

  it('har ingen sparerate når det ikke finnes inntekt å måle mot', () => {
    const f = monthlyFlow([inn('2026-08-06', 38000, 'overforing')], expenses, '2026-08')
    expect(f.income).toBe(0)
    expect(f.savingRate).toBeNull()
  })

  it('holder seg innenfor måneden', () => {
    const f = monthlyFlow(inflows, expenses, '2026-07')
    expect(f.in).toBe(9999)
    expect(f.out).toBe(5555)
  })
})

describe('flere kontoer', () => {
  const accounts = [{ id: 'brukskonto', name: 'Brukskonto' }, { id: 'sparekonto', name: 'Sparekonto' }]
  const snaps = [
    { accountId: 'brukskonto', date: '2026-08-01', amount: 20000 },
    { accountId: 'sparekonto', date: '2026-08-01', amount: 80000 },
  ]
  /* En overføring på 15 000 fra brukskonto til sparekonto, slik den ser ut når
     BEGGE kontoutskriftene er importert: ut på den ene, inn på den andre. */
  const expenses = [
    { accountId: 'brukskonto', date: '2026-08-05', amount: 15000, transfer: true },
    { accountId: 'brukskonto', date: '2026-08-06', amount: 900 },
  ]
  const inflows = [{ accountId: 'sparekonto', date: '2026-08-05', amount: 15000, kind: 'overforing' }]

  it('ruller hver konto for seg', () => {
    expect(accountBalance('brukskonto', snaps, inflows, expenses, '2026-08-31').balance).toBe(20000 - 15000 - 900)
    expect(accountBalance('sparekonto', snaps, inflows, expenses, '2026-08-31').balance).toBe(80000 + 15000)
  })

  it('lar overføringen nette seg ut i totalen — pengene forsvant ikke', () => {
    const t = totalBalance(accounts, snaps, inflows, expenses, '2026-08-31')
    // 100 000 inn, minus det ene ekte kjøpet på 900
    expect(t.total).toBe(100000 - 900)
    expect(t.missing).toBe(0)
  })

  it('holder kontoer uten avlesning UTENFOR totalen i stedet for å gjette', () => {
    const withNew = [...accounts, { id: 'kredittkort', name: 'Kredittkort' }]
    const t = totalBalance(withNew, snaps, inflows, expenses, '2026-08-31')
    expect(t.total).toBe(100000 - 900) // uendret
    expect(t.missing).toBe(1)
    expect(t.known).toBe(2)
    expect(t.rows.find((r) => r.account.id === 'kredittkort').balance).toBeNull()
  })

  it('sier fra når ingenting er lest av', () => {
    const t = totalBalance(accounts, [], inflows, expenses, '2026-08-31')
    expect(t.hasAny).toBe(false)
    expect(t.missing).toBe(2)
  })

  it('blander ikke kontoenes bevegelser', () => {
    // sparekontoens innbetaling skal ikke løfte brukskontoen
    expect(accountBalance('brukskonto', snaps, inflows, [], '2026-08-31').inSince).toBe(0)
  })
})

describe('netReal — ekte endring, ikke flyttede penger', () => {
  /* Flytter du 15 000 fra brukskonto til sparekonto, kommer de inn på den ene
     kontoen mens uttaket er en overføring som ikke er forbruk. `net` ville da
     sagt at du ble 15 000 rikere av å flytte dine egne penger. */
  const inflows = [
    { date: '2026-08-02', amount: 34000, kind: 'inntekt' },
    { date: '2026-08-03', amount: 15000, kind: 'overforing' },
  ]
  const spending = [{ date: '2026-08-04', amount: 1270 }] // overføringen ut er filtrert bort

  it('teller bare ekte inntekt minus forbruk', () => {
    const f = monthlyFlow(inflows, spending, '2026-08')
    expect(f.netReal).toBe(34000 - 1270)
  })

  it('lar `net` stå urørt for dem som vil se all bevegelse', () => {
    const f = monthlyFlow(inflows, spending, '2026-08')
    expect(f.net).toBe(49000 - 1270)
  })

  it('er negativ når du bruker mer enn du tjener', () => {
    const f = monthlyFlow([{ date: '2026-08-02', amount: 1000, kind: 'inntekt' }], [{ date: '2026-08-05', amount: 4000 }], '2026-08')
    expect(f.netReal).toBe(-3000)
  })
})
