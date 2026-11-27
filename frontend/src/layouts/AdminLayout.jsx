import { LayoutDashboard, Users } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'

const NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/users', label: 'Users', icon: Users },
]

/** Admin: dense and authoritative - deep ink sidebar. */
const THEME = {
  page: 'bg-background',
  gridCols: 'lg:grid-cols-[256px_minmax(0,1fr)]',
  sidebar: 'on-ink bg-ink text-white',
  sidebarPadding: 'p-4 py-6',
  onDark: true,
  areaLabel: 'text-white/60',
  navGap: 'gap-1',
  navItem: 'h-10 text-sm',
  navActive: 'bg-white/12 text-white',
  navIdle: 'text-white/75 hover:bg-white/8 hover:text-white',
  navMarker: 'bg-[#7dd3c8]',
  footer: 'text-white/65',
  closeButton: 'text-white/80 hover:bg-white/10 hover:text-white',
  topbar: 'h-16 border-b border-border bg-surface',
  content: 'max-w-6xl px-4 py-8 sm:px-6 lg:px-10',
}

export default function AdminLayout() {
  return <AppShell nav={NAV} areaLabel="Administration" theme={THEME} />
}
