// Prompt-bygging for Claude-verkstedet (Prosjekter) — rene funksjoner,
// ingen React/Dexie-avhengighet, lett å enhetsteste.

/* Prosjektkontekst-blokk som limes foran prompts. Selve prompt-teksten er
   på engelsk (brukeren jobber på engelsk med Claude); appen ellers er norsk. */
export function projectContext(project) {
  const ctx = []
  if (project?.name) ctx.push(`Project: ${project.name}`)
  if (project?.why) ctx.push(`Goal: ${project.why}`)
  if (project?.context) ctx.push(`Context: ${project.context}`)
  if (project?.liveUrl) ctx.push(`Live: ${project.liveUrl}`)
  if (project?.repoUrl) ctx.push(`Repo: ${project.repoUrl}`)
  return ctx.join('\n')
}

/* Setter sammen ett steg til en ferdig prompt med prosjektkontekst foran,
   klar til å lime inn i Claude/Codex. Uten kontekst → bare teksten. */
export function buildPrompt(project, text) {
  const header = projectContext(project)
  return header ? `${header}\n\nTask:\n${text}` : text
}

/* Setter sammen ALLE steg til én nummerert liste — «alt jeg vil at Claude skal gjøre». */
export function buildAllPrompts(project, items) {
  const header = projectContext(project)
  const list = items.map((it, i) => `${i + 1}. ${it.text}`).join('\n')
  const body = `Here's everything I want you to do:\n\n${list}`
  return header ? `${header}\n\n${body}` : body
}

export function hasContext(project) {
  return !!(project?.why || project?.context || project?.liveUrl || project?.repoUrl)
}

/* Bygg en repo-vennlig `TASKS.md`: prosjektkontekst + alle steg som en
   avkryssbar markdown-liste, gruppert på prioritet. Legges i prosjektets repo
   så et kode-verktøy (Claude/Codex) leser oppgavene automatisk hver økt. */
const TASK_GROUPS = [
  ['now', 'Høy prioritet'],
  ['next', 'Medium'],
  ['later', 'Lav'],
  ['done', 'Ferdig'],
]
export function buildTaskList(project, items = []) {
  const lines = [`# ${project?.name || 'Prosjekt'} — oppgaver`, '']
  if (project?.why) lines.push(`> ${project.why}`, '')
  const meta = []
  if (project?.liveUrl) meta.push(`Live: ${project.liveUrl}`)
  if (project?.repoUrl) meta.push(`Repo: ${project.repoUrl}`)
  if (meta.length) lines.push(meta.join(' · '), '')
  if (project?.context) lines.push(`**Kontekst:** ${project.context}`, '')
  lines.push('_Vedlikeholdes i Fabipilot. Jobb gjennom de åpne punktene under._')

  for (const [stage, label] of TASK_GROUPS) {
    const inStage = items.filter((i) => i.stage === stage)
    if (!inStage.length) continue
    lines.push('', `## ${label}`)
    for (const it of inStage) {
      lines.push(`- [${stage === 'done' ? 'x' : ' '}] ${it.text}`)
      if (it.result) lines.push(`  - ${it.result}`)
    }
  }
  return lines.join('\n')
}

/* ── Kontekst-rike «oppskrifter» ──────────────────────────────────────────
   Ferdige prompts som pakker HELE prosjektet (mål, lenker, status, åpne steg)
   inn i én velformet forespørsel — ett klikk, ingen utfylling. Dette er
   forskjellen på Fabipilot og en generisk gjøremålsliste: konteksten følger
   alltid med til Claude/Codex. Rene funksjoner, testet i prompts.test.js. */

import { projectHealth, HEALTH_STATUS_EN } from './projectHealth.js'

const STAGE_EN = { now: 'High', next: 'Medium', later: 'Low' }

/* Fyldig prosjektbrief: kontekst + avledet status + åpne/ferdige steg.
   `items` = projectItems ({text, stage}). Legges foran hver oppskrift. */
export function projectBrief(project, items = []) {
  const lines = [projectContext(project)].filter(Boolean)
  const health = projectHealth(project, items)
  lines.push(`Status: ${HEALTH_STATUS_EN[health.state]}`)
  lines.push(`Progress: ${health.doneCount}/${items.length} steps done`)

  const open = items.filter((i) => i.stage !== 'done')
  if (open.length) {
    const byPrio = [...open].sort(
      (a, b) => ('now next later'.indexOf(a.stage) - 'now next later'.indexOf(b.stage)),
    )
    lines.push('')
    lines.push('Open steps:')
    for (const it of byPrio) lines.push(`- [${STAGE_EN[it.stage] || '?'}] ${it.text}`)
  }
  return lines.join('\n')
}

