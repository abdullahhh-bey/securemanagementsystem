import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { BrandLogo } from '@/components/layout/BrandLogo'
import { ErrorState } from '@/components/ErrorState'
import { useAuth } from '@/hooks/useAuth'
import ForbiddenPage from '@/pages/errors/ForbiddenPage'

export function FullPageLoader() {
  return (
    <div
      className="grid min-h-dvh place-items-center overflow-hidden bg-background"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <span className="sr-only">Loading</span>
      <BrandLogo size="lg" className="loader-logo" />
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

/** Keep sign-in available at startup, even when a previous session is still valid. */
export function PublicOnlyRoute({ children }) {
  const { status } = useAuth()
  if (status === 'loading') return <FullPageLoader />
  return children ?? <Outlet />
}

/** Opening the app root always starts at sign-in. */
export function RootRedirect() {
  return <Navigate to="/login" replace />
}
