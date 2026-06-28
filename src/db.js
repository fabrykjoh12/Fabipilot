import Dexie from 'dexie'

// Lokal-først: all data ligger på enheten i IndexedDB. Ingen backend.
export const db = new Dexie('dashboard')

// Én store per modul. Idébanken er den første.
// Primærnøkkel: id (uuid). Indekser: category, createdAt.
db.version(1).stores({
  ideas: 'id, category, createdAt',
})

/** Hent alle ideer, nyeste først. */
export async function listIdeas() {
  return db.ideas.orderBy('createdAt').reverse().toArray()
}

/** Legg til en ny idé. Returnerer den lagrede ideen. */
export async function addIdea(text) {
  const idea = {
    id: crypto.randomUUID(),
    text: text.trim(),
    category: 'ny',
    isFavorite: false,
    note: '',
    createdAt: Date.now(),
  }
  await db.ideas.add(idea)
  return idea
}

/** Oppdater felter på en idé (tekst, notat, kategori, favoritt). */
export async function updateIdea(id, patch) {
  await db.ideas.update(id, patch)
}

/** Sett kategori. */
export async function setCategory(id, category) {
  await db.ideas.update(id, { category })
}

/** Toggle favoritt og returner ny verdi. */
export async function toggleFavorite(id, current) {
  await db.ideas.update(id, { isFavorite: !current })
  return !current
}

/** Slett en idé. */
export async function deleteIdea(id) {
  await db.ideas.delete(id)
}

/** Eksporter alle ideer som et JSON-objekt (for backup). */
export async function exportAll() {
  const ideas = await listIdeas()
  return {
    type: 'dashboard-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    ideas,
  }
}

/**
 * Importer ideer fra et tidligere eksportert objekt.
 * Slår sammen på id — eksisterende ideer hoppes over (ingen duplikater).
 * Returnerer antall nye ideer som ble lagt inn.
 */
export async function importAll(data) {
  const incoming = Array.isArray(data) ? data : data?.ideas
  if (!Array.isArray(incoming)) {
    throw new Error('Ugyldig backup-fil: fant ingen ideer.')
  }

  const existing = new Set(await db.ideas.toCollection().primaryKeys())
  const toAdd = incoming
    .filter((i) => i && typeof i.text === 'string')
    .map((i) => ({
      id: typeof i.id === 'string' && i.id ? i.id : crypto.randomUUID(),
      text: i.text,
      category: typeof i.category === 'string' ? i.category : 'ny',
      isFavorite: Boolean(i.isFavorite),
      note: typeof i.note === 'string' ? i.note : '',
      createdAt: Number.isFinite(i.createdAt) ? i.createdAt : Date.now(),
    }))
    .filter((i) => !existing.has(i.id))

  if (toAdd.length) await db.ideas.bulkAdd(toAdd)
  return toAdd.length
}
