import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { Plus, ListChecks, Lightbulb, CalendarDays, CornerDownLeft } from 'lucide-react'
import {
  addTask, updateTask, addTodo, updateTodo, addIdea, addEvent, todayKey,
} from '../db.js'
import { parseEntry } from '../lib/parse.js'
import { vibrate, burst } from '../lib/fx.js'
import { toast } from '../lib/ui.jsx'
import './Capture.css'

const TYPES = [
  { k: 'task', label: 'Oppgave', Icon: Plus, nav: 'today', store: 'I dag' },
  { k: 'todo', label: 'Liste', Icon: ListChecks, nav: 'todo', store: 'Liste' },
  { k: 'idea', label: 'Idé', Icon: Lightbulb, nav: 'ideas', store: 'Idébank' },
  { k: 'event', label: 'Hendelse', Icon: CalendarDays, nav: 'calendar', store: 'Kalender' },
]

function fmtDate(key) {
  if (!key) return null
  const [y, m, d] = key.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const t = new Date()
  const sameDay = (a, b) => a.toDateString() === b.toDateString()
  if (sameDay(date, t)) return 'i dag'
  const tom = new Date(t); tom.setDate(t.getDate() + 1)
  if (sameDay(date, tom)) return 'i morgen'
  return new Intl.DateTimeFormat('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' }).format(date)
}

export default function Capture({ open, onClose, onNav }) {
  const [text, setText] = useState('')
  const [override, setOverride] = useState(null)
  const inputRef = useRef(null)
  const saveRef = useRef(null)

  const parsed = useMemo(() => parseEntry(text), [text])
  const type = override || parsed.type
  const meta = TYPES.find((t) => t.k === type)

  // Bare fokus i effekten (ingen setState) — state nullstilles ved lukking/lagring.
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => inputRef.current?.focus(), 60)
    const onKey = (e) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => { clearTimeout(id); window.removeEventListener('keydown', onKey) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    setText('')
    setOverride(null)
    onClose()
  }

  if (!open) return null

  const title = parsed.title.trim()

  async function save() {
    if (!title) return
    const { dueDate, time } = parsed
    if (type === 'idea') await addIdea(title)
    else if (type === 'todo') { const x = await addTodo(title); if (dueDate) await updateTodo(x.id, { dueDate }) }
    else if (type === 'event') await addEvent({ title, date: dueDate || todayKey(), time })
    else { const x = await addTask(title); if (dueDate) await updateTask(x.id, { dueDate }) }

    vibrate(8)
    if (saveRef.current) burst(saveRef.current)
    toast.success(`Lagt til i ${meta.store}`, {
      action: { label: 'Vis', onClick: () => onNav?.(meta.nav) },
    })
    close()
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      save()
    }
  }

  const datePreview = type !== 'idea' ? fmtDate(parsed.dueDate) : null

  return (
    <div className="cap-overlay" role="dialog" aria-modal="true" aria-label="Hurtig­lagring" onClick={close}>
      <motion.div
        className="cap-sheet"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className="cap-grip" />
        <textarea
          ref={inputRef}
          className="cap-input"
          rows={1}
          placeholder="Skriv hva som helst…  «handle melk i morgen»"
          value={text}
          enterKeyHint="done"
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
        />

        <div className="cap-preview">
          {title ? (
            <>
              <span className="cap-chip cap-chip-type">
                <meta.Icon />
                {meta.label}
              </span>
              {datePreview && <span className="cap-chip">{datePreview}</span>}
              {type === 'event' && parsed.time && <span className="cap-chip">{parsed.time}</span>}
              <span className="cap-title-prev">«{title}»</span>
            </>
          ) : (
            <span className="cap-hint">
              Prøv: «ring tannlegen fredag kl 14», «idé: podcast», «betale husleie 15.7»
            </span>
          )}
        </div>

        <div className="cap-types">
          {TYPES.map((t) => (
            <button
              key={t.k}
              type="button"
              className={'cap-type' + (type === t.k ? ' on' : '')}
              onClick={() => setOverride(t.k)}
            >
              <t.Icon />
              {t.label}
            </button>
          ))}
        </div>

        <button ref={saveRef} type="button" className="cap-save" disabled={!title} onClick={save}>
          Legg til
          <span className="cap-enter"><CornerDownLeft /></span>
        </button>
      </motion.div>
    </div>
  )
}
