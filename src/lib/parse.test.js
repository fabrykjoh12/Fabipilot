import { describe, it, expect } from 'vitest'
import { parseEntry } from './parse.js'

// Fast referansetidspunkt: onsdag 1. juli 2026, kl 10:00.
const NOW = new Date(2026, 6, 1, 10, 0)

describe('parseEntry — grunnleggende', () => {
  it('en tekst uten hint blir en udatert oppgave', () => {
    const r = parseEntry('handle melk', NOW)
    expect(r).toEqual({ title: 'handle melk', type: 'task', dueDate: null, time: '' })
  })
  it('trimmer og normaliserer mellomrom i tittelen', () => {
    const r = parseEntry('  handle   melk  ', NOW)
    expect(r.title).toBe('handle melk')
  })
})

describe('parseEntry — type-hint prefiks', () => {
  it('«idé:» setter type idea og fjerner prefikset', () => {
    const r = parseEntry('idé: podcast', NOW)
    expect(r.type).toBe('idea')
    expect(r.title).toBe('podcast')
  })
  it('«liste:» setter type todo', () => {
    const r = parseEntry('liste: kjøpe presang', NOW)
    expect(r.type).toBe('todo')
    expect(r.title).toBe('kjøpe presang')
  })
  it('«avtale:» setter type event', () => {
    const r = parseEntry('avtale: tannlege', NOW)
    expect(r.type).toBe('event')
    expect(r.title).toBe('tannlege')
  })
  it('krever skilletegn — «idemyldring» skal IKKE trigge idé-typen', () => {
    const r = parseEntry('idemyldring i morgen', NOW)
    expect(r.type).not.toBe('idea')
  })
})

describe('parseEntry — relative dager', () => {
  it('«i dag» setter dagens dato', () => {
    const r = parseEntry('handle melk i dag', NOW)
    expect(r.dueDate).toBe('2026-07-01')
    expect(r.title).toBe('handle melk')
  })
  it('«i morgen» setter morgendagens dato', () => {
    const r = parseEntry('ring tannlegen i morgen', NOW)
    expect(r.dueDate).toBe('2026-07-02')
  })
  it('«overmorgen» legger til to dager', () => {
    const r = parseEntry('betale husleie overmorgen', NOW)
    expect(r.dueDate).toBe('2026-07-03')
  })
  it('«om 3 dager» regner riktig frem', () => {
    const r = parseEntry('følge opp om 3 dager', NOW)
    expect(r.dueDate).toBe('2026-07-04')
  })
  it('«om 2 uker» regner riktig frem', () => {
    const r = parseEntry('sjekke status om 2 uker', NOW)
    expect(r.dueDate).toBe('2026-07-15')
  })
  it('«neste uke» hopper syv dager frem', () => {
    const r = parseEntry('planlegge ferie neste uke', NOW)
    expect(r.dueDate).toBe('2026-07-08')
  })
})

describe('parseEntry — ukedager', () => {
  it('finner neste forekomst av en ukedag', () => {
    // NOW er onsdag; «fredag» skal lande to dager frem
    const r = parseEntry('ring legen fredag', NOW)
    expect(r.dueDate).toBe('2026-07-03')
  })
  it('«neste fredag» hopper en ekstra uke', () => {
    const r = parseEntry('ring legen neste fredag', NOW)
    expect(r.dueDate).toBe('2026-07-10')
  })
  it('forkortelser fungerer også («fre»)', () => {
    const r = parseEntry('handle fre', NOW)
    expect(r.dueDate).toBe('2026-07-03')
  })
})

describe('parseEntry — datoformater', () => {
  it('«15. juli» tolkes som dato i inneværende år', () => {
    const r = parseEntry('bursdag 15. juli', NOW)
    expect(r.dueDate).toBe('2026-07-15')
  })
  it('en dato som allerede har passert ruller over til neste år', () => {
    const r = parseEntry('nyttårsfeiring 1. januar', NOW)
    expect(r.dueDate).toBe('2027-01-01')
  })
  it('DD.MM tolkes riktig', () => {
    const r = parseEntry('betale regning 15.7', NOW)
    expect(r.dueDate).toBe('2026-07-15')
  })
})

describe('parseEntry — klokkeslett', () => {
  it('«kl 14» setter klokkeslett og gjør oppgaven til en hendelse', () => {
    const r = parseEntry('møte kl 14', NOW)
    expect(r.time).toBe('14:00')
    expect(r.type).toBe('event')
  })
  it('«kl 14:30» tolkes med minutter', () => {
    const r = parseEntry('møte kl 14:30', NOW)
    expect(r.time).toBe('14:30')
  })
  it('«kl 1430» (uten skilletegn) tolkes likt', () => {
    const r = parseEntry('møte kl 1430', NOW)
    expect(r.time).toBe('14:30')
  })
  it('klokkeslett uten dato antar i dag', () => {
    const r = parseEntry('ring kl 09', NOW)
    expect(r.dueDate).toBe('2026-07-01')
  })
  it('en eksplisitt idé med klokkeslett forblir en idé (typehint vinner)', () => {
    const r = parseEntry('idé: møte kl 14', NOW)
    expect(r.type).toBe('idea')
  })
})

describe('parseEntry — kombinasjoner', () => {
  it('dato + klokkeslett + tittel renses riktig ut', () => {
    const r = parseEntry('ring tannlegen fredag kl 14', NOW)
    expect(r.title).toBe('ring tannlegen')
    expect(r.dueDate).toBe('2026-07-03')
    expect(r.time).toBe('14:00')
    expect(r.type).toBe('event')
  })
})
