import { ClipboardList, LayoutDashboard } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'

const NAV = [
  { to: '/examiner', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/examiner/exams', label: 'My Exams', icon: ClipboardList },
]

/** Examiner: working surface - white sidebar, teal active marker. */
const THEME = {
  page: 'bg-background',
  gridCols: 'lg:grid-cols-[256px_minmax(0,1fr)]',
  sidebar: 'border-r border-border bg-surface text-ink',
  sidebarPadding: 'p-4 py-6',
  onDark: false,
  areaLabel: 'text-muted',
  navGap: 'gap-1',
  navItem: 'h-10 text-sm',
  navActive: 'bg-primary-soft text-primary-hover',
  navIdle: 'text-ink/80 hover:bg-sunken hover:text-ink',
  navMarker: 'bg-primary',
  footer: 'text-muted',
  closeButton: 'text-muted hover:bg-sunken hover:text-ink',
  topbar: 'h-16 border-b border-border bg-surface',
  content: 'max-w-6xl px-4 py-8 sm:px-6 lg:px-10',
}

export default function ExaminerLayout() {
  return <AppShell nav={NAV} areaLabel="Examiner workspace" theme={THEME} />
}
