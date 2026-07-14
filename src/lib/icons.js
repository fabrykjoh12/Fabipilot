import {
  LayoutGrid,
  Sun,
  CalendarDays,
  Compass,
  Lightbulb,
  Repeat,
  Wallet,
  FolderKanban,
  Users,
  ShoppingCart,
  CloudUpload,
  MoreHorizontal,
  Flower2,
  Briefcase,
} from 'lucide-react'

/* Lucide-ikoner per modul (konsistent, premium ikonsett). Delt mellom
   hovednavigasjonen og innloggingsskjermens funksjonsliste. */
export const ICONS = {
  overview: LayoutGrid,
  today: Sun,
  calendar: CalendarDays,
  whatnow: Compass,
  ideas: Lightbulb,
  habits: Repeat,
  money: Wallet,
  projects: FolderKanban,
  shared: Users,
  shopping: ShoppingCart,
  work: Briefcase,
  garden: Flower2,
  backup: CloudUpload,
  more: MoreHorizontal,
}
