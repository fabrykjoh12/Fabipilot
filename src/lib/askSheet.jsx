import { useState } from 'react'
import AskSheet from '../components/AskSheet.jsx'

/* Spør om ETT tall eller ETT ja/nei, i et ark som ser ut som resten av appen.
   Erstatter `window.prompt` / `window.confirm` — de native dialogene kan ikke
   styles, ser ut som feilmeldinger på mobil og bryter med alt rundt.

     const { ask, confirm, sheet } = useAskSheet()
     <button onClick={() => ask({ title: 'Hvor mye?', suffix: 'kr', onSave: v => … })} />
     {sheet}
*/
export function useAskSheet() {
  const [cfg, setCfg] = useState(null)
  // Egen nøkkel så feltet nullstilles helt når arket åpnes på nytt med nye verdier.
  const [key, setKey] = useState(0)
  const open = (next) => { setKey((k) => k + 1); setCfg(next) }
  return {
    ask: (c) => open({ ...c, kind: 'ask' }),
    confirm: (c) => open({ ...c, kind: 'confirm' }),
    sheet: cfg ? <AskSheet key={key} cfg={cfg} onClose={() => setCfg(null)} /> : null,
  }
}
