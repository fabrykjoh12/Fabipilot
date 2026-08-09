import { SWATCH } from './palette.js'

/* Kategoriene for Penger — delt av Money.jsx, MoneyImport.jsx og bankImport.js.

   Lå tidligere inni Money.jsx, men bankimporten må gjette både kategori OG
   underkategori, og da trenger begge samme fasit.

   Nøklene (`k`) lagres i databasen. De seks opprinnelige (dagligvarer,
   restaurant, kjoretoy, fritid, helse, hjem + ovrig) er UENDRET — de tre nye
   (klaer, skjonnhet, gaver) er lagt TIL, så eksisterende rader er urørt og
   ingen migrering trengs. De tre nye er hentet fra det som lå igjen i «Øvrig»
   i brukerens ekte kontoutskrift (klesbutikker, frisør, gullsmed). */
export const CATEGORIES = [
  { k: 'dagligvarer', label: 'Dagligvarer', emoji: '🛒', color: SWATCH.amber },
  { k: 'restaurant', label: 'Restaurant og takeaway', emoji: '🍽️', color: SWATCH.coral },
  { k: 'kjoretoy', label: 'Transport', emoji: '🚗', color: SWATCH.blue },
  { k: 'fritid', label: 'Fritid og abonnement', emoji: '🎮', color: SWATCH.teal },
  { k: 'helse', label: 'Helse og trening', emoji: '❤️', color: SWATCH.rose },
  { k: 'hjem', label: 'Hjem og regninger', emoji: '🌱', color: SWATCH.forest },
  { k: 'klaer', label: 'Klær og sko', emoji: '👕', color: SWATCH.plum },
  { k: 'skjonnhet', label: 'Frisør og velvære', emoji: '💇', color: SWATCH.violet },
  { k: 'gaver', label: 'Gaver', emoji: '🎁', color: SWATCH.moss },
  { k: 'ovrig', label: 'Øvrig', emoji: '📦', color: SWATCH.slate },
]

/* Underkategorier: valgfri finpuss under hver kategori. `sub` er uindeksert og
   kan mangle — alt fungerer likt uten. Brukes til å svare på «hva INNI
   dagligvarer/transport gikk pengene til?» uten å lage 30 toppkategorier. */
export const SUBCATEGORIES = {
  dagligvarer: [
    { k: 'matbutikk', label: 'Matbutikk' },
    { k: 'kiosk', label: 'Kiosk og bensin-mat' },
    { k: 'vinmonopol', label: 'Vinmonopolet' },
  ],
  restaurant: [
    { k: 'restaurant', label: 'Restaurant' },
    { k: 'takeaway', label: 'Takeaway og levering' },
    { k: 'kafe', label: 'Kafé og bakeri' },
  ],
  kjoretoy: [
    { k: 'drivstoff', label: 'Drivstoff og lading' },
    { k: 'parkering', label: 'Parkering' },
    { k: 'bom', label: 'Bom og ferge' },
    { k: 'kollektiv', label: 'Kollektivtransport' },
    { k: 'verksted', label: 'Verksted og deler' },
  ],
  fritid: [
    { k: 'stromming', label: 'Strømming og musikk' },
    { k: 'programvare', label: 'Programvare og AI' },
    { k: 'spill', label: 'Spill' },
    { k: 'opplevelser', label: 'Kino og opplevelser' },
    { k: 'reise', label: 'Reise og hotell' },
    { k: 'bocker', label: 'Bøker og media' },
  ],
  helse: [
    { k: 'apotek', label: 'Apotek' },
    { k: 'behandling', label: 'Lege og tannlege' },
    { k: 'trening', label: 'Trening' },
    { k: 'optiker', label: 'Optiker' },
  ],
  hjem: [
    { k: 'strom', label: 'Strøm' },
    { k: 'mobil', label: 'Mobil og internett' },
    { k: 'forsikring', label: 'Forsikring' },
    { k: 'interior', label: 'Interiør og oppussing' },
    { k: 'elektronikk', label: 'Elektronikk' },
    { k: 'hage', label: 'Hage' },
  ],
  klaer: [
    { k: 'klaer', label: 'Klær' },
    { k: 'sko', label: 'Sko' },
    { k: 'sport', label: 'Sportsutstyr' },
  ],
  skjonnhet: [
    { k: 'frisor', label: 'Frisør' },
    { k: 'kosmetikk', label: 'Kosmetikk' },
  ],
  gaver: [
    { k: 'gave', label: 'Gave' },
    { k: 'blomster', label: 'Blomster' },
  ],
  ovrig: [
    { k: 'gebyr', label: 'Gebyr og renter' },
    { k: 'betaling', label: 'Vipps/Klarna (ukjent butikk)' },
    { k: 'ukjent', label: 'Ukjent' },
  ],
}

const FALLBACK = CATEGORIES[CATEGORIES.length - 1]

export const catMeta = (k) => CATEGORIES.find((c) => c.k === k) || FALLBACK
export const catKey = (k) => (CATEGORIES.some((c) => c.k === k) ? k : 'ovrig')
export const subsFor = (catK) => SUBCATEGORIES[catKey(catK)] || []
// Etikett for en underkategori, eller '' hvis den mangler/ikke hører til kategorien.
export const subLabel = (catK, subK) => subsFor(catK).find((s) => s.k === subK)?.label || ''
