import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  listSharedItems, addSharedItem, setSharedItemDone, deleteSharedItem, updateSharedItem,
  listSharedMembers, inviteToShared, removeSharedMember, ensureSharedRealm, db,
} from '../db.js'
import { vibrate, burst } from '../lib/fx.js'

const CHECK = (
  <svg viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>
)

function Item({ item }) {
  const [editing, setEditing] = useState(false)
  const [val, setVal] = useState('')

  function startEdit() { setVal(item.text); setEditing(true) }
  function save() {
    const v = val.trim()
    if (v && v !== item.text) updateSharedItem(item.id, { text: v })
    setEditing(false)
  }

  return (
    <div className={'task' + (item.isDone ? ' done' : '')}>
      <button
        type="button"
        className={'check' + (item.isDone ? ' on' : '')}
        aria-label={item.isDone ? 'Angre' : 'Fullfør'}
        onClick={(e) => { if (!item.isDone) { vibrate([10, 24, 10]); burst(e.currentTarget) } setSharedItemDone(item.id, !item.isDone) }}
      >
        {CHECK}
      </button>
      {editing ? (
        <input
          className="task-edit"
          value={val}
          autoFocus
          onChange={(e) => setVal(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false) }}
        />
      ) : (
        <span className="task-title" onClick={startEdit} title="Trykk for å redigere">{item.text}</span>
      )}
      <button type="button" className="icon-x" aria-label="Slett" onClick={() => deleteSharedItem(item.id)}>
        <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18" /></svg>
      </button>
    </div>
  )
}

/* Delt, avhukbar liste — motoren bak «Delt» og «Handleliste». Begge lister
   deler ÉTT Dexie Cloud-realm (samme personer ser begge), og partisjoneres
   kun via `list`-feltet på hvert item. Se `ensureSharedRealm` i db.js. */
export default function SharedListView({ list, title, placeholder, emptyGlyph, emptyTitle, emptyHint }) {
  const items = useLiveQuery(() => listSharedItems(list), [list], [])
  const members = useLiveQuery(() => listSharedMembers().catch(() => []), [], [])
  const realmId = useLiveQuery(() => ensureSharedRealm().catch(() => null), [], null)
  const [val, setVal] = useState('')
  const [email, setEmail] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [showInvite, setShowInvite] = useState(false)

  const open = items.filter((i) => !i.isDone)
  const done = items.filter((i) => i.isDone)
  const myId = db.cloud.currentUserId

  async function add() {
    const v = val.trim()
    if (!v) return
    await addSharedItem(v, list)
    setVal('')
    vibrate(8)
  }

  async function invite() {
    const e = email.trim()
    if (!e) return
    try {
      await inviteToShared(e)
      setInviteMsg(`Invitasjon sendt til ${e.toLowerCase()} ✓`)
      setEmail('')
    } catch (err) {
      setInviteMsg('Kunne ikke invitere: ' + (err?.message || err))
    }
  }

  return (
    <div className="screen">
      <div className="screen-scroll">
        <div className="scr-top">
          <div>
            <h1 className="scr-title">{title}</h1>
            <p className="scr-sub">
              {members.length > 1 ? `Delt med ${members.length - 1} person${members.length - 1 > 1 ? 'er' : ''}` : 'Del med kjæresten — samme liste, begge enheter.'}
            </p>
          </div>
          <button type="button" className="ov-edit-btn" onClick={() => setShowInvite((s) => !s)}>
            {showInvite ? 'Lukk' : 'Del'}
          </button>
        </div>

        {showInvite && (
          <div className="share-panel card">
            <span className="share-lbl">Inviter på e-post</span>
            <div className="share-invite">
              <input
                type="email"
                placeholder="kjæreste@epost.no"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && invite()}
              />
              <button type="button" disabled={!email.trim()} onClick={invite}>Send</button>
            </div>
            {inviteMsg && <p className="share-msg">{inviteMsg}</p>}
            {members.length > 0 && (
              <ul className="share-members">
                {members.map((m) => (
                  <li key={m.id}>
                    <span className="share-mail">{m.email || m.userId || '—'}{m.userId === myId ? ' (deg)' : ''}</span>
                    <span className="share-state">{m.accepted ? 'med' : m.invite ? 'invitert' : ''}</span>
                    {m.userId !== myId && (
                      <button type="button" className="share-remove" aria-label="Fjern" onClick={() => removeSharedMember(m.id)}>×</button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="share-hint">
              Begge må være innlogget med hver sin e-post. Personen får en invitasjon i appen neste gang
              hun logger inn. «Delt liste» og «Handleliste» deles med de samme personene — alt annet er privat.
            </p>
            <p className="share-hint">
              Realm-ID (for feilsøking — bør være likt på begge enheter): <code>{realmId || '…'}</code>
            </p>
          </div>
        )}

        <div style={{ marginTop: 20 }}>
          {items.length === 0 ? (
            <div className="empty">
              <div className="glyph">{emptyGlyph}</div>
              <p className="em-ttl">{emptyTitle}</p>
              <p>{emptyHint}</p>
            </div>
          ) : (
            <>
              {open.map((i) => <Item key={i.id} item={i} />)}
              {done.length > 0 && (
                <>
                  <div className="sec-label" style={{ marginTop: 18 }}>Fullført<span className="ct">{done.length}</span><span className="ln" /></div>
                  {done.map((i) => <Item key={i.id} item={i} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>

      <div className="screen-bar">
        <div className="field">
          <input
            type="text"
            placeholder={placeholder}
            enterKeyHint="done"
            value={val}
            onChange={(e) => setVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <button type="button" className="field-btn" aria-label="Legg til" disabled={val.trim() === ''} onClick={add}>
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /></svg>
          </button>
        </div>
      </div>
    </div>
  )
}
