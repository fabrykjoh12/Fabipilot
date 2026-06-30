// Naturlig-språk-tolk for hurtiglagring (norsk).
// parseEntry("ring tannlegen fredag kl 14") →
//   { title: 'ring tannlegen', type: 'task', dueDate: '2026-07-03', time: '14:00' }
//
// Ren funksjon, ingen app-avhengigheter — lett å enhetsteste.

const pad = (n) => String(n).padStart(2, '0')
const toKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// søndag=0 … lørdag=6 (matcher Date.getDay)
const WEEKDAYS = {
  søndag: 0, son: 0, søn: 0,
  mandag: 1, man: 1, måndag: 1,
  tirsdag: 2, tir: 2, tis: 2,
  onsdag: 3, ons: 3,
  torsdag: 4, tor: 4, tors: 4,
  fredag: 5, fre: 5,
  lørdag: 6, lor: 6, lør: 6,
}
const MONTHS = {
  jan: 1, januar: 1, feb: 2, februar: 2, mar: 3, mars: 3, apr: 4, april: 4,
  mai: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9, okt: 10, oktober: 10,
  nov: 11, november: 11, des: 12, desember: 12,
}

function cleanTitle(s) {
  return s
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    // fjern løse småord som ble igjen i kantene
    .replace(/\b(på|den|kl|klokka|om|nå|til)\s*$/i, '')
    .replace(/^\s*(på|den|kl|klokka|om|til)\b/i, '')
    .trim()
    .replace(/\s{2,}/g, ' ')
}

export function parseEntry(text, now = new Date()) {
  let work = ` ${text} `
  let type = 'task'
  let dueDate = null
  let time = ''

  const cut = (re) => {
    const m = work.match(re)
    if (m) work = work.slice(0, m.index) + ' ' + work.slice(m.index + m[0].length)
    return m
  }

  // ---- Type-hint (prefiks, krever skilletegn for å unngå falske treff) ----
  let m = work.match(/^\s*(idé|ide|idee)\s*[:\-–]\s*/i)
  if (m) { type = 'idea'; work = work.slice(m[0].length) }
  else if ((m = work.match(/^\s*(liste|todo|gjøremål)\s*[:\-–]\s*/i))) { type = 'todo'; work = work.slice(m[0].length) }
  else if ((m = work.match(/^\s*(avtale|hendelse|møte)\s*[:\-–]\s*/i))) { type = 'event'; work = work.slice(m[0].length) }
  work = ` ${work} `

  // ---- Tid ----
  let t = cut(/\bkl(?:okka)?\.?\s*(\d{1,2})[:.](\d{2})\b/i) // kl 14:30 / kl 14.30
  if (!t) t = cut(/\bkl(?:okka)?\.?\s*(\d{1,2})(\d{2})\b/i) // kl 1430
  if (!t) {
    const mh = cut(/\bkl(?:okka)?\.?\s*(\d{1,2})\b/i) // kl 14
    if (mh) t = [mh[0], mh[1], null]
  }
  if (!t) t = cut(/\b(\d{1,2}):(\d{2})\b/)
  if (t) {
    const h = Math.min(23, parseInt(t[1], 10))
    const mi = t[2] ? Math.min(59, parseInt(t[2], 10)) : 0
    time = `${pad(h)}:${pad(mi)}`
  }

  // ---- Relative dager ----
  if (cut(/\bi\s*overmorgen\b/i) || cut(/\bovermorgen\b/i)) dueDate = toKey(addDays(now, 2))
  else if (cut(/\bi\s*morgen\b/i) || cut(/\bimorgen\b/i)) dueDate = toKey(addDays(now, 1))
  else if (cut(/\bi\s*dag\b/i) || cut(/\bidag\b/i) || cut(/\bi\s*kveld\b/i) || cut(/\bikveld\b/i)) dueDate = toKey(now)

  if (dueDate === null) {
    let r = cut(/\bom\s+(\d{1,2})\s*dager?\b/i)
    if (r) dueDate = toKey(addDays(now, parseInt(r[1], 10)))
    else if ((r = cut(/\bom\s+(\d{1,2})\s*uker?\b/i))) dueDate = toKey(addDays(now, 7 * parseInt(r[1], 10)))
    else if (cut(/\bneste\s+uke\b/i)) dueDate = toKey(addDays(now, 7))
  }

  // ---- Ukedag (evt. "neste") ----
  if (dueDate === null) {
    const names = Object.keys(WEEKDAYS).sort((a, b) => b.length - a.length).join('|')
    const wd = cut(new RegExp(`\\b(neste\\s+)?(på\\s+)?(${names})\\b`, 'i'))
    if (wd) {
      const target = WEEKDAYS[wd[3].toLowerCase()]
      const cur = now.getDay()
      let ahead = (target - cur + 7) % 7
      if (wd[1]) ahead += 7 // "neste"
      dueDate = toKey(addDays(now, ahead))
    }
  }

  // ---- Dato med månedsnavn: "15. juni", "3 jul" ----
  if (dueDate === null) {
    const mn = Object.keys(MONTHS).sort((a, b) => b.length - a.length).join('|')
    const dm = cut(new RegExp(`\\b(\\d{1,2})\\.?\\s*(${mn})\\b`, 'i'))
    if (dm) {
      const day = parseInt(dm[1], 10)
      const month = MONTHS[dm[2].toLowerCase()]
      dueDate = resolveMonthDay(now, day, month)
    }
  }

  // ---- Dato DD.MM ----
  if (dueDate === null) {
    const dm = cut(/\b(\d{1,2})\.(\d{1,2})\.?\b/)
    if (dm) {
      const day = parseInt(dm[1], 10)
      const month = parseInt(dm[2], 10)
      if (day >= 1 && day <= 31 && month >= 1 && month <= 12) dueDate = resolveMonthDay(now, day, month)
    }
  }

  // Tid uten dato → anta i dag
  if (time && dueDate === null) dueDate = toKey(now)
  // Klokkeslett gjør det til en hendelse hvis brukeren ikke ba om noe annet
  if (time && type === 'task') type = 'event'

  const title = cleanTitle(work)
  return { title, type, dueDate, time }
}

function resolveMonthDay(now, day, month) {
  const pad2 = (n) => String(n).padStart(2, '0')
  let year = now.getFullYear()
  const candidate = `${year}-${pad2(month)}-${pad2(day)}`
  const todayKey = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
  if (candidate < todayKey) year += 1 // dato har passert i år → neste år
  return `${year}-${pad2(month)}-${pad2(day)}`
}
