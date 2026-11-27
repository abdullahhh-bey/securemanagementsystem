import { BrandLogo } from './BrandLogo'
import { cn } from '@/lib/utils'

/**
 * Minimal header for pages without the app shell. Not routed yet: it is the
 * slot for the public /verify page (and anything similar) in a later part.
 * `children` renders on the right (links, actions).
 */
export function PublicHeader({ children, className }) {
  return (
    <header className={cn('flex h-16 items-center justify-between gap-4 border-b border-border bg-surface px-4 sm:px-6 lg:px-10', className)}>
      <BrandLogo size="sm" />
      {children}
    </header>
  )
}
