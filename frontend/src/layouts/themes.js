/**
 * Visual themes for AppShell. A theme is only class names (from the tokens),
 * so changing the palette never touches this file.
 */

/** Admin and Examiner: navy sidebar, white top bar. */
export const NAVY_THEME = {
  page: 'bg-background',
  gridCols: 'lg:grid-cols-[256px_minmax(0,1fr)]',
  sidebar: 'on-ink bg-navy text-on-dark',
  sidebarPadding: 'p-4 py-6',
  onDark: true,
  areaLabel: 'text-on-dark/70',
  navGap: 'gap-1',
  navItem: 'h-10 text-sm',
  navActive: 'bg-navy-active text-on-dark',
  navIdle: 'text-on-dark/80 hover:bg-navy-hover hover:text-on-dark',
  navMarker: 'bg-ring-on-dark', // brand-blue tint: plain brand-blue is only 1.4:1 on the selected navy item
  footer: 'text-on-dark/70',
  closeButton: 'text-on-dark/80 hover:bg-navy-hover hover:text-on-dark',
  topbar: 'h-16 border-b border-border bg-surface',
  content: 'max-w-6xl px-4 py-8 sm:px-6 lg:px-10',
}

/** Candidate: lighter and more spacious - white sidebar and top bar, larger targets. */
export const CANDIDATE_THEME = {
  page: 'bg-background',
  gridCols: 'lg:grid-cols-[272px_minmax(0,1fr)]',
  sidebar: 'border-r border-border bg-surface text-ink',
  sidebarPadding: 'p-6 py-8',
  onDark: false,
  areaLabel: 'text-muted',
  navGap: 'gap-2',
  navItem: 'h-12 text-base',
  navActive: 'bg-sky text-primary-hover',
  navIdle: 'text-muted hover:bg-sunken hover:text-ink',
  navMarker: 'bg-primary',
  footer: 'text-muted',
  closeButton: 'text-muted hover:bg-sunken hover:text-ink',
  topbar: 'h-20 border-b border-border bg-surface',
  content: 'max-w-4xl px-4 pb-12 pt-8 sm:px-8 lg:px-12',
}
