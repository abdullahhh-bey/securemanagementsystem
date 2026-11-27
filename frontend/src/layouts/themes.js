/**
 * Visual themes for AppShell. Class names only (from design tokens).
 */

const CONTENT_PAD = 'px-4 py-6 sm:px-6 lg:px-8'
const TOPBAR_PAD = 'px-4 sm:px-6 lg:px-8'

/** Admin and Teacher: navy sidebar, white top bar. */
export const NAVY_THEME = {
  page: 'bg-background',
  gridCols: 'lg:grid-cols-[248px_minmax(0,1fr)]',
  sidebar: 'on-ink bg-navy text-on-dark',
  sidebarPadding: 'px-3 py-5',
  onDark: true,
  areaLabel: 'text-on-dark/70',
  navGap: 'gap-0.5',
  navItem: 'h-10 text-sm',
  navActive: 'bg-navy-active text-on-dark',
  navIdle: 'text-on-dark/80 hover:bg-navy-hover hover:text-on-dark',
  navMarker: 'bg-ring-on-dark',
  footer: 'text-on-dark/70',
  account: 'border-t border-on-dark/15',
  accountName: 'text-on-dark',
  accountMeta: 'text-on-dark/65',
  closeButton: 'text-on-dark/80 hover:bg-navy-hover hover:text-on-dark',
  topbar: `h-14 border-b border-border bg-surface ${TOPBAR_PAD}`,
  content: `w-full ${CONTENT_PAD}`,
}

/** Student portal. */
export const CANDIDATE_THEME = {
  page: 'bg-background',
  gridCols: 'lg:grid-cols-[248px_minmax(0,1fr)]',
  sidebar: 'border-r border-border bg-surface text-ink',
  sidebarPadding: 'px-3 py-5',
  onDark: false,
  areaLabel: 'text-muted',
  navGap: 'gap-0.5',
  navItem: 'h-11 text-sm',
  navActive: 'bg-sky text-primary-hover',
  navIdle: 'text-muted hover:bg-sunken hover:text-ink',
  navMarker: 'bg-primary',
  footer: 'text-muted',
  account: 'border-t border-border',
  accountName: 'text-ink',
  accountMeta: 'text-muted',
  closeButton: 'text-muted hover:bg-sunken hover:text-ink',
  topbar: `h-14 border-b border-border bg-surface ${TOPBAR_PAD}`,
  content: `w-full ${CONTENT_PAD}`,
}
