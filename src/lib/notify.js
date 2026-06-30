// Påminnelser — progressiv forbedring.
// - Notification Triggers (Chrome/Android, installert PWA) kan fyre når appen er LUKKET.
// - iOS/Safari: ingen planlagte varsler i bakgrunnen → vi nuder i appen ved neste åpning
//   + app-ikon-badge. Web Push droppes med vilje (krever en server vi ikke har).
//
// Prefs lagres lokalt per enhet (planlegging må uansett skje per enhet).

const PREFS_KEY = 'reminderPrefs'
const TAG = 'daily-plan'

export const notifySupported = () =>
  typeof window !== 'undefined' && 'Notification' in window

export const triggersSupported = () =>
  notifySupported() && 'showTrigger' in Notification.prototype && 'TimestampTrigger' in window

export const permission = () => (notifySupported() ? Notification.permission : 'unsupported')

export async function requestPermission() {
  if (!notifySupported()) return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export function getReminderPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}')
    return { enabled: !!raw.enabled, time: typeof raw.time === 'string' ? raw.time : '08:30' }
  } catch {
    return { enabled: false, time: '08:30' }
  }
}

export function setReminderPrefs(prefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
}

/** Neste forekomst (epoch-ms) av HH:MM fra nå. */
function nextOccurrence(timeHHMM) {
  const [h, m] = timeHHMM.split(':').map(Number)
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h || 0, m || 0, 0, 0)
  if (next.getTime() <= now.getTime()) next.setDate(next.getDate() + 1)
  return next.getTime()
}

async function reg() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.ready
  } catch {
    return null
  }
}

/** Fyrer et varsel umiddelbart (for «test»-knappen). */
export async function fireTest() {
  if (permission() !== 'granted') return false
  const r = await reg()
  const opts = {
    body: 'Sånn ser en påminnelse ut. Trykk for å åpne dashbordet.',
    tag: 'test',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
  }
  if (r) await r.showNotification('Test ✓', opts)
  else new Notification('Test ✓', opts)
  return true
}

/**
 * Planlegger neste daglige «planlegg dagen»-varsel hvis enheten støtter triggere.
 * Kjøres ved hver app-åpning, så kjeden holdes ved like så lenge appen åpnes innimellom.
 * Returnerer { scheduled, supported }.
 */
export async function scheduleDailyReminder() {
  const prefs = getReminderPrefs()
  if (!prefs.enabled || permission() !== 'granted') return { scheduled: false, supported: triggersSupported() }
  if (!triggersSupported()) return { scheduled: false, supported: false }
  const r = await reg()
  if (!r) return { scheduled: false, supported: true }
  try {
    // Lukk evt. tidligere planlagte med samme tag før vi re-planlegger.
    const existing = await r.getNotifications({ tag: TAG, includeTriggered: false })
    existing.forEach((n) => n.close())
  } catch {
    /* getNotifications kan mangle includeTriggered — ignorer */
  }
  try {
    await r.showNotification('Planlegg dagen 🌱', {
      body: 'Velg inntil tre ting å fokusere på i dag. Det er nok.',
      tag: TAG,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      // eslint-disable-next-line no-undef
      showTrigger: new TimestampTrigger(nextOccurrence(prefs.time)),
      data: { url: '/' },
    })
    return { scheduled: true, supported: true }
  } catch {
    return { scheduled: false, supported: true }
  }
}

/** App-ikon-badge med et tall (eller fjern). Stille no-op der det ikke støttes. */
export function setBadge(count) {
  try {
    if ('setAppBadge' in navigator) {
      if (count > 0) navigator.setAppBadge(count)
      else navigator.clearAppBadge?.()
    }
  } catch {
    /* ignorer */
  }
}
