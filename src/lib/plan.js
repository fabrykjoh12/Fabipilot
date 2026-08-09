/* Sparemodus / reiseplan — «pengene skal vare til dato X uten lønn».

   Vanlig månedsbudsjett svarer på «hvor mye kan jeg bruke denne måneden?» og
   forutsetter at det kommer lønn neste måned. Skal du til Japan i 5 måneder
   uten inntekt, er spørsmålet et annet: «hvor lenge varer det jeg har, og hvor
   mye er det per dag?» Det er det denne fila regner ut.

   Alt er rene funksjoner over data som allerede finnes (expenses + det
   brukeren skriver inn) — ingenting utledet lagres. */

const DAY = 86400000
const AVG_MONTH = 30.4375 // dager, gjennomsnittlig kalendermåned

/** "2026-08-09" → Date (kl. 12 lokalt, så sommertid ikke flytter døgnet). */
export function parseDay(iso) {
  if (!iso || typeof iso !== 'string') return null
  const d = new Date(iso + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

/** Antall døgn fra og med `from` til og med `to`. Null hvis datoene er ugyldige. */
export function daysBetween(from, to) {
  const a = parseDay(from)
  const b = parseDay(to)
  if (!a || !b) return null
  return Math.round((b - a) / DAY) + 1
}

/* ---------- historikk → forventet forbruk ---------- */

/* Snitt-forbruk per måned ut fra faktiske utgifter.
   Teller BARE måneder som har data (ellers drar tomme måneder snittet ned og
   du undervurderer hva turen koster). `monthsBack` regnes bakover fra `endYM`
   (default: siste måned med data). */
export function monthlyAverages(expenses, { monthsBack = 6, endYM } = {}) {
  const rows = (expenses || []).filter((e) => e && e.date && Number(e.amount) > 0)
  if (!rows.length) return { total: 0, perMonth: 0, byCategory: {}, monthsCounted: 0, months: [] }

  const allYM = [...new Set(rows.map((e) => e.date.slice(0, 7)))].sort()
  const end = endYM || allYM[allYM.length - 1]
  const [ey, em] = end.split('-').map(Number)

  // de N månedsnøklene som ligger i vinduet
  const window = []
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(ey, em - 1 - i, 1)
    window.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }

  const byMonth = {}
  const byCategory = {}
  let total = 0
  for (const e of rows) {
    const ym = e.date.slice(0, 7)
    if (!window.includes(ym)) continue
    const amt = Number(e.amount)
    byMonth[ym] = (byMonth[ym] || 0) + amt
    byCategory[e.category || 'ovrig'] = (byCategory[e.category || 'ovrig'] || 0) + amt
    total += amt
  }

  const monthsCounted = Object.keys(byMonth).length
  const perMonth = monthsCounted ? total / monthsCounted : 0
  for (const k of Object.keys(byCategory)) {
    byCategory[k] = monthsCounted ? byCategory[k] / monthsCounted : 0
  }
  return {
    total,
    perMonth,
    byCategory,
    monthsCounted,
    months: Object.entries(byMonth).map(([ym, sum]) => ({ ym, sum })).sort((a, b) => a.ym.localeCompare(b.ym)),
  }
}

/* ---------- runway: hvor lenge varer pengene? ---------- */

/* Med et startbeløp og et månedsforbruk: hvor mange måneder/dager holder det?
   `monthlyIncome` >= `monthlyBurn` → pengene tar aldri slutt (endless). */
export function runway({ startAmount = 0, monthlyBurn = 0, monthlyIncome = 0 } = {}) {
  const net = monthlyBurn - monthlyIncome
  if (net <= 0) return { endless: true, months: Infinity, days: Infinity }
  const months = startAmount / net
  return { endless: false, months, days: Math.floor(months * AVG_MONTH) }
}

/* ---------- planen ---------- */

/* dailyAllowance(plan) — hvor mye per dag for at pengene skal vare HELE perioden.

   plan: { startAmount, startDate, endDate, income = 0, fixedMonthly = 0 }
   - income: samlet inntekt i HELE perioden (0 for «uten lønn»)
   - fixedMonthly: faste utgifter som løper videre mens du er borte (abonnement,
     forsikring, mobil) — trekkes fra for å vise hva som er FRITT å bruke.

   Returnerer null-trygt: mangler datoene, får du { ok: false }. */
export function dailyAllowance(plan) {
  const days = daysBetween(plan?.startDate, plan?.endDate)
  if (!days || days < 1) return { ok: false }

  const startAmount = Number(plan.startAmount) || 0
  const income = Number(plan.income) || 0
  const fixedMonthly = Number(plan.fixedMonthly) || 0

  const available = startAmount + income
  const fixedTotal = (fixedMonthly * days) / AVG_MONTH
  const free = available - fixedTotal

  return {
    ok: true,
    days,
    months: days / AVG_MONTH,
    available,
    fixedTotal,
    free,
    perDay: available / days, // alt inkludert
    freePerDay: free / days, // etter faste utgifter — det du faktisk kan bruke
    freePerWeek: (free / days) * 7,
    freePerMonth: (free / days) * AVG_MONTH,
    short: free < 0, // faste utgifter alene spiser opp mer enn du har
  }
}

/* planProgress(plan, expenses, todayIso) — ligger du foran eller bak?

   Sammenligner FAKTISK forbruk i perioden mot en jevn linje (perDay × dager
   gått). Bruker `available` (ikke `free`), fordi importerte utgifter fra banken
   allerede inneholder de faste trekkene — ellers ville de blitt talt to ganger. */
export function planProgress(plan, expenses, todayIso) {
  const base = dailyAllowance(plan)
  if (!base.ok) return { ok: false }

  const start = parseDay(plan.startDate)
  const end = parseDay(plan.endDate)
  const today = parseDay(todayIso) || new Date()

  const beforeStart = today < start
  const finished = today > end
  // dag 1 = startdagen; klemmes inn i perioden
  const dayNo = beforeStart ? 0 : Math.min(base.days, Math.round((today - start) / DAY) + 1)
  const daysLeft = Math.max(0, base.days - dayNo)

  const cutoff = finished ? plan.endDate : todayIso
  const spent = (expenses || [])
    .filter((e) => e && e.date && e.date >= plan.startDate && e.date <= cutoff && Number(e.amount) > 0)
    .reduce((s, e) => s + Number(e.amount), 0)

  const shouldHaveSpent = base.perDay * dayNo
  const diff = shouldHaveSpent - spent // + = du ligger under budsjett (bra)
  const left = base.available - spent
  // Hva kan du bruke per dag RESTEN av perioden, gitt det du faktisk har brukt?
  const perDayLeft = daysLeft > 0 ? left / daysLeft : 0
  // Holder tempoet ut perioden?
  const pace = dayNo > 0 ? spent / dayNo : 0
  const projectedEnd = base.available - pace * base.days

  return {
    ok: true,
    ...base,
    beforeStart,
    finished,
    dayNo,
    daysLeft,
    spent,
    left,
    shouldHaveSpent,
    diff,
    onTrack: diff >= 0,
    perDayLeft,
    pace,
    projectedEnd,
    // hvor langt ut i perioden pengene rekker med dagens tempo
    runsOutOnDay: pace > 0 ? Math.floor(base.available / pace) : null,
    pct: base.days ? Math.min(100, Math.round((dayNo / base.days) * 100)) : 0,
  }
}

/* Forslag til månedsbudsjett per kategori, basert på faktisk historikk.
   Rundes til nærmeste 100 kr — et budsjett på 3 247 kr er falsk presisjon. */
export function suggestBudgets(expenses, { monthsBack = 6, endYM } = {}) {
  const avg = monthlyAverages(expenses, { monthsBack, endYM })
  const out = {}
  for (const [k, v] of Object.entries(avg.byCategory)) {
    const rounded = Math.round(v / 100) * 100
    if (rounded > 0) out[k] = rounded
  }
  return { budgets: out, monthsCounted: avg.monthsCounted, perMonth: avg.perMonth }
}
