import { BarChart3, Gauge, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { Skeleton } from '@/components/ui/skeleton'
import { useQuestionAnalytics, useResults } from '@/hooks/useResults'
import { formatDateTime } from '@/lib/format'

export function ResultsTab({ exam }) {
  const results = useResults(exam.id)
  const analytics = useQuestionAnalytics(exam.id)
  const summary = results.data?.summary
  const columns = [
    {
      key: 'candidate',
      header: 'Candidate',
      sortValue: (row) => row.candidate.name.toLowerCase(),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.candidate.name}</p>
          <p className="truncate text-xs text-muted">{row.candidate.email}</p>
        </div>
      ),
    },
    {
      key: 'score',
      header: 'Score',
      sortValue: (row) => row.percent,
      cell: (row) => <span className="num font-semibold">{row.pending ? 'Pending review' : `${row.total} / ${row.max} (${row.percent}%)`}</span>,
    },
    {
      key: 'result',
      header: 'Result',
      cell: (row) => row.pending ? <StatusBadge kind="results" status="UNGRADED" /> : <span>{row.passed ? 'Pass' : 'Fail'}</span>,
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortValue: (row) => row.submittedAt,
      cell: (row) => <span className="num text-xs text-muted">{row.submittedAt ? formatDateTime(row.submittedAt) : '—'}</span>,
    },
  ]
  const analyticsColumns = [
    {
      key: 'question',
      header: 'Question',
      cell: (row) => (
        <div className="min-w-52">
          <p className="font-semibold">{row.label} · {row.type.replaceAll('_', ' ')}</p>
          <p className="line-clamp-2 text-xs text-muted">{row.text}</p>
        </div>
      ),
    },
    {
      key: 'difficulty',
      header: 'Observed difficulty',
      cell: (row) => row.observedDifficulty
        ? <StatusBadge kind="difficulty" status={row.observedDifficulty} />
        : <span className="text-xs text-muted">No graded responses</span>,
    },
    {
      key: 'attempts',
      header: 'Final attempts',
      cell: (row) => <span className="num">{row.attempts}</span>,
    },
    {
      key: 'skipped',
      header: 'Skipped',
      cell: (row) => <span className="num">{row.skippedRate}% ({row.skipped})</span>,
    },
    {
      key: 'incorrect',
      header: 'Incorrect',
      cell: (row) => <span className="num">{row.incorrectRate}% ({row.incorrect})</span>,
    },
    {
      key: 'responses',
      header: 'Response patterns',
      cell: (row) => row.type === 'WRITTEN'
        ? <span className="text-xs text-muted">{row.ungraded} awaiting mark · {row.gradedResponses} graded</span>
        : (
          <ul className="min-w-48 space-y-1 text-xs">
            {row.responsePatterns.options.map((option) => (
              <li key={option.id} className="flex justify-between gap-3">
                <span className="truncate">{option.text}{option.isCorrect ? ' (key)' : ''}</span>
                <span className="num shrink-0">{option.selectedCount} · {option.selectedRate}%</span>
              </li>
            ))}
          </ul>
        ),
    },
  ]

  return (
    <div className="space-y-6">
      {results.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : results.error ? (
        <ErrorState compact error={results.error} onRetry={results.refetch} isRetrying={results.isRefetching} />
      ) : (
        <div className="flex items-center justify-between gap-3">
          <StatusBadge kind="results" status={results.data?.state} />
          {results.data?.publishedAt && (
            <p className="text-xs text-muted">Published <span className="num">{formatDateTime(results.data.publishedAt)}</span></p>
          )}
        </div>
      )}

      <section aria-label="Results summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Average" value={`${summary?.average ?? 0}%`} icon={Gauge} tone="brand" loading={results.isPending} />
        <StatCard label="Highest" value={`${summary?.highest ?? 0}%`} icon={TrendingUp} tone="success" loading={results.isPending} />
        <StatCard label="Lowest" value={`${summary?.lowest ?? 0}%`} icon={TrendingDown} tone="warning" loading={results.isPending} />
        <StatCard label="Pass rate" value={`${summary?.passRate ?? 0}%`} icon={Users} tone="info" loading={results.isPending} />
      </section>

      <section aria-labelledby="question-analytics-title" className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="question-analytics-title" className="flex items-center gap-2 text-lg font-bold">
              <BarChart3 className="size-5 text-primary" aria-hidden="true" />
              Question analytics
            </h2>
            <p className="text-sm text-muted">
              Based on {analytics.data?.finalAttemptCount ?? 0} final, official submissions. Written responses awaiting grading are excluded from difficulty rates.
            </p>
          </div>
        </div>
        {analytics.error ? (
          <ErrorState compact error={analytics.error} onRetry={analytics.refetch} isRetrying={analytics.isRefetching} />
        ) : (
          <DataTable
            caption="Question performance and candidate response patterns"
            columns={analyticsColumns}
            rows={analytics.data?.questions}
            rowKey={(row) => row.questionVersionId}
            isLoading={analytics.isPending}
            pageSize={8}
            emptyState={<EmptyState icon={BarChart3} title="No question analytics yet" description="Analytics appear after candidates submit official attempts." />}
          />
        )}
      </section>

      <DataTable
        caption="Candidate scores"
        columns={columns}
        rows={results.data?.rows}
        rowKey={(row) => row.attemptId}
        isLoading={results.isPending}
        error={results.error}
        onRetry={results.refetch}
        isRetrying={results.isRefetching}
        pageSize={8}
        searchText={(row) => `${row.candidate.name} ${row.candidate.email}`}
        searchLabel="Search candidates"
        searchPlaceholder="Search by name or email"
        initialSort={{ key: 'score', dir: 'desc' }}
        emptyState={<EmptyState icon={Users} title="No submissions" description="Submitted attempts appear after evaluation." />}
      />
    </div>
  )
}
