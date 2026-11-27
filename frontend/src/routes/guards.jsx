import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'
import { roleHome } from '@/lib/constants'
import ForbiddenPage from '@/pages/errors/ForbiddenPage'

export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-background" role="status">
      <BrandLogo size="md" />
      <div className="flex w-56 flex-col gap-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-3/4" />
      </div>
      <span className="sr-only">Loading your session</span>
    </div>
  )
}

/** Renders its children (or nested routes) only for signed-in users with an allowed role. */
export function ProtectedRoute({ allowedRoles, children }) {
  const { user, status, error, retry } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <FullPageLoader />
  if (status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background p-6">
        <ErrorState error={error} onRetry={retry} title="We couldn't check your session" />
      </div>
    )
  }
  if (status === 'unauthenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />
  if (allowedRoles && !allowedRoles.includes(user.role)) return <ForbiddenPage />
  return children ?? <Outlet />
}

/** The login page is for signed-out users only. */
export function PublicOnlyRoute({ children }) {
  const { user, status } = useAuth()
  if (status === 'loading') return <FullPageLoader />
  if (status === 'authenticated') return <Navigate to={roleHome(user.role)} replace />
  return children ?? <Outlet />
}

/** "/" sends everyone to their own home. */
export function RootRedirect() {
  const { user, status } = useAuth()
  if (status === 'loading') return <FullPageLoader />
  return <Navigate to={status === 'authenticated' ? roleHome(user.role) : '/login'} replace />
}
