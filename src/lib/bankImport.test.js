import { describe, it, expect } from 'vitest'
import {
  parseBankCSV, parseNorDate, parseAmount, cleanMerchant,
  isTransfer, guessCategory, importKey, buildImportPlan,
} from './bankImport.js'

// Realistisk utsnitt av DNB-fila («Lagre til fil»): semikolon, quotet, CRLF,
// punktum-desimaler, reserverte rader og interne overføringer.
const CSV = [
  '"Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"',
  '"08.08.2026";"Varekjøp i butikk REMA EIK              T Reservert transaksjon ";"10.08.2026";35.8;""',
  '"07.08.2026";"Overføring  Reservert transaksjon ";"10.08.2026";"";1000',
  '"07.08.2026";"Varekjøp Rema Eik Rema 1000 Ei Tønsberg Dato 07.08 kl. 13.01 ";"07.08.2026";100.3;""',
  '"06.08.2026";"Visa Varekjøp EasyPark AS ";"07.08.2026";21.83;""',
  '"06.08.2026";"Varekjøp Normal Tønsberg Jernbanegate Tønsbe Dato 06.08 kl. 14.57 ";"06.08.2026";132;""',
  '"05.08.2026";"Kontoregulering 221 Mobil Overføring ";"05.08.2026";500;""',
  '"05.08.2026";"Visa Varekjøp APPLE.COM/BILL ";"05.08.2026";24;""',
  '"04.08.2026";"Varekjøp Vitusapotek Far Jens Müllers Tønsbe Dato 04.08 kl. 11.00 ";"04.08.2026";189;""',
  '"04.08.2026";"100021 Vipps:vkt ";"04.08.2026";50;""',
].join('\r\n')

describe('parseBankCSV', () => {
  it('leser DNB-formatet: semikolon, quotet, CRLF, punktum-desimaler', () => {
    const r = parseBankCSV(CSV)
    expect(r.ok).toBe(true)
    expect(r.transactions).toHaveLength(9)
    expect(r.transactions[0]).toMatchObject({ date: '2026-08-08', amountOut: 35.8, reserved: true })
    expect(r.transactions[1]).toMatchObject({ amountIn: 1000, amountOut: null })
  })

  it('avviser fil med ukjente kolonner med en forståelig feil', () => {
    const r = parseBankCSV('"a";"b"\n"1";"2"')
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/kolonnene/i)
  })
})

describe('små hjelpere', () => {
  it('parseNorDate: dd.mm.yyyy → ISO', () => {
    expect(parseNorDate('08.08.2026')).toBe('2026-08-08')
    expect(parseNorDate('tull')).toBeNull()
  })
  it('parseAmount: punktum-desimal, norsk komma, tomt', () => {
    expect(parseAmount(35.8)).toBe(35.8)
    expect(parseAmount('21.83')).toBe(21.83)
    expect(parseAmount('1 234,56')).toBe(1234.56)
    expect(parseAmount('')).toBeNull()
  })
  it('cleanMerchant: fjerner prefiks, dato-hale, «Reservert» og interne koder', () => {
    expect(cleanMerchant('Varekjøp Rema Eik Rema 1000 Ei Tønsberg Dato 07.08 kl. 13.01 ')).toBe('Rema Eik Rema 1000 Ei Tønsberg')
    expect(cleanMerchant('Visa Varekjøp EasyPark AS ')).toBe('EasyPark AS')
    expect(cleanMerchant('Varekjøp i butikk REMA EIK              T Reservert transaksjon ')).toBe('REMA EIK T')
    expect(cleanMerchant('100021 Vipps:vkt')).toBe('Vipps:vkt')
    // intern kode + valutabeløp i kombinasjon — koden må vekk FØR valuta-strippen
    expect(cleanMerchant('100132 Nok 23490,00 Klarna:dustinhom')).toBe('Klarna:dustinhom')
    expect(cleanMerchant('100132 Usd 12,50 Midjourney Inc. Valutakurs: 10.9')).toBe('Midjourney Inc.')
  })
  it('isTransfer: overføringer og kontoreguleringer er ikke forbruk', () => {
    expect(isTransfer('Overføring  Reservert transaksjon')).toBe(true)
    expect(isTransfer('Kontoregulering 221 Mobil Overføring')).toBe(true)
    expect(isTransfer('Varekjøp Rema Eik')).toBe(false)
  })
})

