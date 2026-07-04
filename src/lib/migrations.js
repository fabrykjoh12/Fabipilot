// Rene migrerings-/mapping-hjelpere — ingen Dexie-avhengighet, lett å enhetsteste.
// Selve tx-siden (db.version(10).upgrade, importAll) kaller disse.

/** Mapper en gammel «Liste»-todo (v9 og eldre) til formen på en samlet oppgave (v10+).
 *  Rent datauttrekk — id/sortOrder/createdAt avgjøres av kalleren (migrering vs. import). */
export function legacyTodoToTask(t) {
  return {
    title: (t.text || '').trim(),
    isDone: !!t.isDone,
    isFocus: false,
    dueDate: t.dueDate || null,
    completedAt: t.completedAt || null,
    estimate: null,
    repeat: 'none',
    subtasks: Array.isArray(t.subtasks) ? t.subtasks : [],
  }
}

/** v11: Penger-kategoriene ble erstattet med kategoriene fra brukerens bank-app
 *  (Dagligvarer, Restaurant og uteliv, Kjøretøy, Fritid, Helse og velvære, Hjem og hage,
 *  Øvrig forbruk). Mapper gamle kategori-nøkler (expenses/budgets/subscriptions) til nye
 *  der det finnes et rimelig treff; ukjente/uspesifikke gamle nøkler (klær, strømming,
 *  musikk, software, annet) havner i «øvrig». `helse` er uendret (samme betydning). */
export const MONEY_CATEGORY_MIGRATION = {
  mat: 'dagligvarer',
  transport: 'kjoretoy',
  bolig: 'hjem',
  klar: 'ovrig',
  moro: 'fritid',
  strømming: 'fritid',
  musikk: 'fritid',
  software: 'ovrig',
  annet: 'ovrig',
}
export const legacyMoneyCategory = (cat) => MONEY_CATEGORY_MIGRATION[cat] || cat
