import { BookOpenCheck } from 'lucide-react'
import { AppShell } from '@/components/layout/AppShell'

const NAV = [{ to: '/candidate', label: 'My Exams', icon: BookOpenCheck }]

/** Candidate: lighter and more spacious - paper-coloured chrome, larger type and targets. */
const THEME = {
  page: 'bg-background',
  gridCols: 'lg:grid-cols-[272px_minmax(0,1fr)]',
  sidebar: 'bg-background text-ink',
  sidebarPadding: 'p-6 py-8',
  onDark: false,
  areaLabel: 'text-muted',
  navGap: 'gap-2',
  navItem: 'h-12 text-base',
  navActive: 'border border-border bg-surface text-ink',
  navIdle: 'border border-transparent text-muted hover:bg-sunken hover:text-ink',
  navMarker: 'bg-primary',
  footer: 'text-muted',
  closeButton: 'text-muted hover:bg-sunken hover:text-ink',
  topbar: 'h-20 bg-background',
  content: 'max-w-4xl px-4 pb-16 pt-6 sm:px-8 lg:px-12',
}

export default function CandidateLayout() {
  return <AppShell nav={NAV} areaLabel="Candidate portal" theme={THEME} />
}
