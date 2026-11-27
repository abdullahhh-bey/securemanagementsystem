import { ForbiddenState } from '@/components/ErrorState'
import { SkipLink } from '@/components/layout/SkipLink'
import { usePageTitle } from '@/hooks/usePageTitle'

export default function ForbiddenPage() {
  usePageTitle('Access denied')
  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-6">
      <SkipLink />
      <main id="main-content" className="w-full max-w-lg">
        <p className="num mb-3 text-center text-sm font-semibold text-muted">Error 403</p>
        <ForbiddenState titleAs="h1" />
      </main>
    </div>
  )
}
