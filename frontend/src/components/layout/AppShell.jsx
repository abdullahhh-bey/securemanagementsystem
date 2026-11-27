import { useEffect, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { SidebarNav } from './SidebarNav'
import { SkipLink } from './SkipLink'
import { TopBar } from './TopBar'
import { cn } from '@/lib/utils'

/**
 * Shared frame for the three role layouts. A layout only supplies `nav`,
 * `areaLabel` and a `theme` (see src/layouts) - structure, landmarks, the
 * mobile drawer and focus handling live here once.
 */
export function AppShell({ nav, areaLabel, theme }) {
  const { pathname } = useLocation()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const mainRef = useRef(null)
  const firstRender = useRef(true)
  const menuButtonRef = useRef(null)
  const navigated = useRef(false)

  // After client-side navigation: close the drawer, scroll up, move focus to <main>.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setDrawerOpen(false)
    window.scrollTo(0, 0)
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <div className={cn('min-h-dvh', theme.page)}>
      <SkipLink />
      <div className={cn('grid min-h-dvh grid-cols-1', theme.gridCols)}>
        <aside className={cn('sticky top-0 hidden h-dvh overflow-y-auto lg:block', theme.sidebar)}>
          <SidebarNav nav={nav} theme={theme} areaLabel={areaLabel} />
        </aside>

        <div className="flex min-w-0 flex-col">
          <TopBar theme={theme} onOpenMenu={() => setDrawerOpen(true)} menuOpen={drawerOpen} menuButtonRef={menuButtonRef} />
          <main
            id="main-content"
            ref={mainRef}
            tabIndex={-1}
            className={cn('mx-auto w-full flex-1', theme.content)}
          >
            <Outlet />
          </main>
        </div>
      </div>

      <DialogPrimitive.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogPrimitive.Portal>
          <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/50 animate-[fade-in_150ms_ease-out] lg:hidden" />
          <DialogPrimitive.Content
            aria-describedby={undefined}
            onCloseAutoFocus={(event) => {
              // Return focus to the menu button, unless the drawer closed because of navigation (focus goes to <main>).
              event.preventDefault()
              if (navigated.current) navigated.current = false
              else menuButtonRef.current?.focus()
            }}
            className={cn(
              'fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] overflow-y-auto animate-[slide-in-left_200ms_ease-out] lg:hidden',
              theme.sidebar,
            )}
          >
            <DialogPrimitive.Title className="sr-only">{areaLabel} menu</DialogPrimitive.Title>
            <SidebarNav nav={nav} theme={theme} areaLabel={areaLabel} onNavigate={() => {
              navigated.current = true
              setDrawerOpen(false)
            }} />
            <DialogPrimitive.Close
              aria-label="Close navigation menu"
              className={cn('absolute right-3 top-4 inline-flex size-9 items-center justify-center rounded-md', theme.closeButton)}
            >
              <X className="size-5" aria-hidden="true" />
            </DialogPrimitive.Close>
          </DialogPrimitive.Content>
        </DialogPrimitive.Portal>
      </DialogPrimitive.Root>
    </div>
  )
}
