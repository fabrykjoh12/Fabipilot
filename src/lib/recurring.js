/* Faste utgifter — gjenkjenning og sammenstilling mot bankdata.

   Bakgrunn: «Faste» ble skrevet inn for hånd før bankimporten fantes. Etter
   importen kommer de SAMME trekkene inn som helt vanlige kjøp, og da telles de
   to ganger: én gang som abonnement, én gang som kjøp. Løsningen er å la kjøpene
   være fasit — de er tross alt det som faktisk skjedde på kontoen — og bare
   legge til abonnementet når måneden ikke har et matchende trekk ennå.

   Samme navnematching brukes til å FINNE faste utgifter i historikken, så du
   slipper å skrive dem inn manuelt i det hele tatt.

   Rene funksjoner; ingenting utledet lagres. */

/* Navn fra banken («Telia Norge AS», «SPOTIFY P0C1A2») og navn du selv skrev
   («Telia», «Spotify») skal treffe hverandre. Vi skreller ned til bokstaver og
   sammenligner på ordnivå, ikke på hele strengen. */
export function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-zæøå0-9]+/gi, ' ')
    .trim()
}

// Selskapsformer og betalingsledd bærer ingen informasjon om HVEM det er.
const NOISE = new Set(['as', 'asa', 'ab', 'a', 's', 'no', 'norge', 'norway', 'nuf', 'inc', 'ltd', 'com', 'sa', 'bv', 'oy'])

function words(s) {
  return normalizeName(s).split(' ').filter((w) => w.length > 1 && !NOISE.has(w))
}

/* Er dette kjøpet det samme selskapet som abonnementet?

   Vi krever at ETT betydningsbærende ord er felles, og at ordet er langt nok
   til å bety noe («telia», «spotify»). Uten lengdekravet ville «Circle K» og
   «Kiwi» matchet abonnementet «K». */
export function sameMerchant(a, b) {
  const wa = words(a)
  const wb = words(b)
  if (!wa.length || !wb.length) return false
  return wa.some((x) => wb.some((y) => (x === y && x.length >= 3) || (x.length >= 5 && y.length >= 5 && (x.startsWith(y) || y.startsWith(x)))))
}

/* Månedens faste utgifter, uten dobbelttelling.

   `covered` = abonnementer som ALLEREDE ligger som kjøp denne måneden (beløpet
   deres ligger i kjøpssummen, så de skal ikke legges til igjen).
   `pending`  = abonnementer som ikke er trukket ennå — de legges til, ellers
   ville budsjettet sett kunstig lyst ut tidlig i måneden.
   `total`    = summen som trygt kan legges OPPÅ kjøpene. */
export function fixedThisMonth(subs, monthExpenses, monthlyCostOf) {
  const covered = []
  const pending = []
  for (const s of subs || []) {
    const hit = (monthExpenses || []).find((e) => sameMerchant(e.note, s.name))
    if (hit) covered.push({ sub: s, expense: hit })
    else pending.push(s)
  }
  return {
    covered,
    pending,
    total: pending.reduce((sum, s) => sum + monthlyCostOf(s), 0),
    // hvor mye av kjøpssummen som ER faste trekk — til «X kjøp + Y faste»-linja
    coveredAmount: covered.reduce((sum, c) => sum + Number(c.expense.amount || 0), 0),
  }
}

/* Finn faste utgifter i historikken.

   Et fast trekk ser slik ut i bankdata: samme butikk, omtrent samme beløp,
   omtrent samme dag, flere måneder på rad. Vi krever minst 3 måneder — to kan
   være tilfeldig, tre er et mønster.

   Returnerer forslag sortert på beløp, uten dem du allerede har lagt inn. */
export function detectRecurring(expenses, { subs = [], minMonths = 3, monthsBack = 12, today = new Date() } = {}) {
  const cutoff = new Date(today.getFullYear(), today.getMonth() - monthsBack, 1)
  const cutoffKey = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`

  const byMerchant = new Map()
  for (const e of expenses || []) {
    const name = (e.note || '').trim()
    if (!name || !e.date || e.date.slice(0, 7) < cutoffKey) continue
    const key = normalizeName(name)
    if (!key) continue
    if (!byMerchant.has(key)) byMerchant.set(key, { name, rows: [] })
    byMerchant.get(key).rows.push(e)
  }

  const out = []
  for (const { name, rows } of byMerchant.values()) {
    // allerede lagt inn som abonnement? da er det ikke et forslag
    if ((subs || []).some((s) => sameMerchant(s.name, name))) continue

    // én rad per måned — to kjøp hos Rema samme måned er ikke et fast trekk
    const perMonth = new Map()
    for (const r of rows) {
      const ym = r.date.slice(0, 7)
      if (!perMonth.has(ym)) perMonth.set(ym, [])
      perMonth.get(ym).push(r)
    }
    const months = [...perMonth.keys()].sort()
    if (months.length < minMonths) continue
    // flere kjøp i samme måned = dagligvarebutikk, ikke abonnement
    if ([...perMonth.values()].some((v) => v.length > 1)) continue

    const amounts = rows.map((r) => Number(r.amount) || 0)
    const avg = amounts.reduce((s, x) => s + x, 0) / amounts.length
    if (avg <= 0) continue
    // beløpet må være stabilt — priser justeres, men ikke med 20 %
    const spread = (Math.max(...amounts) - Math.min(...amounts)) / avg
    if (spread > 0.2) continue

    // og dagen må ligge i samme del av måneden
    const days = rows.map((r) => Number(r.date.slice(8, 10)))
    if (Math.max(...days) - Math.min(...days) > 6) continue

    // sammenhengende? et abonnement du sa opp i mars er ikke et forslag i august
    const last = months[months.length - 1]
    const lastDt = new Date(Number(last.slice(0, 4)), Number(last.slice(5, 7)) - 1, 1)
    const gapMonths = (today.getFullYear() - lastDt.getFullYear()) * 12 + (today.getMonth() - lastDt.getMonth())
    if (gapMonths > 1) continue

    const mid = rows[Math.floor(rows.length / 2)]
    out.push({
      name,
      amount: Math.round(avg),
      day: Math.round(days.reduce((s, d) => s + d, 0) / days.length),
      months: months.length,
      category: mid.category || 'ovrig',
      sub: mid.sub || null,
    })
  }

  return out.sort((a, b) => b.amount - a.amount)
}
