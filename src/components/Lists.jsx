import { useState } from 'react'
import { motion } from 'motion/react'
import SharedListView from './SharedListView.jsx'

/* «Lister» — «Delt» og «Handleliste» i én modul.

   De to var separate moduler i menyen, men er samme tabell i samme delte realm,
   bare filtrert på `list`-nøkkelen — og de deles automatisk med de samme
   personene. To menyplasser for én ting er én for mye, særlig i «Mer» der
   plassen er knapp. Faner i stedet: samme innhold, halve navigasjonskostnaden. */

const TABS = [
  {
    k: 'general',
    label: 'Delt',
    props: {
      list: 'general',
      title: 'Lister',
      placeholder: 'Legg til i delt liste…',
      emptyTitle: 'Ingenting delt enda',
      emptyHint: 'Legg til noe nederst — ting å huske sammen — og trykk «Del» for å invitere.',
    },
  },
  {
    k: 'handleliste',
    label: 'Handleliste',
    props: {
      list: 'handleliste',
      title: 'Lister',
      placeholder: 'Legg til i handlelista…',
      emptyTitle: 'Handlelista er tom',
      emptyHint: 'Legg til det du trenger fra butikken nederst — og trykk «Del» for å invitere.',
    },
  },
]

export default function Lists() {
  const [tab, setTab] = useState('general')
  const active = TABS.find((t) => t.k === tab)

  const tabs = (
    <div className="money-tabs lists-tabs">
      {TABS.map((t) => (
        <button key={t.k} type="button" className={tab === t.k ? 'active' : ''} onClick={() => setTab(t.k)}>
          {tab === t.k && (
            <motion.span
              className="seg-pill"
              layoutId="lists-tab-pill"
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            />
          )}
          <span className="seg-lbl">{t.label}</span>
        </button>
      ))}
    </div>
  )

  // `key` tvinger fersk state når du bytter fane — ellers henger inntastet tekst igjen.
  return <SharedListView key={tab} {...active.props} tabs={tabs} />
}
