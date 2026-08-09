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

// Nøkkelord → kategori i CATEGORIES (Money.jsx). Sjekkes i rekkefølge —
// spesifikke før generelle («obs bygg» må treffe hjem før «obs» treffer
// dagligvarer). Små bokstaver; matches som substring i butikknavnet.
const RULES = [
  ['hjem', ['obs bygg', 'byggmax', 'maxbo', 'monter', 'jernia', 'ikea', 'jula', 'clas ohl', 'kid interiør', 'princess', 'power', 'elkjøp', 'komplett', 'rusta', 'søstrene', 'dustin', 'elkjop', 'telia', 'telenor', 'family nett', 'altibox', 'ice net', 'fjordkraft', 'tibber', 'fortum', 'hafslund', 'strøm', 'husleie', 'forsikring', 'gjensidige', 'fremtind', 'tryg']],
  ['dagligvarer', ['rema', 'meny', 'kiwi', 'extra', 'coop', 'obs', 'joker', 'bunnpris', 'spar ', 'matkroken', 'maximat', 'normal', 'europris', 'nille', 'oda.', 'holdbart']],
  ['restaurant', ['subway', 'burger', 'mcdonald', 'mcd', 'kebab', 'pizza', 'sushi', 'ssn ', 'peppes', 'egon', 'starbucks', 'espresso', 'kaffe', 'cafe', 'café', 'restaurant', 'foodora', 'wolt', 'just eat', 'taco', 'bakeri', 'jordbærpikene', 'gatekjøkken']],
  ['kjoretoy', ['easypark', 'apcoa', 'onepark', 'parkering', 'st1', 'circle k', 'shell', 'esso', 'uno-x', 'unox', 'yx ', '1-2-3', 'best stasjon', 'bensin', 'drivstoff', 'autopass', 'ferde', 'fjellinjen', 'bompenge', 'biltema', 'mekonomen', 'vianor', 'dekk', 'bilxtra', 'bil-service', 'bilservice', 'naf ']],
  ['helse', ['apotek', 'boots', 'legevakt', 'lege', 'tannlege', 'fysio', 'kiropraktor', 'volvat', 'medisins', 'sats', 'evo ', 'fresh fitness', 'family sports', 'optiker', 'specsavers', 'brilleland', 'synsam']],
  ['fritid', ['kino', 'netflix', 'spotify', 'hbo', 'disney', 'viaplay', 'apple.com/bill', 'itunes', 'midjourney', 'openai', 'anthropic', 'steam', 'playstation', 'nintendo', 'epic games', 'xbox', 'discord', 'twitch', 'google one', 'dropbox', 'billett', 'ticketmaster', 'hotell', 'hotel', 'airbnb', 'sas ', 'norwegian', 'widerøe', 'wideroe', 'vio.com', 'adobe', 'teater', 'konsert', 'museum', 'badeland', 'bowling', 'klatring', 'ark ', 'norli', 'platekompaniet', 'lego']],
]

export function guessCategory(merchant) {
  const m = ` ${merchant.toLowerCase()} `
  for (const [cat, words] of RULES) {
    for (const w of words) if (m.includes(w)) return cat
  }
  return 'ovrig'
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
   - groups: én per butikk, sortert på sum — [{ merchant, category, count,
     total, rows: [{date, amount, merchant, key}] }]
   - existingKeys: Map<key, antall> fra allerede lagrede expenses (dedup)
   - overrides: { butikknavn-lowercase → kategori } — brukerens tidligere valg
   - skipped: { reserved, transfers, incoming, duplicates } (antall) */
export function buildImportPlan(csvText, { existingKeys, overrides } = {}) {
  const parsed = parseBankCSV(csvText)
  if (!parsed.ok) return parsed

  const seen = new Map(existingKeys || [])
  const skipped = { reserved: 0, transfers: 0, incoming: 0, duplicates: 0 }
  const byMerchant = new Map()
  let from = null
  let to = null

  for (const tx of parsed.transactions) {
    if (tx.amountOut == null || tx.amountOut <= 0) { skipped.incoming++; continue }
    if (tx.reserved) { skipped.reserved++; continue } // kommer tilbake som bokført i neste eksport
    if (isTransfer(tx.text)) { skipped.transfers++; continue }

    const merchant = cleanMerchant(tx.text)
    const key = importKey(tx.date, tx.amountOut, merchant)
    const have = seen.get(key) || 0
    if (have > 0) { seen.set(key, have - 1); skipped.duplicates++; continue }

    if (!from || tx.date < from) from = tx.date
    if (!to || tx.date > to) to = tx.date

    const gk = merchant.toLowerCase()
    if (!byMerchant.has(gk)) {
      byMerchant.set(gk, {
        merchant,
        category: (overrides && overrides[gk]) || guessCategory(merchant),
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
  return { ok: true, groups, skipped, from, to, count, total }
}
