import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { listIdeas, addIdea, updateIdea, deleteIdea, promoteIdeaToProject } from '../db.js'
import { burst, vibrate, reduceMotion, autoGrow, fmtDate } from '../lib/fx.js'
import './IdeaBank.css'

const CATS = [
  { k: 'ny', label: 'Ny' },
  { k: 'app', label: 'App' },
  { k: 'spill', label: 'Spill' },
  { k: 'business', label: 'Business' },
  { k: 'innhold', label: 'Innhold' },
  { k: 'annet', label: 'Annet' },
]
const catLabel = (k) => (CATS.find((c) => c.k === k) || CATS[0]).label

/* ---------- ett idé-kort ---------- */
function IdeaCard({ idea, open, onOpen, onCycleCat, onPickCat, onToggleFav, onDelete, onEdit, onPromote }) {
  const [text, setText] = useState(idea.text)
  const [note, setNote] = useState(idea.note || '')
  const [leaving, setLeaving] = useState(false)
  const editRef = useRef(null)
  const noteRef = useRef(null)
  const timer = useRef(null)

  useEffect(() => {
    if (open) {
      autoGrow(editRef.current)
      autoGrow(noteRef.current)
    }
  }, [open])

  function schedule(nextText, nextNote) {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => onEdit(idea.id, { text: nextText, note: nextNote }), 400)
  }
  function onTextInput(e) {
    const v = e.target.value
    setText(v)
    autoGrow(editRef.current)
    schedule(v, note)
  }
  function onNoteInput(e) {
    const v = e.target.value
    setNote(v)
    autoGrow(noteRef.current)
    schedule(text, v)
  }
  function handleDelete(e) {
    e.stopPropagation()
    setLeaving(true)
    setTimeout(() => onDelete(idea.id), reduceMotion() ? 0 : 320)
  }

  return (
    <div
      className={'idea' + (open ? ' open' : '') + (leaving ? ' leaving' : '')}
      onClick={() => onOpen(idea.id)}
    >
      <div className="idea-row">
        <div className="idea-body">
          <div className="idea-text">{idea.text}</div>
          <div className="idea-meta">
            <button
              type="button"
              className={'pill' + (idea.category === 'ny' ? ' ny' : '')}
              onClick={(e) => {
                e.stopPropagation()
                onCycleCat(idea)
              }}
            >
              {catLabel(idea.category)}
            </button>
            <span className="date">{fmtDate(idea.createdAt)}</span>
          </div>
        </div>
        <button
          type="button"
          className={'fav' + (idea.isFavorite ? ' on' : '')}
          aria-label="Favoritt"
          aria-pressed={idea.isFavorite}
          onClick={(e) => {
            e.stopPropagation()
            onToggleFav(idea)
          }}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3.6l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7 6.9 19.2l1-5.6-4.1-4 5.7-.8z" />
          </svg>
        </button>
      </div>

      <div className="expand">
        <textarea
          ref={editRef}
          className="edit-ta"
          rows="2"
          value={text}
          onClick={(e) => e.stopPropagation()}
          onChange={onTextInput}
        />
        <textarea
          ref={noteRef}
          className="note-ta"
          rows="1"
          placeholder="Legg til detaljer (valgfritt)…"
          value={note}
          onClick={(e) => e.stopPropagation()}
          onChange={onNoteInput}
        />
        <div className="catrow">
          {CATS.map((c) => (
            <button
              key={c.k}
              type="button"
              className={'catpick' + (idea.category === c.k ? ' sel' : '')}
              onClick={(e) => {
                e.stopPropagation()
                onPickCat(idea, c.k)
              }}
            >
              {c.label}
            </button>
          ))}
        </div>
        <div className="exfoot">
          <button
            type="button"
            className="promote"
            onClick={(e) => {
              e.stopPropagation()
              onPromote(idea)
            }}
          >
            ↗ Forfremm til prosjekt
          </button>
          <button type="button" className="del" onClick={handleDelete}>
            Slett idé
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- idébanken ---------- */
export default function IdeaBank() {
  const ideas = useLiveQuery(() => listIdeas(), [], [])
  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [cap, setCap] = useState('')

  const capRef = useRef(null)
  const saveBtnRef = useRef(null)
  const scrollRef = useRef(null)
  const searchRef = useRef(null)

  function onCycleCat(idea) {
    const idx = CATS.findIndex((c) => c.k === idea.category)
    updateIdea(idea.id, { category: CATS[(idx + 1) % CATS.length].k })
  }
  const onPickCat = (idea, k) => updateIdea(idea.id, { category: k })
  const onToggleFav = (idea) => updateIdea(idea.id, { isFavorite: !idea.isFavorite })
  const onEdit = (id, patch) => updateIdea(id, patch)
  const onOpen = (id) => setOpenId((cur) => (cur === id ? null : id))
  async function onDelete(id) {
    if (openId === id) setOpenId(null)
    await deleteIdea(id)
  }
  async function onPromote(idea) {
    if (openId === idea.id) setOpenId(null)
    const { capReached } = await promoteIdeaToProject(idea)
    window.alert(
      capReached
        ? `«${idea.text}» ble lagt «på is» — du har allerede 3 aktive prosjekter. Den ligger nå under Prosjekter.`
        : `«${idea.text}» er nå et aktivt prosjekt. Du finner det under Prosjekter.`,
    )
  }

  async function handleAdd() {
    const text = cap.trim()
    if (!text) return
    await addIdea(text)
    setCap('')
    autoGrow(capRef.current, 120)
    vibrate([12, 28, 12])
    burst(saveBtnRef.current)
    setFilter('all')
    setQuery('')
    setSearchOpen(false)
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' }))
  }
  function onCapInput(e) {
    setCap(e.target.value)
    autoGrow(capRef.current, 120)
  }
  function onCapKeyDown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') handleAdd()
  }
  function toggleSearch() {
    setSearchOpen((o) => {
      const next = !o
      if (next) setTimeout(() => searchRef.current?.focus(), 100)
      else setQuery('')
      return next
    })
  }

  const q = query.trim().toLowerCase()
  let view = ideas
  if (filter === 'fav') view = view.filter((i) => i.isFavorite)
  else if (filter !== 'all') view = view.filter((i) => i.category === filter)
  if (q) view = view.filter((i) => (i.text + ' ' + (i.note || '')).toLowerCase().includes(q))

  const subText =
    ideas.length === 0
      ? 'Tom — og venter på den første.'
      : ideas.length + (ideas.length === 1 ? ' idé fanget' : ' ideer fanget')

  const used = new Set(ideas.map((i) => i.category))
  const chips = [
    { k: 'all', label: 'Alle' },
    { k: 'fav', label: '★ Favoritter', star: true },
    ...CATS.filter((c) => used.has(c.k)),
  ]

  return (
    <div className="screen ideabank">
      <div className="screen-scroll" ref={scrollRef}>
        <div className="scr-top">
          <div>
            <h1 className="scr-title">Idébank</h1>
            <p className="scr-sub">{subText}</p>
          </div>
          <button
            type="button"
            className={'icon-btn' + (searchOpen ? ' on' : '')}
            aria-label="Søk"
            onClick={toggleSearch}
          >
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.5-3.5" />
            </svg>
          </button>
        </div>

        <div className={'searchwrap' + (searchOpen ? ' open' : '')}>
          <input
            ref={searchRef}
            type="text"
            placeholder="Søk i ideene dine…"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="filters">
          {chips.map((f) => (
            <button
              key={f.k}
              type="button"
              className={'chip' + (filter === f.k ? ' active' : '') + (f.star ? ' star' : '')}
              onClick={() => setFilter(f.k)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div id="list">
          {view.length === 0 ? (
            <div className="empty">
              <div className="glyph">💡</div>
              <p className="em-ttl">{ideas.length === 0 ? 'Ingen ideer enda' : 'Ingenting her'}</p>
              <p>
                {ideas.length === 0
                  ? 'Neste gang noe kult slår deg — bare dump det her. Ingen vurdering, sorter aldri. Det er poenget.'
                  : 'Ingen ideer i dette filteret. Prøv «Alle».'}
              </p>
            </div>
          ) : (
            view.map((i) => (
              <IdeaCard
                key={i.id}
                idea={i}
                open={openId === i.id}
                onOpen={onOpen}
                onCycleCat={onCycleCat}
                onPickCat={onPickCat}
                onToggleFav={onToggleFav}
                onDelete={onDelete}
                onEdit={onEdit}
                onPromote={onPromote}
              />
            ))
          )}
        </div>
      </div>

      <div className="screen-bar">
        <div className="field">
          <textarea
            ref={capRef}
            rows="1"
            placeholder="Hva er ideen?"
            enterKeyHint="enter"
            value={cap}
            onChange={onCapInput}
            onKeyDown={onCapKeyDown}
          />
          <button
            ref={saveBtnRef}
            type="button"
            className="field-btn"
            aria-label="Lagre idé"
            disabled={cap.trim() === ''}
            onClick={handleAdd}
          >
            <svg viewBox="0 0 24 24">
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
