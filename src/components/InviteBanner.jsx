import { useObservable } from 'dexie-react-hooks'
import { db } from '../db.js'
import { vibrate } from '../lib/fx.js'
import { toast } from '../lib/ui.jsx'

/* Ubehandlede invitasjoner til delte lister/prosjekter (Dexie Cloud
   realm-medlemskap). Uten dette blir et medlemskap stående som «invitert»
   for evig — man må eksplisitt godta (`invite.accept()`) før realmet
   faktisk synces til enheten. Vises øverst i appen uansett hvilken fane
   du står på, til alle invitasjoner er behandlet. */
export default function InviteBanner() {
  const invites = useObservable(db.cloud.invites)
  if (!invites || invites.length === 0) return null

  async function accept(invite) {
    await invite.accept()
    vibrate([10, 30, 10])
    toast.success(`Ble med i «${invite.realm?.name || 'delt liste'}»`)
  }

  async function reject(invite) {
    await invite.reject()
  }

  return (
    <div className="lia-overlay">
      <div className="lia-card">
        <h2 className="lia-title">Du er invitert</h2>
        {invites.map((inv) => (
          <div key={inv.id} className="invite-row">
            <p className="invite-text">
              Noen har delt <b>«{inv.realm?.name || 'en liste'}»</b> med deg.
            </p>
            <div className="invite-actions">
              <button type="button" className="lia-submit" onClick={() => accept(inv)}>Godta</button>
              <button type="button" className="lia-cancel" onClick={() => reject(inv)}>Avslå</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
