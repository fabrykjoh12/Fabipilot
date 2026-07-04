import { db } from '../db.js'
import { syncLabel, syncLed } from '../lib/sync.js'
import { triggersSupported } from '../lib/notify.js'

/* Sky-sync & backup-panelet — tema, daglig påminnelse, sync-diagnostikk,
   JSON-eksport/import. Ren visning; all state/handling eies av App. */
export default function BackupSheet({
  theme,
  onToggleTheme,
  accent,
  onToggleAccent,
  reminder,
  onToggleReminder,
  onChangeReminderTime,
  onTestNotif,
  perm,
  syncState,
  currentUser,
  itemCount,
  pushing,
  onPush,
  syncing,
  onSyncNow,
  onExport,
  onImport,
  onClose,
}) {
  return (
    <div className="backup-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="backup-card" onClick={(e) => e.stopPropagation()}>
        <h2 className="backup-title">Sky-sync & backup</h2>

        <button type="button" className="theme-toggle" onClick={onToggleTheme}>
          <span>{theme === 'dark' ? '☀️' : '🌙'}</span>
          {theme === 'dark' ? 'Bytt til lys modus' : 'Bytt til mørk modus'}
        </button>

        <button type="button" className="theme-toggle" onClick={onToggleAccent}>
          <span>{accent === 'pink' ? '💙' : '💗'}</span>
          {accent === 'pink' ? 'Bytt til blå aksent' : 'Bytt til rosa aksent'}
        </button>

        <div className="rem-box">
          <div className="rem-head">
            <div>
              <span className="rem-title">Daglig påminnelse</span>
              <span className="rem-sub">En vennlig dytt om å planlegge dagen.</span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reminder.enabled}
              className={'rem-switch' + (reminder.enabled ? ' on' : '')}
              onClick={onToggleReminder}
            >
              <span className="rem-knob" />
            </button>
          </div>

          {reminder.enabled && (
            <div className="rem-time-row">
              <label className="rem-time-lbl" htmlFor="rem-time">Tidspunkt</label>
              <input
                id="rem-time"
                type="time"
                className="rem-time"
                value={reminder.time}
                onChange={(e) => onChangeReminderTime(e.target.value)}
              />
            </div>
          )}

          <button type="button" className="rem-test" onClick={onTestNotif}>
            Test varsel nå
          </button>

          <p className="rem-note">
            {perm === 'unsupported'
              ? 'Enheten din støtter ikke varsler.'
              : !triggersSupported()
              ? 'På denne enheten (f.eks. iPhone) kan ikke appen sende varsler når den er helt lukket. Du blir minnet på ved neste åpning — og app-ikonet viser hvor mye som gjenstår.'
              : 'Varselet kan komme selv når appen er lukket. Hold appen installert på hjemskjermen.'}
          </p>
        </div>

        <div className="sync-box">
          <div className="sync-row">
            <span className={'sync-led ' + syncLed(syncState)} />
            <span className="sync-status">{syncLabel(syncState)}</span>
          </div>

          <dl className="sync-diag">
            <div><dt>Ting her nå</dt><dd>{itemCount ?? '…'}</dd></div>
            <div><dt>E-post</dt><dd>{currentUser?.email || '—'}</dd></div>
            <div><dt>Bruker-ID</dt><dd className="mono">{currentUser?.userId || '—'}</dd></div>
          </dl>

          <button
            type="button"
            className="btn backup-action sync-push"
            disabled={pushing}
            onClick={onPush}
          >
            {pushing ? 'Laster opp…' : 'Last opp alt til skyen'}
          </button>
          <button
            type="button"
            className="btn backup-action sync-now"
            disabled={syncing}
            onClick={onSyncNow}
          >
            {syncing ? 'Synker…' : 'Synk nå (hent fra skyen)'}
          </button>
          <p className="sync-hint">
            Last opp på enheten som har dataen. På de andre enhetene: logg inn med samme
            e-post og trykk «Synk nå». Bruker-ID må være lik på alle enhetene.
          </p>
          <button
            type="button"
            className="sync-logout"
            onClick={() => db.cloud.logout({ force: true })}
          >
            Logg ut
          </button>
        </div>

        <p className="backup-text">
          Vil du ha en kopi på fil i tillegg? Eksporter en JSON og legg den i iCloud/Drive.
          {(() => {
            const t = Number(localStorage.getItem('lastBackup') || 0)
            return t
              ? ` Sist backup: ${new Intl.DateTimeFormat('nb-NO', { day: 'numeric', month: 'long' }).format(new Date(t))}.`
              : ' Ingen backup tatt ennå.'
          })()}
        </p>
        <button type="button" className="btn backup-action" onClick={onExport}>
          Eksporter alt (last ned JSON)
        </button>
        <label className="btn backup-action">
          Importer fra fil…
          <input type="file" accept="application/json,.json" hidden onChange={onImport} />
        </label>
        <button
          type="button"
          className="btn btn-ghost backup-action"
          onClick={onClose}
        >
          Lukk
        </button>
      </div>
    </div>
  )
}
