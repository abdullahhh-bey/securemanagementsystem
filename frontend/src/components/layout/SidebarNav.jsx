import { useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, KeyRound, LogOut } from 'lucide-react'
import { BrandLogo } from './BrandLogo'
import { Button } from '@/components/ui/button'
import { RoleChip } from '@/components/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { userDisplayName } from '@/lib/schema'
import { initials, cn } from '@/lib/utils'

function NavItem({ item, theme, onNavigate }) {
  const { to, label, icon: Icon, end, children } = item
  const location = useLocation()
  const hasChildren = Array.isArray(children) && children.length > 0
  const childActive = hasChildren && children.some((c) => location.pathname === c.to || location.pathname.startsWith(`${c.to}/`))
  const [open, setOpen] = useState(childActive)

  if (!hasChildren) {
    return (
      <NavLink
        to={to}
        end={end}
        onClick={onNavigate}
        className={({ isActive }) =>
          cn('group relative flex items-center gap-3 rounded-md px-3 font-medium transition-colors', theme.navItem, isActive ? theme.navActive : theme.navIdle)
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
    )
  }

  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'group relative flex w-full items-center gap-3 rounded-md px-3 text-left font-medium transition-colors',
          theme.navItem,
          childActive ? theme.navActive : theme.navIdle,
        )}
      >
        {childActive && <span aria-hidden="true" className={cn('absolute inset-y-2 left-0 w-1 rounded-full', theme.navMarker)} />}
        <Icon className="size-5 shrink-0" aria-hidden="true" />
        <span className="flex-1">{label}</span>
        <ChevronDown className={cn('size-4 shrink-0 transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && (
        <div className="ml-3 flex flex-col gap-0.5 border-l border-current/15 pl-2">
          {children.map((child) => (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.end}
              onClick={onNavigate}
              className={({ isActive }) =>
                cn('rounded-md px-3 py-2 text-sm font-medium transition-colors', isActive ? theme.navActive : theme.navIdle)
              }
            >
              {child.label}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function SidebarAccount({ theme, changePasswordTo }) {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)
  const name = userDisplayName(user)

  const handleLogout = async () => {
    setPending(true)
    try {
      await logout()
      navigate('/login', { replace: true })
    } catch (error) {
      toast.error(error.message)
      setPending(false)
    }
  }

  if (!user) return null

  return (
    <div className={cn('mt-auto space-y-3 pt-4', theme.account)}>
      <div className="flex items-center gap-2.5 px-1 pt-3">
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
            theme.onDark ? 'bg-on-dark/15 text-on-dark' : 'bg-sky text-primary-hover',
          )}
          aria-hidden="true"
        >
          {initials(name)}
        </span>
        <div className="min-w-0">
          <p className={cn('truncate text-sm font-semibold leading-tight', theme.accountName)}>{name}</p>
          <div className="mt-1">
            <RoleChip role={user.role} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {changePasswordTo && (
          <Button
            variant="ghost"
            size="sm"
            className={cn('w-full justify-start', theme.navIdle)}
            onClick={() => navigate(changePasswordTo)}
          >
            <KeyRound />
            Change password
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn('w-full justify-start', theme.navIdle)}
          onClick={handleLogout}
          loading={pending}
          loadingLabel="Signing out…"
        >
          {!pending && <LogOut />}
          Log out
        </Button>
      </div>
    </div>
  )
}

/** Brand + navigation + account controls. */
export function SidebarNav({ nav, theme, areaLabel, onNavigate, changePasswordTo }) {
  return (
    <div className={cn('flex h-full flex-col', theme.sidebarPadding)}>
      <div className={cn('px-1', onNavigate && 'pr-10')}>
        <BrandLogo size="sm" variant={theme.onDark ? 'onDark' : 'default'} />
        <p className={cn('mt-3 px-1 text-xs font-semibold uppercase tracking-widest', theme.areaLabel)}>{areaLabel}</p>
      </div>

      <nav aria-label={`${areaLabel} navigation`} className={cn('mt-4 flex flex-col', theme.navGap)}>
        {nav.map((item) => (
          <NavItem key={item.to ?? item.label} item={item} theme={theme} onNavigate={onNavigate} />
        ))}
      </nav>

      <SidebarAccount theme={theme} changePasswordTo={changePasswordTo} />
    </div>
  )
}
