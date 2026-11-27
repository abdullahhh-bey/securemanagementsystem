import { Link } from 'react-router-dom'
import { ArrowRight, Clock3, Medal } from 'lucide-react'
import { Badge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useCandidateResults } from '@/hooks/useStudentPortal'
import { formatDateTime } from '@/lib/format'

const number = (value) => (value === null || value === undefined ? null : Number(value))

export default function CandidateResultsPage() {
  const query = useCandidateResults()
  const results = [...(query.data ?? [])].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))

  return (
    <>
      <PageHeader title="Results" description="Your published exam scores and result status." />
      {query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} isRetrying={query.isRefetching} title="We couldn't load your results" />
      ) : query.isPending ? (
        <div className="space-y-4" role="status">
          <span className="sr-only">Loading published results</span>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          icon={Clock3}
          title="No results published yet"
          description="When your examiner releases a result, it will appear here with your score and publication date."
          action={
            <Button asChild variant="secondary">
              <Link to="/candidate/exams">Browse your exams <ArrowRight /></Link>
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {results.map((result) => {
            const obtained = number(result.obtainedMarks)
            const total = number(result.totalMarks)
            const percent = obtained !== null && total ? Math.round((obtained / total) * 100) : null
            const title = result.attempt?.exam?.title ?? 'Exam result'
            const hasDispute = (result.disputes ?? []).length > 0
            return (
              <Card key={result.id} as="article" className="overflow-hidden">
                <CardContent className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                  <div className="flex min-w-0 items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-success-soft text-success" aria-hidden="true">
                      <Medal className="size-5" />
                    </span>
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-semibold">{title}</h2>
                      <p className="mt-1 text-sm text-muted">
                        Published {formatDateTime(result.publishedAt)}
                        {result.attempt?.attemptNumber ? ` · Attempt ${result.attempt.attemptNumber}` : ''}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Badge tone={result.status === 'PUBLISHED' ? 'success' : 'neutral'}>
                          {String(result.status).replaceAll('_', ' ').toLowerCase()}
                        </Badge>
                        {hasDispute && <Badge tone="info">Dispute submitted</Badge>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-5 border-t border-border pt-4 sm:border-0 sm:pt-0">
                    <div className="text-right">
                      <p className="num text-2xl font-bold">
                        {obtained === null ? 'Pending' : `${obtained} / ${total}`}
                      </p>
                      <p className="text-xs text-muted">{percent === null ? 'Score unavailable' : `${percent}%`}</p>
                    </div>
                    {!hasDispute && (
                      <Button asChild variant="secondary" size="sm">
                        <Link to={`/candidate/disputes?resultId=${encodeURIComponent(result.id)}`}>Raise dispute</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
