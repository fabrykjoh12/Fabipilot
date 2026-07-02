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
