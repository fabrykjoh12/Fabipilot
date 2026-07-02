// Delte konstanter, ikoner og små rene hjelpere for prosjekt-verkstedet.
// Ingen React-state her — bare det StepSheet/SpineCard/StageBlock/PromptQueue/
// PromptComposer/Roadmap/ProjectsList har felles.
import { SWATCH } from '../../lib/palette.js'

export const STATUS_LABEL = { active: 'Aktiv', onice: 'På is', done: 'Ferdig' }
export const NEXT_STATUS = { active: 'onice', onice: 'done', done: 'active' }
export const ENERGY_NEXT = { '': 'lav', lav: 'hoy', hoy: '' }

export const PROJECT_COLORS = [
  { k: 'forest', val: SWATCH.forest },
  { k: 'amber', val: SWATCH.amber },
  { k: 'blue', val: SWATCH.blue },
  { k: 'rose', val: SWATCH.rose },
  { k: 'plum', val: SWATCH.plum },
  { k: 'slate', val: SWATCH.slate },
]
export const colorVal = (k) => (PROJECT_COLORS.find((c) => c.k === k) || PROJECT_COLORS[0]).val
export const PROJECT_EMOJIS = ['🗂️', '🚀', '🏡', '💪', '🎨', '📚', '💻', '🎸', '🌱', '💰', '✈️', '🧩', '🎯', '🔧', '📷', '🍳', '🎬', '🏃']
const MND_KORT = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']
export function fmtDeadline(date) {
  const [, m, d] = date.split('-').map(Number)
  return `${d}. ${MND_KORT[m - 1]}`
}

export function touchedText(ts) {
  if (!ts) return ''
  const days = Math.floor((Date.now() - ts) / 86400000)
  if (days <= 0) return 'Rørt sist i dag'
  if (days === 1) return 'Rørt sist i går'
  return `Rørt sist for ${days} dager siden`
}

export const MORE = (
  <svg viewBox="0 0 24 24" fill="currentColor" stroke="none">
    <circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" />
  </svg>
)
export const COPY = (
  <svg viewBox="0 0 24 24">
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h10" />
  </svg>
)

/* AI-arbeidsflyt: hvor i Claude-loopen et steg er. */
export const AI_NEXT = { idea: 'asked', asked: 'built', built: 'verified', verified: 'idea' }
export const AI_LABEL = { idea: 'Idé', asked: 'Spurt', built: 'Bygd', verified: 'Verifisert' }

/* Prompt-maler — ett klikk for å starte en vanlig type prompt.
   Maler med utfyllingsfelt. `build(v)` setter sammen den ferdige prompten
   fra feltene. Felt med `optional` teller ikke mot «kan legges til». */
export const PROMPT_TEMPLATES = [
  {
    key: 'component', emoji: '✨', label: 'Komponent',
    fields: [
      { key: 'what', label: 'Hva skal lages?', placeholder: 'en priskalkulator' },
      { key: 'does', label: 'Hva skal den gjøre?', placeholder: 'regne ut månedspris ut fra antall brukere', big: true },
    ],
    build: (v) => `Build ${v.what || '…'}.\nIt should ${v.does || '…'}.`,
  },
  {
    key: 'bug', emoji: '🐛', label: 'Fiks bug',
    fields: [
      { key: 'problem', label: 'Hva er feil?', placeholder: 'knappen gjør ingenting når jeg trykker', big: true },
      { key: 'expected', label: 'Hva forventet du?', placeholder: 'at skjemaet sendes inn' },
    ],
    build: (v) => `Fix this bug: ${v.problem || '…'}\nExpected: ${v.expected || '…'}`,
  },
  {
    key: 'design', emoji: '🎨', label: 'Design',
    fields: [
      { key: 'what', label: 'Hva skal forbedres?', placeholder: 'forsiden / en knapp / kortene' },
      { key: 'how', label: 'Hvordan? (mer/mindre av …)', placeholder: 'luftigere, større tekst, roligere farger', big: true },
    ],
    build: (v) => `Improve the design of ${v.what || '…'}.\nMake it ${v.how || '…'}.`,
  },
  {
    key: 'feature', emoji: '➕', label: 'Ny funksjon',
    fields: [
      { key: 'what', label: 'Hvilken funksjon?', placeholder: 'søkefelt / mørk modus' },
      { key: 'detail', label: 'Hvordan skal den funke?', placeholder: 'filtrerer lista mens jeg skriver', big: true },
    ],
    build: (v) => `Add ${v.what || '…'}.\nIt should ${v.detail || '…'}.`,
  },
  {
    key: 'refactor', emoji: '♻️', label: 'Refaktorer',
    fields: [
      { key: 'what', label: 'Hva skal ryddes?', placeholder: 'denne komponenten / denne filen' },
      { key: 'goal', label: 'Mål med opprydningen', placeholder: 'lettere å lese, mindre gjentakelse', big: true },
    ],
    build: (v) => `Refactor ${v.what || '…'} so that it becomes ${v.goal || '…'}.`,
  },
  {
    key: 'blank', emoji: '✍️', label: 'Tom',
    fields: [
      { key: 'text', label: 'Prompt', placeholder: 'Skriv hva du vil be Claude om …', big: true },
    ],
    build: (v) => v.text || '',
  },
]

/* Prioritetsnivåer. Lagres fortsatt som stage-verdiene now/next/later i db-en. */
export const STAGE_OPTS = [
  { k: 'now', label: 'Høy' },
  { k: 'next', label: 'Medium' },
  { k: 'later', label: 'Lav' },
]
export const PRIO_LABEL = { now: 'Høy prioritet', next: 'Medium', later: 'Lav' }
