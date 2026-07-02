/* Sky-sync-status → norsk etikett + farge-LED. Delt mellom hovednavigasjonen
   og backup-panelet. */
export function syncLabel(s) {
  if (!s) return 'Kobler til…'
  if (s.status === 'offline' || s.phase === 'offline') return 'Frakoblet (jobber lokalt)'
  if (s.status === 'error' || s.phase === 'error') return 'Sync-feil'
  if (s.phase === 'pushing') return 'Laster opp…'
  if (s.phase === 'pulling') return 'Henter…'
  if (s.status === 'connecting') return 'Kobler til…'
  if (s.phase === 'in-sync') return 'Synket ✓'
  if (s.status === 'connected') return 'Tilkoblet'
  return 'Ikke synket enda'
}
export function syncLed(s) {
  if (!s) return 'amber'
  if (s.status === 'error' || s.phase === 'error') return 'red'
  if (s.status === 'offline' || s.phase === 'offline') return 'grey'
  if (s.phase === 'in-sync') return 'green'
  return 'amber'
}
