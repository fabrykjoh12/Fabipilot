import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useEscape } from '../../lib/ui.jsx'
import { db, shareProject, listProjectMembers, removeProjectMember, stopSharingProject } from '../../db.js'
import { vibrate } from '../../lib/fx.js'

/* Del et helt prosjekt via e-post (Dexie Cloud realm). */
export default function ShareSheet({ project, onClose }) {
  useEscape(onClose)
  const members = useLiveQuery(() => listProjectMembers(project.id).catch(() => []), [project.id], [])
  const [email, setEmail] = useState('')
  const [msg, setMsg] = useState('')
  const myId = db.cloud?.currentUserId
  const shared = members.length > 0

  async function invite() {
    const e = email.trim()
    if (!e) return
    try {
      await shareProject(project.id, e)
      setMsg(`Invitasjon sendt til ${e.toLowerCase()} ✓`)
      setEmail('')
      vibrate(8)
    } catch (err) {
      setMsg('Kunne ikke dele: ' + (err?.message || err))
    }
  }
  async function stop() {
    await stopSharingProject(project.id)
    setMsg('Deling avsluttet.')
  }

  return (
    <div className="pcomp-overlay" onClick={onClose}>
      <div className="pcomp" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="pcomp-grip" />
        <h2 className="share-title">Del «{project.name}»</h2>
        <p className="share-sub">Inviter noen på e-post — de får hele prosjektet med stegene, og dere jobber i samme tavle.</p>
        <div className="share-invite">
          <input
            type="email"
            placeholder="navn@epost.no"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && invite()}
          />
          <button type="button" disabled={!email.trim()} onClick={invite}>Send</button>
        </div>
        {msg && <p className="share-msg">{msg}</p>}
        {members.length > 0 && (
          <ul className="share-members">
            {members.map((m) => (
              <li key={m.id}>
                <span className="share-mail">{m.email || m.userId || '—'}{m.userId === myId ? ' (deg)' : ''}</span>
                <span className="share-state">{m.accepted ? 'med' : m.invite ? 'invitert' : ''}</span>
                {m.userId !== myId && (
                  <button type="button" className="share-remove" aria-label="Fjern" onClick={() => removeProjectMember(m.id)}>×</button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="share-hint">Begge må være innlogget med hver sin e-post. Personen får invitasjonen i appen neste gang de logger inn. Bare dette prosjektet deles.</p>
        {shared && <button type="button" className="share-stop" onClick={stop}>Slutt å dele</button>}
      </div>
    </div>
  )
}
