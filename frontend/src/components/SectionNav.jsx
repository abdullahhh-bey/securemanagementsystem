import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

/** Compact secondary nav for splitting a module across routes. */
export function SectionNav({ items, className }) {
  return (
    <nav aria-label="Section" className={cn('mb-5 flex flex-wrap gap-1', className)}>
      {items.map(({ to, label, end }) => (
        <NavLink
          key={to + label}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              isActive ? 'bg-sky text-primary-hover' : 'text-muted hover:bg-sunken hover:text-ink',
            )
          }
        >
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
