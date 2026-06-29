/* eslint-disable react-refresh/only-export-components */
// Delte premium-UI-primitiver: animerte tall, skeletons, sideoverganger,
// reveal-stagger og toast. Bygd på «motion» + «sonner». Respekterer
// prefers-reduced-motion overalt.
import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { toast as sonner } from 'sonner'
import { reduceMotion } from './fx.js'

/* ============================================================
   Animerte tall — teller mykt opp/ned mot målverdien.
   `format` formaterer det viste tallet (f.eks. kr).
   ============================================================ */
export function AnimatedNumber({ value, format = (n) => Math.round(n), duration = 0.7, className }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(0)

  useEffect(() => {
    const from = fromRef.current
    const to = value
    if (from === to) return
    const ms = reduceMotion() ? 0 : duration * 1000
    const start = performance.now()
    cancelAnimationFrame(rafRef.current)
    const tick = (now) => {
      const t = ms <= 0 ? 1 : Math.min(1, (now - start) / ms)
      // easeOutExpo
      const e = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      setDisplay(from + (to - from) * e)
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = to
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className={className}>{format(display)}</span>
}

/* ============================================================
   Skeleton — skimrende lasteplassholder.
   ============================================================ */
export function Skeleton({ w, h = 16, r = 8, style, className = '' }) {
  return (
    <span
      className={'sk ' + className}
      style={{ width: w, height: h, borderRadius: r, ...style }}
      aria-hidden="true"
    />
  )
}

export function SkeletonCard({ lines = 2 }) {
  return (
    <div className="card sk-card">
      <Skeleton w="42%" h={18} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} w={i === lines - 1 ? '64%' : '88%'} h={13} style={{ marginTop: 10 }} />
      ))}
    </div>
  )
}

/* ============================================================
   Sideovergang — myk fade + løft når aktiv modul byttes.
   ============================================================ */
const pageVariants = {
  initial: { opacity: 0, y: 10 },
  enter: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

export function PageTransition({ id, children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={id}
        className="page-motion"
        variants={pageVariants}
        initial="initial"
        animate="enter"
        exit="exit"
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/* ============================================================
   Reveal — gentle innglid når et element ruller inn / mountes.
   `i` gir trappetrinns-forsinkelse i en liste.
   ============================================================ */
export function Reveal({ children, i = 0, y = 12, className, ...rest }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.36, ease: [0.16, 1, 0.3, 1], delay: Math.min(i * 0.045, 0.3) }}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/* ============================================================
   Toast — tynn wrapper rundt sonner med norske standarder.
   ============================================================ */
export const toast = {
  success: (msg, opts) => sonner.success(msg, opts),
  error: (msg, opts) => sonner.error(msg, opts),
  info: (msg, opts) => sonner(msg, opts),
  message: (msg, opts) => sonner(msg, opts),
  promise: (...a) => sonner.promise(...a),
}

export { motion, AnimatePresence }
