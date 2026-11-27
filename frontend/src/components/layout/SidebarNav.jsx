import { NavLink } from 'react-router-dom'
import { Globe } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { localTimeZoneLabel } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Brand + primary navigation + timezone note. Themed through `theme.sidebar*`. */
export function SidebarNav({ nav, theme, areaLabel, onNavigate }) {
  const tz = localTimeZoneLabel()
  return (
    <div className={cn('flex h-full flex-col', theme.sidebarPadding)}>
      <div className={cn('px-1', onNavigate && 'pr-10')}>
        <BrandLogo size="sm" variant={theme.onDark ? 'onDark' : 'default'} />
        <p className={cn('mt-3 px-1 text-xs font-semibold uppercase tracking-widest', theme.areaLabel)}>{areaLabel}</p>
      </div>

      <nav aria-label={`${areaLabel} navigation`} className={cn('mt-4 flex flex-col', theme.navGap)}>
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center gap-3 rounded-md px-3 font-medium transition-colors',
                theme.navItem,
                isActive ? theme.navActive : theme.navIdle,
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && <span aria-hidden="true" className={cn('absolute inset-y-2 left-0 w-1 rounded-full', theme.navMarker)} />}
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <p className={cn('mt-auto flex items-start gap-2 px-2 pt-6 text-xs leading-relaxed', theme.footer)}>
        <Globe className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>Dates and times are shown in your local timezone{tz ? ` (${tz})` : ''}.</span>
      </p>
    </div>
  )
}
