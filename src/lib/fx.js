// Delte effekter og småhjelpere brukt på tvers av modulene.

export const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function vibrate(pattern) {
  if (navigator.vibrate) navigator.vibrate(pattern)
}

export function autoGrow(t, max = 300) {
  if (!t) return
  t.style.height = 'auto'
  t.style.height = Math.min(t.scrollHeight, max) + 'px'
}

/** Gnist-belønning: små partikler fra et element. */
export function burst(node) {
  if (!node || reduceMotion()) return
  const r = node.getBoundingClientRect()
  const cx = r.left + r.width / 2
  const cy = r.top + r.height / 2
  const colors = ['#E8A53D', '#CC882B', '#42634A', '#E8A53D']
  for (let i = 0; i < 9; i++) {
    const s = document.createElement('div')
    s.className = 'spark'
    s.style.background = colors[i % colors.length]
    s.style.left = cx + 'px'
    s.style.top = cy + 'px'
    document.body.appendChild(s)
    const a = Math.PI * 2 * (i / 9) + Math.random() * 0.5
    const dist = 32 + Math.random() * 26
    s.animate(
      [
        { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
        {
          transform: `translate(calc(-50% + ${Math.cos(a) * dist}px), calc(-50% + ${Math.sin(a) * dist}px)) scale(0)`,
          opacity: 0,
        },
      ],
      { duration: 520 + Math.random() * 160, easing: 'cubic-bezier(.2,.7,.2,1)' },
    ).onfinish = () => s.remove()
  }
}

/** «i dag» / «i går» / «3. jun» fra epoch-ms. */
export function fmtDate(ts) {
  const d = new Date(ts)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'i dag'
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'i går'
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(d)
}

export const kr = (n) =>
  new Intl.NumberFormat('nb-NO', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' kr'
