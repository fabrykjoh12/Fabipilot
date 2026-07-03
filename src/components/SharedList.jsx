import SharedListView from './SharedListView.jsx'

export default function SharedList() {
  return (
    <SharedListView
      list="general"
      title="Delt liste"
      placeholder="Legg til i delt liste…"
      emptyGlyph="🤝"
      emptyTitle="Ingenting delt enda"
      emptyHint="Legg til noe nederst — ting å huske sammen — og trykk «Del» for å invitere."
    />
  )
}
