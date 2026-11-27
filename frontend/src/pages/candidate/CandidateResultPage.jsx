import { Link, useParams } from 'react-router-dom'
import { Gavel, Medal } from 'lucide-react'
import { Badge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useCandidateResults } from '@/hooks/useStudentPortal'
import { formatDateTime } from '@/lib/format'

export default function CandidateResultPage() {
  const { id } = useParams()
  const results = useCandidateResults()
  const result = results.data?.find((item) => item.id === id)

  if (results.isPending) {
    return (
      <>
        <PageHeader title="Result details" back={{ to: '/candidate/results', label: 'Results' }} />
        <Skeleton className="h-48 w-full" />
      </>
    )
  }

  if (results.error) {
    return (
      <>
        <PageHeader title="Result details" back={{ to: '/candidate/results', label: 'Results' }} />
        <ErrorState error={results.error} onRetry={results.refetch} isRetrying={results.isRefetching} />
      </>
    )
  }

  if (!result) {
    return (
      <>
        <PageHeader title="Result details" back={{ to: '/candidate/results', label: 'Results' }} />
        <EmptyState title="Result not found" description="This result may not be published or may not belong to your account." />
      </>
    )
  }

  const dispute = result.disputes?.[0]
  const obtained = result.obtainedMarks == null ? null : Number(result.obtainedMarks)
  const total = Number(result.totalMarks)

  return (
    <>
      <PageHeader
        title={result.attempt?.exam?.title ?? 'Exam result'}
        back={{ to: '/candidate/results', label: 'Results' }}
        description={`Published ${formatDateTime(result.publishedAt)}`}
      />
      <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Medal className="size-5 text-primary" /> Published score</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end justify-between gap-4">
            <p className="stat-number text-3xl">{obtained == null ? 'Pending' : `${obtained} / ${total}`}</p>
            <Badge tone="success">Published</Badge>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Result dispute</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {dispute ? (
              <>
                <Badge tone={dispute.status === 'RESOLVED' ? 'success' : dispute.status === 'REJECTED' ? 'danger' : 'info'}>
                  {String(dispute.status).replaceAll('_', ' ').toLowerCase()}
                </Badge>
                <p className="whitespace-pre-wrap text-sm">{dispute.explanation}</p>
                {dispute.resolution && <p className="rounded-md bg-sunken p-3 text-sm">{dispute.resolution}</p>}
              </>
            ) : (
              <>
                <p className="text-sm text-muted">If you believe this result needs review, submit a dispute for this published result.</p>
                <Button asChild variant="secondary">
                  <Link to={`/candidate/disputes?resultId=${encodeURIComponent(result.id)}`}><Gavel /> Raise dispute</Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
