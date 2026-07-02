import { ICONS } from '../lib/icons.js'

export default function NavIcon({ name }) {
  const Ic = ICONS[name] || ICONS.more
  return <Ic aria-hidden="true" strokeWidth={2} />
}
