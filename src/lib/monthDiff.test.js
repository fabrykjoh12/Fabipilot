import { describe, it, expect } from 'vitest'
import { monthDiff, explainMonth } from './monthDiff.js'

const e = (date, amount, category, note = '') => ({ date, amount, category, note })

describe('monthDiff', () => {
  const juli = [e('2026-07-04', 3000, 'dagligvarer', 'Rema 1000'), e('2026-07-18', 1000, 'restaurant', 'Kaffebrenneriet')]
  const august = [
    e('2026-08-03', 3200, 'dagligvarer', 'Rema 1000'),
    e('2026-08-11', 900, 'restaurant', 'Kaffebrenneriet'),
    e('2026-08-14', 8000, 'hjem', 'Elkjøp'),
  ]

  it('summerer begge månedene og endringen', () => {
    const d = monthDiff([...juli, ...august], '2026-08', '2026-07')
    expect(d.total).toBe(12100)
    expect(d.prevTotal).toBe(4000)
    expect(d.diff).toBe(8100)
  })

  it('sorterer kategoriene på hvor mye de flyttet seg, ikke på beløp', () => {
    const d = monthDiff([...juli, ...august], '2026-08', '2026-07')
    expect(d.categories[0]).toMatchObject({ cat: 'hjem', diff: 8000 })
    expect(d.categories.map((c) => c.cat)).toContain('restaurant') // gikk NED, men er med
  })

  it('peker på enkeltkjøpet når det bærer mesteparten av økningen', () => {
    const d = monthDiff([...juli, ...august], '2026-08', '2026-07')
    expect(d.biggest).toMatchObject({ note: 'Elkjøp', amount: 8000 })
    expect(d.biggest.share).toBeGreaterThan(0.5)
  })

  it('peker IKKE på et enkeltkjøp når økningen er spredt utover', () => {
    const spredt = ['2026-08-01', '2026-08-08', '2026-08-15', '2026-08-22'].map((dt) => e(dt, 2000, 'dagligvarer', 'Rema 1000'))
    const d = monthDiff([...juli, ...spredt], '2026-08', '2026-07')
    expect(d.biggest).toBeNull()
  })

  it('finner steder du ikke handlet forrige måned', () => {
    const d = monthDiff([...juli, ...august], '2026-08', '2026-07')
    expect(d.newMerchants.map((m) => m.name)).toEqual(['Elkjøp'])
  })

  it('har ingen nye steder når alt går igjen', () => {
    const d = monthDiff([...juli, ...august.slice(0, 2)], '2026-08', '2026-07')
    expect(d.newMerchants).toEqual([])
  })

  it('er tom-sikker', () => {
    const d = monthDiff(null, '2026-08', '2026-07')
    expect(d).toMatchObject({ total: 0, prevTotal: 0, diff: 0, biggest: null })
  })
})

describe('explainMonth', () => {
  const catLabel = (k) => ({ hjem: 'Hjem og regninger', dagligvarer: 'Dagligvarer' }[k] || k)

  it('sier når ett kjøp forklarer nesten hele økningen', () => {
    const d = monthDiff(
      [e('2026-07-04', 3000, 'dagligvarer', 'Rema'), e('2026-08-14', 3100, 'dagligvarer', 'Rema'), e('2026-08-15', 8000, 'hjem', 'Elkjøp')],
      '2026-08', '2026-07',
    )
    expect(explainMonth(d, catLabel)).toBe('Nesten hele økningen er ett kjøp: Elkjøp på 8000 kr.')
  })

  it('peker på kategorien når økningen er spredt', () => {
    const d = monthDiff(
      [e('2026-07-04', 2000, 'dagligvarer', 'Rema'),
       e('2026-08-02', 2500, 'dagligvarer', 'Rema'), e('2026-08-12', 2600, 'dagligvarer', 'Meny')],
      '2026-08', '2026-07',
    )
    expect(explainMonth(d, catLabel)).toBe('3100 kr opp — mest Dagligvarer, som gikk 3100 kr opp.')
  })

  it('sier ingenting om småsvingninger — de er ikke en historie', () => {
    const d = monthDiff([e('2026-07-04', 3000, 'dagligvarer'), e('2026-08-04', 3050, 'dagligvarer')], '2026-08', '2026-07')
    expect(explainMonth(d, catLabel)).toBeNull()
  })

  it('sier ingenting uten en forrige måned å måle mot', () => {
    const d = monthDiff([e('2026-08-04', 5000, 'dagligvarer')], '2026-08', '2026-07')
    expect(explainMonth(d, catLabel)).toBeNull()
  })

  it('takler nedgang like godt som oppgang', () => {
    const d = monthDiff(
      [e('2026-07-04', 6000, 'dagligvarer', 'Rema'), e('2026-08-04', 2000, 'dagligvarer', 'Rema')],
      '2026-08', '2026-07',
    )
    expect(explainMonth(d, catLabel)).toBe('4000 kr ned — mest Dagligvarer, som gikk 4000 kr ned.')
  })
})

describe('explainMonth med tallformat', () => {
  const catLabel = (k) => ({ dagligvarer: 'Dagligvarer' }[k] || k)
  // Enkel formatter — nb-NO bruker hardt mellomrom, som ville gjort testen om
  // til en test av Intl i stedet for av explainMonth.
  const kr = (n) => `${String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} kr`

  it('bruker formattereren som sendes inn, så tusenskillet blir riktig', () => {
    const d = monthDiff(
      [e('2026-07-04', 1000, 'dagligvarer', 'Rema'),
       e('2026-08-04', 1100, 'dagligvarer', 'Rema'), e('2026-08-09', 8000, 'hjem', 'Elkjøp')],
      '2026-08', '2026-07',
    )
    expect(explainMonth(d, catLabel, kr)).toContain('8 000 kr')
  })
})
