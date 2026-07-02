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
