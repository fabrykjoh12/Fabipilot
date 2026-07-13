// Launch-beredskap — ren funksjon, ingen React/Dexie.
// Utleder en konkret «hva gjenstår før jeg kan lansere»-sjekkliste fra
// prosjektet + stegene, uten å endre noe lagret. Komplementær til
// projectHealth (utledet status) og launch-sjekk-oppskriften (spør Claude).

/**
 * Bygg launch-sjekklisten for ett prosjekt.
 * Hver sjekk: { key, action, label, cta, done, hint }
 *   - `action` — hva UI-et skal gjøre når punktet trykkes (Roadmap mapper det til en handler)
 *   - `cta`    — kort handlingsknapp-tekst for uløste punkter
 *   - `hint`   — vises kun når `done` er false
 * Returnerer også { doneCount, total, pct, ready, firstUnmet }.
 */
export function launchChecklist(project, items = []) {
  const open = items.filter((i) => i.stage !== 'done')
  const openNow = open.filter((i) => i.stage === 'now')

  const checks = [
    {
      key: 'why',
      action: 'why',
      label: 'Målet er satt',
      cta: 'Skriv mål',
      done: !!project?.why,
      hint: 'Hva skal dette prosjektet oppnå?',
    },
    {
      key: 'steps',
      action: 'board',
      label: 'Roadmap har et byggesteg',
      cta: 'Legg til steg',
      done: items.length > 0,
      hint: 'Prosjektet trenger et konkret neste byggesteg.',
    },
    {
      key: 'context',
      action: 'context',
      label: 'Claude-kontekst er lagt inn',
      cta: 'Legg inn kontekst',
      done: !!project?.context,
      hint: 'Stack & konvensjoner — blir med i hver prompt.',
    },
    {
      key: 'repo',
      action: 'links',
      label: 'Repo-lenke',
      cta: 'Lim inn repo',
      done: !!project?.repoUrl,
      hint: 'Koble på GitHub-repoet.',
    },
    {
      key: 'live',
      action: 'links',
      label: 'Live-lenke (deployet)',
      cta: 'Lim inn URL',
      done: !!project?.liveUrl,
      hint: 'Deploy og lim inn den offentlige URL-en.',
    },
    {
      key: 'nohigh',
      action: 'board',
      label: 'Ingen åpne høy-prioritet steg',
      cta: 'Gå til tavla',
      done: openNow.length === 0,
      hint: `${openNow.length} høy-prioritet ${openNow.length === 1 ? 'steg stopper' : 'steg stopper'} launch.`,
    },
    {
      key: 'allsteps',
      action: 'board',
      label: 'Alle steg er ferdige',
      cta: 'Gå til tavla',
      done: items.length > 0 && open.length === 0,
      hint: items.length === 0 ? 'Ingen steg enda.' : `${open.length} steg gjenstår før alt er bygd.`,
    },
  ]

  const doneCount = checks.filter((c) => c.done).length
  const total = checks.length
  return {
    checks,
    doneCount,
    total,
    pct: Math.round((doneCount / total) * 100),
    ready: doneCount === total,
    firstUnmet: checks.find((c) => !c.done) || null,
  }
}
