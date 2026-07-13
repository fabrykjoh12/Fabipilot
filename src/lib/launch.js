// Launch-beredskap — ren funksjon, ingen React/Dexie.
// Utleder en konkret «hva gjenstår før jeg kan lansere»-sjekkliste fra
// prosjektet + stegene, uten å endre noe lagret. Komplementær til
// projectHealth (utledet status) og launch-sjekk-oppskriften (spør Claude).

/**
 * Bygg launch-sjekklisten for ett prosjekt.
 * Hver sjekk: { key, label, done, hint } — `hint` vises kun når `done` er false.
 * Returnerer også { doneCount, total, pct, ready }.
 */
export function launchChecklist(project, items = []) {
  const open = items.filter((i) => i.stage !== 'done')
  const openNow = open.filter((i) => i.stage === 'now')

  const checks = [
    {
      key: 'why',
      label: 'Mål satt',
      done: !!project?.why,
      hint: 'Legg til hvorfor prosjektet betyr noe.',
    },
    {
      key: 'steps',
      label: 'Roadmap har steg',
      done: items.length > 0,
      hint: 'Legg til minst ett steg på tavla.',
    },
    {
      key: 'context',
      label: 'Claude-kontekst',
      done: !!project?.context,
      hint: 'Legg inn stack & konvensjoner — blir med i hver prompt.',
    },
    {
      key: 'repo',
      label: 'Repo-lenke',
      done: !!project?.repoUrl,
      hint: 'Lim inn GitHub-lenken.',
    },
    {
      key: 'live',
      label: 'Live-lenke (deployet)',
      done: !!project?.liveUrl,
      hint: 'Deploy og lim inn URL-en.',
    },
    {
      key: 'nohigh',
      label: 'Ingen åpne høy-prioritet steg',
      done: openNow.length === 0,
      hint: `${openNow.length} høy-prioritet ${openNow.length === 1 ? 'steg' : 'steg'} gjenstår.`,
    },
    {
      key: 'allsteps',
      label: 'Alle steg ferdig',
      done: items.length > 0 && open.length === 0,
      hint: items.length === 0 ? 'Ingen steg enda.' : `${open.length} steg gjenstår.`,
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
  }
}
