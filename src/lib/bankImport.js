/* Bankimport (DNB/Sbanken CSV) — rene funksjoner, ingen DB her.

   Fila fra DNB-nettbanken («Lagre til fil» under Siste bevegelser) er
   semikolon-separert med kolonnene:
     "Dato";"Forklaring";"Rentedato";"Ut fra konto";"Inn på konto"
   Datoer er dd.mm.yyyy, beløp har punktum som desimaltegn, linjeskift er CRLF.

   Flyten: parseBankCSV → buildImportPlan → (bruker justerer kategori per
   butikk i UI-et) → rader lagres som expenses. Dedup skjer via `importKey`
   (dato|beløp|butikk) så samme fil — eller en overlappende eksport — kan
   importeres flere ganger uten dobbeltføring. */

/* ---------- CSV ---------- */

// Håndskrevet parser i stedet for split(';') — «Forklaring» kan inneholde
// semikolon, og alle felt er quotet.
export function parseBankCSV(text) {
  const rows = []
  let field = ''
  let row = []
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++ } // escaped quote
        else inQuotes = false
      } else field += ch
    } else if (ch === '"') inQuotes = true
    else if (ch === ';') { row.push(field); field = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      if (row.some((f) => f !== '')) rows.push(row)
      row = []
    } else field += ch
  }
  row.push(field)
  if (row.some((f) => f !== '')) rows.push(row)

  if (!rows.length) return { ok: false, error: 'Fila er tom.' }
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const col = (name) => header.findIndex((h) => h.includes(name))
  const iDate = col('dato')
  const iText = col('forklaring')
  const iOut = col('ut fra')
  const iIn = col('inn på')
  if (iDate < 0 || iText < 0 || iOut < 0 || iIn < 0) {
    return { ok: false, error: 'Kjenner ikke igjen kolonnene — er dette fila fra «Lagre til fil» i DNB-nettbanken?' }
  }

  const txs = []
  for (const r of rows.slice(1)) {
    const date = parseNorDate(r[iDate])
    if (!date) continue
    const text2 = collapse(r[iText] || '')
    const out = parseAmount(r[iOut])
    const inn = parseAmount(r[iIn])
    txs.push({
      date,
      text: text2,
      amountOut: out,
      amountIn: inn,
      reserved: /reservert transaksjon/i.test(text2),
    })
  }
  if (!txs.length) return { ok: false, error: 'Fant ingen transaksjoner i fila.' }
  return { ok: true, transactions: txs }
}

function collapse(s) {
  return s.replace(/\s+/g, ' ').trim()
}

// "08.08.2026" → "2026-08-08"
export function parseNorDate(s) {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec((s || '').trim())
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null
}