/* Grupper oppskriftene etter bruksområde (vises som seksjoner i UI-et). */
export const RECIPE_GROUPS = ['Kvalitet', 'Arkitektur', 'Lansering']

export const PROJECT_RECIPES = [
  {
    key: 'review', emoji: '🔎', label: 'Brutal review', group: 'Kvalitet',
    ask: 'Give me a brutally honest product + code review of this project. Be specific, not polite. Cover: what is weak or confusing, what would make a real user bounce, the biggest risk, and the 3 highest-impact things to fix next. End with a prioritized action list.',
  },
  {
    key: 'ui', emoji: '✨', label: 'UI/UX-løft', group: 'Kvalitet',
    ask: 'Review the UI/UX of this project and propose specific, high-impact upgrades: visual hierarchy, spacing, typography, component states (empty/loading/error), and mobile. Prioritize changes that make it feel more premium and focused — no full redesign. Give a concrete before/after list ordered by impact.',
  },
  {
    key: 'bughunt', emoji: '🐛', label: 'Bug-jakt', group: 'Kvalitet',
    ask: 'Hunt for likely bugs and edge cases: empty/invalid input, race conditions, off-by-one errors, error/loading states, and mobile behavior. For each, give the failing scenario and a minimal fix.',
  },
  {
    key: 'cleanup', emoji: '🧹', label: 'Rydd koden', group: 'Kvalitet',
    ask: 'Review the codebase for cleanup opportunities: dead code, duplication, oversized files, weak naming, and inconsistent patterns. Propose a safe, incremental cleanup plan ordered by risk/reward. Do not suggest a rewrite.',
  },
  {
    key: 'schema', emoji: '🗄️', label: 'Datamodell', group: 'Arkitektur',
    ask: 'Review the data model / database schema for this project. Flag missing indexes, denormalization risks, unsafe migrations, and validation gaps. Suggest concrete improvements that preserve existing data.',
  },
  {
    key: 'refactor', emoji: '♻️', label: 'Refaktor-plan', group: 'Arkitektur',
    ask: 'Propose a refactor plan for the riskiest or most tangled part of this codebase. Break it into small, independently shippable steps, each safe to merge on its own. Call out what could break and how to verify each step.',
  },
  {
    key: 'launch', emoji: '🚀', label: 'Launch-sjekk', group: 'Lansering',
    ask: 'Act as a launch checklist. Assess how close this project is to being shippable and list exactly what is left before I can launch it publicly — grouped into Must-fix, Should-fix, and Nice-to-have. Include product, UX, performance, and basic SEO/meta. Be concrete.',
  },
  {
    key: 'landing', emoji: '📣', label: 'Landingstekst', group: 'Lansering',
    ask: 'Write landing page copy for this project: a sharp headline, a one-sentence subheadline, 3 benefit bullets, and a call to action. Match the goal above. Avoid generic startup clichés — make it concrete and specific to what this actually does.',
  },
  {
    key: 'growth', emoji: '📈', label: 'Vekst-ideer', group: 'Lansering',
    ask: 'Suggest 5 concrete, low-effort ways to get the first real users for this project, given its goal and audience. Prefer specific channels and tactics over vague advice. Rank them by effort vs. likely payoff.',
  },
]

/* «Anbefalt neste prompt» ut fra prosjektets helse-tilstand — appen vet hva
   du bør spørre AI om nå. Nøkkelen peker inn i PROJECT_RECIPES. */
export const RECOMMENDED_RECIPE = {
  empty: 'review',
  building: 'bughunt',
  stuck: 'review',
  ready: 'launch',
  shipped: 'growth',
  onice: 'review',
}

export function recommendedRecipe(healthState) {
  const key = RECOMMENDED_RECIPE[healthState] || 'review'
  return PROJECT_RECIPES.find((r) => r.key === key)
}

/* Bygg en ferdig oppskrift-prompt for ett prosjekt. */
export function buildRecipe(recipeKey, project, items = []) {
  const recipe = PROJECT_RECIPES.find((r) => r.key === recipeKey)
  if (!recipe) return ''
  const brief = projectBrief(project, items)
  return `${brief}\n\n---\n${recipe.ask}`
}
