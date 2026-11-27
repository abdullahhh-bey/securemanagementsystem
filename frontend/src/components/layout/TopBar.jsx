import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { RoleChip } from '@/components/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { initials, cn } from '@/lib/utils'

export function TopBar({ theme, onOpenMenu, menuOpen, menuButtonRef }) {
  const { user, logout } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [pending, setPending] = useState(false)

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

  return (
    <header className={cn('sticky top-0 z-30 flex items-center gap-3 px-4 sm:px-6 lg:px-10', theme.topbar)}>
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="-ml-2 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
      >
        <Menu className="size-5" />
      </Button>

      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-3">
          <span
            className="hidden size-9 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-hover sm:flex"
            aria-hidden="true"
          >
            {initials(user?.name)}
          </span>
          <div className="flex flex-col items-end gap-1 sm:items-start">
            <span className="text-sm font-semibold leading-none">{user?.name}</span>
            <RoleChip role={user?.role} />
          </div>
        </div>
        <Button variant="secondary" size="sm" onClick={handleLogout} loading={pending}>
          {!pending && <LogOut />}
          <span className="max-sm:sr-only">Log out</span>
        </Button>
      </div>
    </header>
  )
}
