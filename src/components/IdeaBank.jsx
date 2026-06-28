import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listIdeas,
  addIdea,
  updateIdea,
  deleteIdea,
  exportAll,
  importAll,
} from '../db.js'
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

const reduceMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

/* ---------- helpers (portet fra prototypen) ---------- */
function autoGrow(t, max = 300) {
  if (!t) return
  t.style.height = 'auto'
  t.style.height = Math.min(t.scrollHeight, max) + 'px'
}

function fmtDate(ts) {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) return 'i dag'
  const yest = new Date(now)
  yest.setDate(now.getDate() - 1)
  if (d.toDateString() === yest.toDateString()) return 'i går'
  return new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'short' }).format(d)
}

/* gnist-animasjon ved lagring */
function burst(node) {
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

/* ---------- ett idé-kort ----------
   Får ny, frisk state hver gang ideen byttes (parent gir key={idea.id}),
   så vi trenger ingen sync-effekt mot props. */
function IdeaCard({ idea, open, onOpen, onCycleCat, onPickCat, onToggleFav, onDelete, onEdit }) {
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
  // Live fra IndexedDB — oppdaterer seg selv når databasen endres.
  const ideas = useLiveQuery(() => listIdeas(), [], [])

  const [filter, setFilter] = useState('all')
  const [query, setQuery] = useState('')
  const [openId, setOpenId] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [cap, setCap] = useState('')

  const capRef = useRef(null)
  const saveBtnRef = useRef(null)
  const fileRef = useRef(null)
  const scrollRef = useRef(null)
  const menuWrapRef = useRef(null)
  const searchRef = useRef(null)

  // lukk meny ved klikk utenfor
  useEffect(() => {
    if (!menuOpen) return
    function onDoc(e) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [menuOpen])

  /* ---------- mutasjoner (live query oppdaterer UI automatisk) ---------- */
  function onCycleCat(idea) {
    const idx = CATS.findIndex((c) => c.k === idea.category)
    updateIdea(idea.id, { category: CATS[(idx + 1) % CATS.length].k })
  }
  const onPickCat = (idea, k) => updateIdea(idea.id, { category: k })
  const onToggleFav = (idea) => updateIdea(idea.id, { isFavorite: !idea.isFavorite })
  const onEdit = (id, patch) => updateIdea(id, patch)

  function onOpen(id) {
    setOpenId((cur) => (cur === id ? null : id))
  }
  async function onDelete(id) {
    if (openId === id) setOpenId(null)
    await deleteIdea(id)
  }

  /* ---------- fange ny idé ---------- */
  async function handleAdd() {
    const text = cap.trim()
    if (!text) return
    await addIdea(text)
    setCap('')
    autoGrow(capRef.current, 120)
    if (navigator.vibrate) navigator.vibrate([12, 28, 12])
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

  /* ---------- søk ---------- */
  function toggleSearch() {
    setSearchOpen((open) => {
      const next = !open
      if (next) setTimeout(() => searchRef.current?.focus(), 100)
      else setQuery('')
      return next
    })
  }

  /* ---------- eksport / import ---------- */
  async function handleExport() {
    setMenuOpen(false)
    const data = await exportAll()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'idebank-backup.json'
    a.click()
    URL.revokeObjectURL(url)
  }
  async function handleImportFile(e) {
    const file = e.target.files?.[0]
    setMenuOpen(false)
    if (!file) return
    try {
      const json = JSON.parse(await file.text())
      const n = await importAll(json)
      window.alert(
        n > 0
          ? `Importerte ${n} ${n === 1 ? 'idé' : 'ideer'}.`
          : 'Ingen nye ideer å importere (alt fantes fra før).',
      )
    } catch (err) {
      window.alert('Kunne ikke importere: ' + err.message)
    } finally {
      e.target.value = ''
    }
  }

  /* ---------- avledet visning ---------- */
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
    <div className="ideabank">
      <div className="phone">
        <div className="scroll" ref={scrollRef}>
          <div className="top">
            <div>
              <h1 className="title">Idébank</h1>
              <p className="sub">{subText}</p>
            </div>
            <div className="headbtns" ref={menuWrapRef}>
              <button
                type="button"
                className="iconbtn"
                aria-label="Meny"
                aria-haspopup="true"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((o) => !o)}
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none" />
                  <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
                  <circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none" />
                </svg>
              </button>
              <button
                type="button"
                className={'iconbtn' + (searchOpen ? ' on' : '')}
                aria-label="Søk"
                onClick={toggleSearch}
              >
                <svg viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </button>

              {menuOpen && (
                <div className="menu" role="menu">
                  <button type="button" role="menuitem" onClick={handleExport}>
                    <svg viewBox="0 0 24 24">
                      <path d="M12 3v12M7 10l5 5 5-5" />
                      <path d="M5 21h14" />
                    </svg>
                    Eksporter backup
                  </button>
                  <button type="button" role="menuitem" onClick={() => fileRef.current?.click()}>
                    <svg viewBox="0 0 24 24">
                      <path d="M12 21V9M7 14l5-5 5 5" />
                      <path d="M5 3h14" />
                    </svg>
                    Importer backup
                  </button>
                </div>
              )}
            </div>
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
                    ? 'Neste gang noe kult slår deg — en app, et spill, en greie — dump det i feltet nederst. Sorter senere.'
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
                />
              ))
            )}
          </div>

          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={handleImportFile}
          />
        </div>

        <div className="capture">
          <div className="capfield">
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
              className="savebtn"
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
    </div>
  )
}
