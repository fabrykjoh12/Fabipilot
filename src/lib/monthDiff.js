/* «Hva var annerledes denne måneden?»

   Endringsmerket sier at du brukte 7 % mer enn i juli. Det svarer ikke på det
   du faktisk lurer på: HVA flyttet seg? Ofte er hele utslaget ett enkelt kjøp,
   og da er det ikke vanene dine som har endret seg.

   Rene funksjoner; ingenting utledet lagres. */

const sum = (rows) => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0)
const inMonth = (rows, ym) => (rows || []).filter((r) => r && (r.date || '').startsWith(ym))

/* Sammenlign to måneder og forklar forskjellen.

   Returnerer:
     total/prevTotal/diff  — summene og endringen
     categories[]          — per kategori, sortert på hvor mye den flyttet seg
     biggest               — det enkeltkjøpet som forklarer mest av økningen,
                             men bare når det faktisk er stort nok til å bety noe
     newMerchants[]        — steder du handlet denne måneden og ikke forrige */
export function monthDiff(expenses, ym, prevYm) {
  const cur = inMonth(expenses, ym)
  const prev = inMonth(expenses, prevYm)
  const total = sum(cur)
  const prevTotal = sum(prev)

  const byCat = new Map()
  for (const r of cur) byCat.set(r.category, { cat: r.category, now: (byCat.get(r.category)?.now || 0) + (r.amount || 0), then: 0 })
  for (const r of prev) {
    const e = byCat.get(r.category) || { cat: r.category, now: 0, then: 0 }
    e.then += r.amount || 0
    byCat.set(r.category, e)
  }
  const categories = [...byCat.values()]
    .map((e) => ({ ...e, diff: e.now - e.then }))
    .filter((e) => Math.abs(e.diff) >= 1)
    .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))

  /* Det største enkeltkjøpet teller bare som forklaring når det både bærer
     mesteparten av økningen OG er uvanlig stort for deg. Handler du 2 500 kr
     dagligvarer hver måned, er månedens 2 600 kr-kjøp ikke en historie selv om
     det tilfeldigvis dekker mesteparten av differansen — det er bare tirsdag. */
  let biggest = null
  const rise = total - prevTotal
  if (rise > 0) {
    const top = [...cur].sort((a, b) => (b.amount || 0) - (a.amount || 0))[0]
    const prevTop = Math.max(0, ...prev.map((r) => Number(r.amount) || 0))
    if (top && top.amount >= rise * 0.5 && top.amount >= prevTop * 1.5) {
      biggest = { note: top.note || '', amount: top.amount, date: top.date, category: top.category, share: top.amount / rise }
    }
  }

  const prevNames = new Set(prev.map((r) => (r.note || '').trim().toLowerCase()).filter(Boolean))
  const seen = new Map()
  for (const r of cur) {
    const name = (r.note || '').trim()
    if (!name || prevNames.has(name.toLowerCase())) continue
    const k = name.toLowerCase()
    seen.set(k, { name, amount: (seen.get(k)?.amount || 0) + (r.amount || 0) })
  }
  const newMerchants = [...seen.values()].sort((a, b) => b.amount - a.amount)

  return { total, prevTotal, diff: total - prevTotal, categories, biggest, newMerchants }
}

/* Én setning som forklarer forskjellen — eller null når det ikke er noe å si.

   `catLabel` mapper kategorinøkkel til norsk navn (fra src/lib/categories.js) og
   `fmt` formaterer kroner (fra src/lib/fx.js), så denne fila slipper å vite noe
   om verken kategorier eller tallformat — og holder seg fri for DOM-avhengigheter. */
export function explainMonth(diff, catLabel = (k) => k, fmt = (n) => `${n} kr`) {
  if (!diff || diff.prevTotal <= 0) return null
  const d = Math.round(diff.diff)
  if (Math.abs(d) < 200) return null // småsvingninger er ikke en historie

  const up = d > 0
  const top = diff.categories[0]
  if (!top) return null

  // Ett stort kjøp forklarer det: da er det kjøpet, ikke vanene, som er svaret.
  if (up && diff.biggest && diff.biggest.share >= 0.5 && diff.biggest.note) {
    return `Nesten hele økningen er ett kjøp: ${diff.biggest.note} på ${fmt(Math.round(diff.biggest.amount))}.`
  }

  const verb = up ? 'opp' : 'ned'
  const catDir = top.diff > 0 ? 'opp' : 'ned'
  return `${fmt(Math.abs(d))} ${verb} — mest ${catLabel(top.cat)}, som gikk ${fmt(Math.abs(Math.round(top.diff)))} ${catDir}.`
}
