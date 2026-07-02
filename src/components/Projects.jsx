import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getProject } from '../db.js'
import ProjectsList from './projects/ProjectsList.jsx'
import Roadmap from './projects/Roadmap.jsx'

/* Tynn ruter: liste ↔ prosjekt-arbeidsbenk. Selve komponentene bor i ./projects/. */
export default function Projects() {
  const [selectedId, setSelectedId] = useState(null)
  const exists = useLiveQuery(
    () => (selectedId ? getProject(selectedId) : null),
    [selectedId],
    undefined,
  )

  if (selectedId && exists) {
    return <Roadmap projectId={selectedId} onBack={() => setSelectedId(null)} />
  }
  return <ProjectsList onOpen={setSelectedId} />
}
