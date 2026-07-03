import SharedListView from './SharedListView.jsx'

export default function ShoppingList() {
  return (
    <SharedListView
      list="handleliste"
      title="Handleliste"
      placeholder="Legg til i handlelista…"
      emptyGlyph="🛒"
      emptyTitle="Handlelista er tom"
      emptyHint="Legg til det du trenger fra butikken nederst — og trykk «Del» for å invitere."
    />
  )
}
