// Avledet prosjekt-helse — rene funksjoner, ingen React/Dexie.
// Gir ett rikere signal enn den lagrede statusen (active/onice/done):
// beveger prosjektet seg, står det stille, er det klart til lansering?
// Lagret status endres IKKE — dette er kun utledet for visning + prompts.

const DAY = 86400000

/* Prioritet → rekkefølge for «neste beste handling». */
const PRIO_RANK = { now: 0, next: 1, later: 2 }

/**
 * Regn ut helsen til ett prosjekt ut fra dets lagrede status, når det sist
 * ble rørt, og stegene (projectItems). `nowMs` injiseres for testbarhet.
 *
 * state:
 *  - 'shipped'   — status 'done'
 *  - 'onice'     — status 'onice'
 *  - 'empty'     — aktivt, men ingen steg enda
 *  - 'ready'     — aktivt, har steg, alle er ferdige (klart til å leveres)
 *  - 'stuck'     — aktivt, åpne steg, men ikke rørt på 10+ dager
 *  - 'building'  — aktivt og i bevegelse
 */
export function projectHealth(project, items = [], nowMs = Date.now()) {
  const open = items.filter((i) => i.stage !== 'done')
  const doneCount = items.length - open.length
  const staleDays = project?.lastTouched ? Math.floor((nowMs - project.lastTouched) / DAY) : null

  // Neste beste handling: høyeste prioritet blant åpne steg (now > next > later),
  // og innenfor samme prioritet det første etter sortOrder.
  const nextAction = [...open]
    .sort((a, b) => {
      const r = (PRIO_RANK[a.stage] ?? 3) - (PRIO_RANK[b.stage] ?? 3)
      return r !== 0 ? r : (a.sortOrder || 0) - (b.sortOrder || 0)
    })[0] || null

  let state
  if (project?.status === 'done') state = 'shipped'
  else if (project?.status === 'onice') state = 'onice'
  else if (items.length === 0) state = 'empty'
  else if (open.length === 0) state = 'ready'
  else if (staleDays !== null && staleDays >= 10) state = 'stuck'
  else state = 'building'

  const moving = staleDays !== null && staleDays <= 3

  return { state, moving, nextAction, openCount: open.length, doneCount, staleDays }
}

/* Norske etiketter for UI. */
export const HEALTH_LABEL = {
  building: 'Bygger',
  stuck: 'Står stille',
  ready: 'Klar til lansering',
  shipped: 'Levert',
  onice: 'På is',
  empty: 'Kom i gang',
}

/* Engelske etiketter til prompts (Claude jobber på engelsk). */
export const HEALTH_STATUS_EN = {
  building: 'Building',
  stuck: 'Stuck (no progress in 10+ days)',
  ready: 'Ready to ship',
  shipped: 'Shipped',
  onice: 'On ice',
  empty: 'Just started',
}
