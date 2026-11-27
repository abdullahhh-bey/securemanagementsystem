import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/EmptyState'
import { SkipLink } from '@/components/layout/SkipLink'
import { useAuth } from '@/hooks/useAuth'
import { usePageTitle } from '@/hooks/usePageTitle'
import { roleHome } from '@/lib/constants'

export default function NotFoundPage() {
  const { user } = useAuth()
  usePageTitle('Page not found')
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SkipLink />
      <main id="main-content" className="w-full max-w-lg">
        <p className="num mb-3 text-center text-sm font-semibold text-muted">Error 404</p>
        <EmptyState
          titleAs="h1"
          icon={Compass}
          title="We can't find that page"
          description="The address may be mistyped, or the page may have moved."
          action={
            <Button asChild>
              <Link to={user ? roleHome(user.role) : '/login'}>{user ? 'Back to my dashboard' : 'Go to sign in'}</Link>
            </Button>
          }
        />
      </main>
    </div>
  )
}
