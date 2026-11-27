import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BrandLogo } from './BrandLogo'
import { cn } from '@/lib/utils'

/** Mobile menu + brand. Account controls live in the sidebar footer. */
export function TopBar({ theme, onOpenMenu, menuOpen, menuButtonRef, leading }) {
  return (
    <header className={cn('sticky top-0 z-30 flex items-center gap-3', theme.topbar)}>
      <Button
        ref={menuButtonRef}
        variant="ghost"
        size="icon"
        className="-ml-1.5 lg:hidden"
        onClick={onOpenMenu}
        aria-label="Open navigation menu"
        aria-expanded={menuOpen}
        aria-haspopup="dialog"
      >
        <Menu className="size-5" />
      </Button>

      {leading ?? <BrandLogo size="sm" className="min-w-0 lg:hidden" />}
    </header>
  )
}
