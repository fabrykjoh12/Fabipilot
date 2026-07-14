// Rene penge-hjelpere — ingen React/Dexie. Utleder «Trygt å bruke», kommende
// trekk og måneds-prognose fra data brukeren allerede legger inn (inntekt,
// faste trekk, budsjett, forbruk). `today` injiseres for testbarhet.
// Testet i money.test.js.

const DAY = 86400000

/** Antall dager i måneden for datoen. */
export function daysInMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/** Dager igjen i måneden inkl. i dag (aldri < 1). */
export function daysLeftInMonth(date) {
  return Math.max(1, daysInMonth(date) - date.getDate() + 1)
}

/** Dager igjen av uka t.o.m. søndag, inkl. i dag (man=7 … søn=1). */
export function daysLeftInWeek(date) {
  const isoMon0 = (date.getDay() + 6) % 7 // man=0 … søn=6
  return 7 - isoMon0
}

/** Dager til en trekk-dag (1–31) fra i dag. 0 = i dag. Ruller til neste måned om passert. */
export function daysUntilRenew(renewDay, today = new Date()) {
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  let target = new Date(today.getFullYear(), today.getMonth(), renewDay)
  if (target < t0) target = new Date(today.getFullYear(), today.getMonth() + 1, renewDay)
  return Math.round((target - t0) / DAY)
}

/** Kommende faste trekk (kun månedlige med trekk-dag), nærmest først. */
export function upcomingCharges(subs = [], today = new Date(), limit = 6) {
  return subs
    .filter((s) => s.renewDay && (s.cycle || 'monthly') !== 'yearly')
    .map((s) => ({ id: s.id, name: s.name, amount: s.amount || 0, day: s.renewDay, days: daysUntilRenew(s.renewDay, today) }))
    .sort((a, b) => a.days - b.days)
    .slice(0, limit)
}

/** Sum av månedlige faste trekk som fortsatt gjenstår denne måneden (trekk-dag ≥ i dag). */
export function remainingChargesThisMonth(subs = [], today = new Date()) {
  const dom = today.getDate()
  return subs
    .filter((s) => (s.cycle || 'monthly') !== 'yearly' && s.renewDay && s.renewDay >= dom)
    .reduce((sum, s) => sum + (s.amount || 0), 0)
}

/** Anbefalt månedlig avsetning til årlige regninger (årlige trekk / 12). */
export function yearlyReserve(subs = []) {
  return subs
    .filter((s) => s.cycle === 'yearly')
    .reduce((sum, s) => sum + (s.amount || 0) / 12, 0)
}

/**
 * «Trygt å bruke» — hvor mye du kan bruke i dag / resten av uka / resten av
 * måneden uten å sprenge grunnlaget. Grunnlag = inntekt hvis satt, ellers budsjett.
 * Faste månedlige trekk regnes som forpliktet (trukket fra i sin helhet).
 */
export function safeToSpend({ income = 0, subsMonthly = 0, spentVariable = 0, budgetTotal = 0 } = {}, today = new Date()) {
  const basis = income > 0 ? income : budgetTotal
  if (basis <= 0) return { available: false }
  const leftMonth = basis - subsMonthly - spentVariable
  const dLeftMonth = daysLeftInMonth(today)
  const perDay = leftMonth / dLeftMonth
  const dLeftWeek = Math.min(dLeftMonth, daysLeftInWeek(today))
  const over = leftMonth < 0
  return {
    available: true,
    basis: income > 0 ? 'income' : 'budget',
    today: over ? 0 : Math.floor(perDay),
    week: over ? 0 : Math.round(perDay * dLeftWeek),
    month: Math.round(leftMonth),
    over,
    daysLeft: dLeftMonth,
  }
}

/** Prognose: hva forbruket ender på ved månedsslutt om nåværende tempo holder. */
export function projectMonthEnd({ spentVariable = 0, subsMonthly = 0 } = {}, today = new Date()) {
  const dom = today.getDate()
  const dim = daysInMonth(today)
  const projectedVariable = dom > 0 ? (spentVariable / dom) * dim : 0
  return Math.round(projectedVariable + subsMonthly)
}
