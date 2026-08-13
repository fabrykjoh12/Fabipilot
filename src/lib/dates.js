// Rene datohjelpere — ingen app-avhengigheter, lett å enhetsteste.

/** Lokal datonøkkel YYYY-MM-DD (ikke UTC). */
export function todayKey(d = new Date()) {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Datonøkkel for i morgen (relativt til nå). */
export function tomorrowKey() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return todayKey(d)
}

/** Neste forekomst-dato for en gjentakelse ('daily'|'weekly'|'monthly'). Ukjent repeat → uendret nøkkel. */
export function nextDate(key, repeat) {
  const [y, m, d] = key.split('-').map(Number)
  if (repeat === 'daily') return todayKey(new Date(y, m - 1, d + 1))
  if (repeat === 'weekly') return todayKey(new Date(y, m - 1, d + 7))
  if (repeat === 'monthly') {
    /* Dagen må klemmes til siste dag i målmåneden. `new Date(2026, 1, 31)` er
       ikke 31. februar — JS ruller videre til 3. mars, så en månedlig gjentakelse
       den 31. hoppet over februar HELT og forskjøv seg til den 3. Husleie den
       31. ville forsvunnet en måned i året. */
    const lastDay = new Date(y, m + 1, 0).getDate() // dag 0 i neste måned = siste i denne
    return todayKey(new Date(y, m, Math.min(d, lastDay)))
  }
  return key
}
