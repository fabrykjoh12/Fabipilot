/* Sky-sync-status → norsk etikett + farge-LED. Delt mellom hovednavigasjonen
   og backup-panelet. */
export function syncLabel(s) {
  if (!s) return 'Kobler til…'
  // Lisens FØRST: med utløpt/deaktivert lisens tar serveren ikke imot data, men
  // status/phase kan fortsatt se helt normal ut. Uten denne sjekken viser appen
  // «Synket ✓» mens ingenting faktisk lagres i skyen.
  if (s.license === 'expired') return 'Sky-lisens utløpt — lagrer KUN lokalt'
  if (s.license === 'deactivated') return 'Sky-konto deaktivert — lagrer KUN lokalt'
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
  if (s.license && s.license !== 'ok') return 'red'
  if (s.status === 'error' || s.phase === 'error') return 'red'
  if (s.status === 'offline' || s.phase === 'offline') return 'grey'
  if (s.phase === 'in-sync') return 'green'
  return 'amber'
}