describe('guessCategory — mot brukerens faktiske butikker', () => {
  it.each([
    ['Rema Eik Rema 1000 Ei Tønsberg', 'dagligvarer'],
    ['Meny Farmandstr Jernbanegt. Tønsbe', 'dagligvarer'],
    ['Normal Tønsberg Jernbanegate', 'dagligvarer'],
    ['EasyPark AS', 'kjoretoy'],
    ['Ubetjent Varekjøp St1 Fokserød', 'kjoretoy'],
    ['Subway Farmands Jernbanegate', 'restaurant'],
    ['Ssn Alimento Raveien 215 Borre', 'restaurant'],
    ['Vitusapotek Far Jens Müllers', 'helse'],
    ['Telia Farmandst Jernbanegate', 'hjem'],
    ['Clas Ohl 2828 Jernbaneg.1d', 'hjem'],
    ['APPLE.COM/BILL', 'fritid'],
    ['Kilden Kino Kilden 8', 'fritid'],
    ['Vipps:vkt', 'ovrig'],
    ['Prislagte Tjenester', 'ovrig'],
  ])('%s → %s', (merchant, cat) => {
    expect(guessCategory(merchant)).toBe(cat)
  })

  it('«obs bygg» treffer hjem selv om «obs» alene er dagligvarer', () => {
    expect(guessCategory('Obs Bygg Sandefjord')).toBe('hjem')
    expect(guessCategory('Obs Stavern')).toBe('dagligvarer')
  })
})

describe('buildImportPlan', () => {
  it('grupperer per butikk, hopper over reservert/overføringer/innbetalinger', () => {
    const plan = buildImportPlan(CSV)
    expect(plan.ok).toBe(true)
    // 9 rader − 1 reservert − 1 inn − 1 kontoregulering = 6 kjøp
    expect(plan.count).toBe(6)
    expect(plan.skipped).toEqual({ reserved: 1, transfers: 1, incoming: 1, duplicates: 0 })
    expect(plan.from).toBe('2026-08-04')
    expect(plan.to).toBe('2026-08-07')
    const names = plan.groups.map((g) => g.merchant)
    expect(names).toContain('EasyPark AS')
    expect(plan.total).toBeCloseTo(100.3 + 21.83 + 132 + 24 + 189 + 50, 2)
  })

  it('dedup: allerede importerte nøkler hoppes over — som multiset', () => {
    const first = buildImportPlan(CSV)
    const keys = new Map()
    for (const g of first.groups) for (const r of g.rows) keys.set(r.key, (keys.get(r.key) || 0) + 1)
    const again = buildImportPlan(CSV, { existingKeys: keys })
    expect(again.count).toBe(0)
    expect(again.skipped.duplicates).toBe(6)
  })

  it('to like kjøp samme dag er IKKE duplikater av hverandre', () => {
    const twin = CSV + '\r\n"06.08.2026";"Visa Varekjøp EasyPark AS ";"07.08.2026";21.83;""'
    const plan = buildImportPlan(twin)
    const easy = plan.groups.find((g) => g.merchant === 'EasyPark AS')
    expect(easy.count).toBe(2)
    // …men har du én fra før, telles bare én som duplikat:
    const keys = new Map([[importKey('2026-08-06', 21.83, 'EasyPark AS'), 1]])
    const plan2 = buildImportPlan(twin, { existingKeys: keys })
    expect(plan2.groups.find((g) => g.merchant === 'EasyPark AS').count).toBe(1)
    expect(plan2.skipped.duplicates).toBe(1)
  })

  it('overrides: brukerens tidligere kategorivalg vinner over gjettingen', () => {
    const plan = buildImportPlan(CSV, { overrides: { 'easypark as': 'ovrig' } })
    expect(plan.groups.find((g) => g.merchant === 'EasyPark AS').category).toBe('ovrig')
  })
})
