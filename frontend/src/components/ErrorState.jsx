import { CircleAlert, RotateCw, ShieldAlert, WifiOff } from 'lucide-react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { useAuth } from '@/hooks/useAuth'
import { roleHome } from '@/lib/constants'

/** Friendly 403, used by the /403 page and by any view whose API call returns 403. */
export function ForbiddenState({ message, compact = false, titleAs }) {
  const { user } = useAuth()
  return (
    <EmptyState
      compact={compact}
      titleAs={titleAs}
      icon={ShieldAlert}
      title="You don't have access to this"
      description={
        message ?? "Your account doesn't have permission to view this page. If you think this is a mistake, ask an administrator."
      }
      action={
        <Button asChild variant="secondary">
          <Link to={user ? roleHome(user.role) : '/login'}>{user ? 'Back to my dashboard' : 'Go to sign in'}</Link>
        </Button>
      }
    />
  )
}

/** Failed load with a retry button. A 403 turns into the friendly access message. */
export function ErrorState({ error, onRetry, isRetrying = false, title = "We couldn't load this", compact = false }) {
  if (error?.status === 403) return <ForbiddenState message={error.message} compact={compact} />
  const offline = error?.code === 'NETWORK_ERROR'
  return (
    <EmptyState
      compact={compact}
      icon={offline ? WifiOff : CircleAlert}
      title={offline ? "You seem to be offline" : title}
      description={error?.message ?? 'Something went wrong. Please try again.'}
      action={
        onRetry && (
          <Button variant="secondary" onClick={onRetry} loading={isRetrying}>
            {!isRetrying && <RotateCw />}
            Try again
          </Button>
        )
      }
    />
  )
}