// 35.8 · "35.8" · "1 234,56" → tall (kr). Tomt/ugyldig → null.
export function parseAmount(v) {
  if (v === '' || v == null) return null
  if (typeof v === 'number') return v
  let s = String(v).replace(/[\s\u00a0]/g, '') // \u00a0: NBSP brukes som tusenskille
  // norsk komma-desimal (evt. med punktum som tusenskille)
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

/* ---------- Butikknavn ---------- */

// «Varekjøp Rema Eik Rema 1000 Ei Tønsberg Dato 07.08 kl. 13.01» → «Rema Eik Rema 1000 Ei Tønsberg»
export function cleanMerchant(text) {
  let t = collapse(text)
  t = t.replace(/^(Visa Varekjøp|Varekjøp i butikk|Ubetjent Varekjøp|Varekjøp|Visa)\s+/i, '')
  t = t.replace(/^\d{4,}\s+/, '') // interne koder som «100021 » — FØR valuta, ellers blokkerer koden valuta-strippen
  // valutakjøp: «Nok 23490,00 Klarna:dustinhom» / «Gbp 179,08 Vio.com» → butikken
  t = t.replace(/^(nok|sek|usd|eur|gbp|dkk)\s+[\d.,]+\s+/i, '')
  t = t.replace(/\s*Reservert transaksjon\s*$/i, '')
  t = t.replace(/\s*Dato \d{2}\.\d{2} kl\. \d{2}\.\d{2}\s*$/i, '')
  t = t.replace(/\s*Valutakurs:?.*$/i, '')
  t = t.replace(/\s*Reservert transaksjon\s*$/i, '') // kan stå etter dato-delen også
  return t.trim() || 'Ukjent'
}

// Overføringer mellom egne kontoer o.l. er ikke forbruk.
export function isTransfer(text) {
  return /^(overføring|kontoregulering)/i.test(collapse(text))
}

/* ---------- Kategori-gjetting ---------- */

/* Nøkkelord → [kategori, underkategori]. Sjekkes ovenfra og ned, så SPESIFIKKE
   regler må stå før generelle: «obs bygg» må treffe hjem/interiør før «obs»
   treffer dagligvarer, og «bil-service» før «service». Alt matches som
   substring i det rensede butikknavnet (små bokstaver, med mellomrom rundt så
   ' yx ' ikke treffer «Styx»). Listene er bygget fra brukerens ekte
   kontoutskrift — se PROGRESS.md. */
const RULES = [
  // --- må stå først: sammensatte navn som ellers fanges av en bredere regel
  ['hjem', 'interior', ['obs bygg', 'byggmax', 'maxbo', 'monter', 'jernia', 'montér']],
  ['kjoretoy', 'verksted', ['bil-service', 'bilservice', 'bilxtra', 'mekonomen', 'vianor', 'dekkmann', 'dekk team', 'naf ', 'biltema', 'autose', 'autosenter', 'bilverksted', 'bilpleie']],

  // --- dagligvarer
  ['dagligvarer', 'matbutikk', ['rema', 'meny', 'kiwi', 'extra', 'coop', 'obs', 'joker', 'bunnpris', 'spar ', 'matkroken', 'maximat', 'oda.', 'holdbart', 'europris', 'nille', 'normal', 'asian market', 'market st']],
  ['dagligvarer', 'vinmonopol', ['vinmonopol']],
  ['dagligvarer', 'kiosk', ['narvesen', '7-eleven', 'seven eleven', 'deli de luca', 'mix ', 'gottebiten', 'godteri']],

  // --- restaurant
  ['restaurant', 'takeaway', ['foodora', 'wolt', 'just eat', 'pizza', 'kebab', 'sushi', 'taco']],
  ['restaurant', 'kafe', ['starbucks', 'espresso', 'kaffe', 'cafe', 'café', 'bakeri', 'baker ', 'godt brød', 'jordbærpikene']],
  ['restaurant', 'restaurant', ['subway', 'burger', 'mcdonald', 'mcd', 'ssn ', 'peppes', 'egon', 'restauran', 'gatekjøkken', 'alimento', 'steakh', 'big horn', 'tangs', 'sushi', 'wok ', 'thai ', 'bistro', 'brasseri', 'pub ']],

  // --- transport
  ['kjoretoy', 'parkering', ['easypark', 'apcoa', 'onepark', 'parkering', 'p-hus']],
  ['kjoretoy', 'drivstoff', ['st1', 'circle k', 'shell', 'esso', 'uno-x', 'unox', ' yx ', '1-2-3', 'best stasjon', 'bensin', 'drivstoff', 'recharge', 'mer lading']],
  ['kjoretoy', 'bom', ['autopass', 'ferde', 'fjellinjen', 'bompenge', 'fjord1', 'torghatten']],
  ['kjoretoy', 'kollektiv', ['vipps:vkt', 'vkt ', 'ruter', 'vy ', 'vipps:vy', 'entur', 'kolumbus', 'skyss', 'atb ', 'flytoget', 'taxi']],

  // --- helse
  ['helse', 'apotek', ['apotek', 'boots', 'farmasi']],
  ['helse', 'behandling', ['legevakt', 'lege', 'tannlege', 'volvat', 'medisins', 'fysio', 'kiropraktor', 'aleris']],
  ['helse', 'trening', ['sats', 'evo ', 'fresh fitness', 'family sports', 'spenst', 'treningssenter']],
  ['helse', 'optiker', ['optiker', 'specsavers', 'brilleland', 'synsam', 'krogh optikk']],

  // --- fritid og abonnement
  ['fritid', 'stromming', ['netflix', 'spotify', 'hbo', 'max.com', 'disney', 'viaplay', 'youtube', 'tidal', 'skyshowtime']],
  ['fritid', 'programvare', ['apple.com/bill', 'itunes', 'midjourney', 'openai', 'anthropic', 'adobe', 'google one', 'dropbox', 'microsoft', 'notion', 'figma', 'github', 'vercel', 'canva', 'higgsfield', 'claude', 'cursor']],
  ['fritid', 'spill', ['steam', 'playstation', 'nintendo', 'epic games', 'xbox', 'discord', 'twitch']],
  ['fritid', 'reise', ['hotell', 'hotel', 'airbnb', 'sas ', 'norwegian', 'widerøe', 'wideroe', 'vio.com', 'booking.com', 'expedia', 'color line', 'fjordline']],
  ['fritid', 'opplevelser', ['kino', 'teater', 'konsert', 'museum', 'badeland', 'bowling', 'klatring', 'billett', 'ticketmaster', 'tusenfryd', 'the well', 'norsk tipping', 'spa ']],
  ['fritid', 'bocker', ['ark ', 'norli', 'platekompaniet', 'outland', 'lego']],

  // --- hjem og regninger
  ['hjem', 'strom', ['fjordkraft', 'tibber', 'fortum', 'hafslund', 'strøm', 'elvia', 'lede as']],
  ['hjem', 'mobil', ['telia', 'telenor', 'family nett', 'altibox', 'ice net', 'ice norge', 'talkmore', 'onecall', 'chilimobil']],
  ['hjem', 'forsikring', ['forsikring', 'gjensidige', 'fremtind', 'tryg', 'if skade', 'frende', 'storebrand']],
  ['hjem', 'elektronikk', ['elkjøp', 'elkjop', 'power', 'komplett', 'dustin', 'multicom', 'proshop']],
  ['hjem', 'interior', ['ikea', 'jula', 'clas ohl', 'kid interiør', 'kid ', 'princess', 'rusta', 'søstrene', 'skeidar', 'bohus', 'jysk']],
  ['hjem', 'hage', ['plantasjen', 'hageland', 'felleskjøpet', 'gartneri']],

  // --- klær og sko
  ['klaer', 'sko', ['eurosko', 'skoringen', 'shoe ', 'din sko', 'nike', 'adidas', 'zalando']],
  ['klaer', 'sport', ['xxl', 'intersport', 'sport 1', 'sport1', 'g-max', 'gmax', 'anton sport']],
  ['klaer', 'klaer', ['h&m', 'hm.com', 'zara', 'cubus', 'dressmann', 'bik bok', 'lindex', 'vero moda', 'kappahl', 'boozt', 'volt ', 'carlings', 'jack & jones', 'gina tricot', 'match ', 'name it']],

  // --- frisør og velvære
  ['skjonnhet', 'frisor', ['nikita hair', 'nikita ', 'cutters', 'adam og eva', 'frisør', 'hair ', 'barber']],
  ['skjonnhet', 'kosmetikk', ['vita ', 'kicks', 'parfym', 'fredrik & louisa', 'lyko', 'blush ']],

  // --- gaver
  ['gaver', 'gave', ['bjørklund', 'thune', 'gullsmed', 'david-andersen', 'pandora']],
  ['gaver', 'blomster', ['blomster', 'interflora', 'mester grønn']],

  // --- øvrig (kjente, men uten butikk vi kan plassere)
  ['ovrig', 'gebyr', ['prislagte tjenester', 'visa-kostnad', 'gebyr', 'renter', 'purregebyr']],
  ['ovrig', 'betaling', ['vipps:klarna', 'klarna', 'paypal', 'vipps:']],
]

/* guessCategory(merchant) → { category, sub }
   `sub` er null når vi bare klarer å slå fast toppkategorien. */
export function guessCategory(merchant) {
  const m = ` ${merchant.toLowerCase()} `
  for (const [cat, sub, words] of RULES) {
    for (const w of words) if (m.includes(w)) return { category: cat, sub }
  }
  return { category: 'ovrig', sub: 'ukjent' }
}

/* ---------- Dedup-nøkkel ---------- */

// Stabil på tvers av eksporter: dato + beløp + renset butikknavn.
// To identiske kjøp samme dag er lovlig — dedup teller derfor forekomster
// (multiset), ikke bare «finnes/finnes ikke».
export function importKey(date, amount, merchant) {
  return `${date}|${amount}|${merchant.toLowerCase()}`
}

/* ---------- Planen UI-et viser ---------- */

/* buildImportPlan(csvText, { existingKeys, overrides })
   → { ok, groups, skipped, from, to, count, total }
   - groups: én per butikk, sortert på sum — [{ merchant, category, sub, count,
     total, rows: [{date, amount, merchant, key}] }]
   - existingKeys: Map<key, antall> fra allerede lagrede expenses (dedup)
   - overrides: { butikknavn-lowercase → {category, sub} } — brukerens tidligere
     valg (godtar også gammel form der verdien bare er kategori-strengen)
   - skipped: { reserved, transfers, incoming, duplicates } (antall) */
export function buildImportPlan(csvText, { existingKeys, existingInflowKeys, overrides } = {}) {
  const parsed = parseBankCSV(csvText)
  if (!parsed.ok) return parsed

  const seen = new Map(existingKeys || [])
  const inflowSeen = new Map(existingInflowKeys || [])
  const inflows = []
  /* Utgående overføringer til egne kontoer er ikke forbruk — men de forlater
     KONTOEN. Med flere kontoer må de derfor lagres, ellers ville saldoen på
     avsenderkontoen aldri gått ned mens mottakerkontoens gikk opp, og totalen
     hadde vokst for hver overføring. De lagres som utgifter med transfer:true
     og holdes utenfor alle forbrukssummer. */
  const transfersOut = []
  const skipped = { reserved: 0, transfers: 0, incoming: 0, duplicates: 0 }
  const byMerchant = new Map()
  let from = null
  let to = null

  for (const tx of parsed.transactions) {
    if (tx.amountOut == null || tx.amountOut <= 0) {
      // Innbetaling: samles opp for saldo/inntekt i stedet for bare a telles bort.
      if (tx.amountIn > 0 && !tx.reserved) {
        const merchant = cleanMerchant(tx.text)
        const key = importKey(tx.date, tx.amountIn, merchant)
        const have = inflowSeen.get(key) || 0
        if (have > 0) inflowSeen.set(key, have - 1)
        else inflows.push({ date: tx.date, amount: tx.amountIn, merchant, kind: classifyInflow(tx.text), key })
      }
      skipped.incoming++
      continue
    }
    if (tx.reserved) { skipped.reserved++; continue } // kommer tilbake som bokført i neste eksport
    if (isTransfer(tx.text)) {
      const merchant = cleanMerchant(tx.text)
      const key = importKey(tx.date, tx.amountOut, merchant)
      const have = seen.get(key) || 0
      if (have > 0) seen.set(key, have - 1)
      else transfersOut.push({ date: tx.date, amount: tx.amountOut, merchant, key })
      skipped.transfers++
      continue
    }

    const merchant = cleanMerchant(tx.text)
    const key = importKey(tx.date, tx.amountOut, merchant)
    const have = seen.get(key) || 0
    if (have > 0) { seen.set(key, have - 1); skipped.duplicates++; continue }

    if (!from || tx.date < from) from = tx.date
    if (!to || tx.date > to) to = tx.date

    const gk = merchant.toLowerCase()
    if (!byMerchant.has(gk)) {
      const guess = guessCategory(merchant)
      // Huskede valg fra forrige import vinner. Eldre lagrede valg er en ren
      // streng (bare kategori) — støtt begge formene.
      const saved = overrides && overrides[gk]
      const savedCat = typeof saved === 'string' ? saved : saved?.category
      const savedSub = typeof saved === 'string' ? null : saved?.sub
      byMerchant.set(gk, {
        merchant,
        category: savedCat || guess.category,
        sub: savedCat ? savedSub ?? null : guess.sub,
        count: 0,
        total: 0,
        rows: [],
      })
    }
    const g = byMerchant.get(gk)
    g.count++
    g.total += tx.amountOut
    g.rows.push({ date: tx.date, amount: tx.amountOut, merchant, key })
  }

  const groups = [...byMerchant.values()].sort((a, b) => b.total - a.total)
  const count = groups.reduce((s, g) => s + g.count, 0)
  const total = groups.reduce((s, g) => s + g.total, 0)

  // Innbetalinger oppsummert per type, sa UI-et kan si «X inn, herav Y overfort».
  const inflowByKind = { inntekt: 0, refusjon: 0, overforing: 0 }
  for (const i of inflows) inflowByKind[i.kind] = (inflowByKind[i.kind] || 0) + i.amount
  const inflowTotal = inflows.reduce((s, i) => s + i.amount, 0)

  const transferOutTotal = transfersOut.reduce((s, r) => s + r.amount, 0)

  return {
    ok: true, groups, skipped, from, to, count, total,
    inflows, inflowTotal, inflowByKind,
    transfersOut, transferOutTotal,
  }
}

/* ---------- Innbetalinger ---------- */

/* classifyInflow(merchant, text) -> 'overforing' | 'refusjon' | 'inntekt'

   VIKTIG skille, og grunnen til at innbetalinger ikke bare kan summeres som
   «inntekt»: i brukerens egen kontoutskrift var 290 423 av 303 033 kr inn rene
   OVERFØRINGER fra egne kontoer. De øker saldoen på denne kontoen, men er ikke
   penger tjent. Bare 12 611 kr var faktiske innbetalinger.

   - overforing: flyttede penger (overføring/kontoregulering) - teller for SALDO,
     ikke for inntekt.
   - refusjon: penger tilbake fra en butikk vi kjenner igjen (Telia, Apple) -
     altså et kjøp som ble reversert, ikke inntekt.
   - inntekt: alt annet (lønn, betaling fra andre). */
export function classifyInflow(text) {
  if (isTransfer(text)) return 'overforing'
  const merchant = cleanMerchant(text)
  // Treffer den en ekte butikk-regel (ikke sekkeposten «ovrig»), er det penger
  // tilbake fra et kjøp - ikke inntekt.
  const guess = guessCategory(merchant)
  if (guess.category !== 'ovrig') return 'refusjon'
  return 'inntekt'
}
