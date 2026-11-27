import { lazy, Suspense, useMemo } from 'react'
import { BarChart3, Gauge, Scale, TrendingDown, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartCard } from '@/components/ChartCard'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { DownloadButton } from '@/components/report/DownloadButton'
import { VerificationPanel } from '@/components/report/VerificationPanel'
import { SectionNav } from '@/components/SectionNav'
import { Skeleton } from '@/components/ui/skeleton'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { useExamReportPreview, useFairness, useQuestionAnalytics, useResults } from '@/hooks/useResults'
import { exportResults, downloadExamReport } from '@/api/results'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const ScoreDistributionChart = lazy(() => import('@/components/charts/ExamResultsCharts').then((m) => ({ default: m.ScoreDistributionChart })))
const SkippedQuestionsChart = lazy(() => import('@/components/charts/ExamResultsCharts').then((m) => ({ default: m.SkippedQuestionsChart })))
const WrongQuestionsChart = lazy(() => import('@/components/charts/ExamResultsCharts').then((m) => ({ default: m.WrongQuestionsChart })))
const DifficultyMismatchChart = lazy(() => import('@/components/charts/ExamResultsCharts').then((m) => ({ default: m.DifficultyMismatchChart })))

function distributionTakeaway(distribution) {
  if (!distribution?.length) return null
  const peak = [...distribution].sort((a, b) => b.count - a.count)[0]
  if (!peak?.count) return 'No submitted attempts yet to show a distribution.'
  return `Most candidates scored between ${peak.range}%.`
}

function topSkippedTakeaway(questions) {
  const top = [...questions].sort((a, b) => b.skippedRate - a.skippedRate)[0]
  if (!top) return null
  return `${top.label} was skipped by ${top.skippedRate}% of candidates who received it.`
}

function topWrongTakeaway(questions) {
  const top = [...questions].sort((a, b) => b.wrongRate - a.wrongRate)[0]
  if (!top?.wrongRate) return 'Wrong-answer rates are low across the paper.'
  return `${top.label} had the highest wrong-answer rate at ${top.wrongRate}%.`
}

function difficultyTakeaway(questions) {
  const mismatches = questions.filter((q) => q.declaredDifficulty !== q.observedDifficulty)
  if (mismatches.length === 0) return 'Observed difficulty matches what you declared for every question.'
  const names = mismatches
    .slice(0, 3)
    .map((q) => q.label)
    .join(', ')
  const more = mismatches.length > 3 ? ` and ${mismatches.length - 3} more` : ''
  return `${mismatches.length} question${mismatches.length === 1 ? '' : 's'} (${names}${more}) performed differently than their declared difficulty.`
}

/**
 * @param {{ exam: object, view?: 'scores' | 'analytics' | 'fairness' | 'report' }} props
 */
export function ResultsTab({ exam, view = 'scores' }) {
  const results = useResults(exam.id)
  const analytics = useQuestionAnalytics(exam.id, { enabled: results.data?.state !== 'NOT_READY' && (view === 'analytics' || view === 'scores') })
  const fairness = useFairness(exam.id, { enabled: view === 'fairness' })
  const report = useExamReportPreview(exam.id, { enabled: results.data?.state !== 'NOT_READY' && view === 'report' })

  const questions = analytics.data?.questions ?? []
  const distribution = results.data?.distribution ?? []
  const summary = results.data?.summary
  const state = results.data?.state
  const notReady = state === 'NOT_READY'
  const exportBlocked = notReady ? 'Results can be exported once the exam has finished.' : undefined
  const base = `/examiner/exams/${exam.id}/results`
  const navItems = [
    { to: base, label: 'Scores', end: true },
    { to: `${base}/analytics`, label: 'Analytics' },
    { to: `${base}/fairness`, label: 'Fairness' },
    { to: `${base}/report`, label: 'Report' },
  ]

  const resultsColumns = useMemo(
    () => [
      {
        key: 'candidate',
        header: 'Candidate',
        sortValue: (r) => r.candidate.name.toLowerCase(),
        cell: (r) => (
          <div className="min-w-0">
            <p className="truncate font-semibold">{r.candidate.name}</p>
            <p className="truncate text-xs text-muted">{r.candidate.email}</p>
          </div>
        ),
      },
      {
        key: 'percent',
        header: 'Score %',
        sortValue: (r) => r.percent,
        cell: (r) => (
          <span className="num font-semibold">
            {r.total} / {r.max} ({r.percent}%)
          </span>
        ),
      },
      { key: 'grade', header: 'Grade', sortValue: (r) => r.grade, cell: (r) => <span className="num font-semibold">{r.grade}</span> },
      {
        key: 'passed',
        header: 'Result',
        sortValue: (r) => (r.passed ? 1 : 0),
        cell: (r) => (
          <span className={cn('text-sm font-semibold', r.passed ? 'text-success' : 'text-danger')}>{r.passed ? 'Pass' : 'Fail'}</span>
        ),
      },
      {
        key: 'pending',
        header: 'Pending marks',
        sortValue: (r) => r.pending,
        cell: (r) => (r.pending > 0 ? <span className="num text-warning">{r.pending}</span> : <span className="text-muted">—</span>),
      },
      {
        key: 'incidents',
        header: 'Incidents',
        sortValue: (r) => r.incidentCount,
        cell: (r) => <span className="num text-muted">{r.incidentCount}</span>,
      },
    ],
    [],
  )

  const fairnessColumns = useMemo(
    () => [
      {
        key: 'candidate',
        header: 'Candidate',
        sortValue: (p) => p.candidate.name.toLowerCase(),
        cell: (p) => <span className="font-semibold">{p.candidate.name}</span>,
      },
      {
        key: 'difficultyScore',
        header: 'Difficulty score',
        sortValue: (p) => p.difficultyScore,
        cell: (p) => <span className="num font-semibold">{p.difficultyScore.toFixed(2)}</span>,
      },
      { key: 'easy', header: 'Easy', sortValue: (p) => p.easy, cell: (p) => <span className="num">{p.easy}</span> },
      { key: 'medium', header: 'Medium', sortValue: (p) => p.medium, cell: (p) => <span className="num">{p.medium}</span> },
      { key: 'hard', header: 'Hard', sortValue: (p) => p.hard, cell: (p) => <span className="num">{p.hard}</span> },
      { key: 'questions', header: 'Questions', sortValue: (p) => p.questions, cell: (p) => <span className="num">{p.questions}</span> },
    ],
    [],
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionNav items={navItems} className="mb-0" />
        <div className="flex flex-wrap items-center gap-2">
          {state && <StatusBadge kind="results" status={state} />}
          {results.data?.publishedAt && (
            <p className="text-xs text-muted">
              Published <span className="num">{formatDateTime(results.data.publishedAt)}</span>
            </p>
          )}
        </div>
      </div>

      {notReady ? (
        <EmptyState icon={BarChart3} title="Results are not ready yet" />
      ) : view === 'analytics' ? (
        <div className="space-y-6">
          <ChartCard title="Most skipped" takeaway={topSkippedTakeaway(questions)} isLoading={analytics.isPending} error={analytics.error} onRetry={analytics.refetch} isRetrying={analytics.isRefetching} empty={questions.length === 0} emptyText="No data yet.">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <SkippedQuestionsChart questions={questions} />
            </Suspense>
          </ChartCard>
          <ChartCard title="Most commonly wrong" takeaway={topWrongTakeaway(questions)} isLoading={analytics.isPending} error={analytics.error} onRetry={analytics.refetch} isRetrying={analytics.isRefetching} empty={questions.length === 0} emptyText="No data yet.">
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <WrongQuestionsChart questions={questions} />
            </Suspense>
          </ChartCard>
          <ChartCard title="Declared vs observed difficulty" takeaway={difficultyTakeaway(questions)} isLoading={analytics.isPending} error={analytics.error} onRetry={analytics.refetch} isRetrying={analytics.isRefetching} empty={questions.length === 0} emptyText="No data yet." chartHeight="h-72">
            <Suspense fallback={<Skeleton className="h-72 w-full" />}>
              <DifficultyMismatchChart questions={questions} />
            </Suspense>
          </ChartCard>
        </div>
      ) : view === 'fairness' ? (
        <Card as="section" aria-labelledby="fairness-heading">
          <CardHeader>
            <CardTitle id="fairness-heading" className="flex items-center gap-2">
              <Scale className="size-5 text-primary" aria-hidden="true" />
              Paper fairness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {fairness.isPending ? (
              <Skeleton className="h-24 w-full" />
            ) : fairness.error ? (
              <ErrorState compact error={fairness.error} onRetry={fairness.refetch} isRetrying={fairness.isRefetching} />
            ) : (
              <>
                {fairness.data?.note ? <p className="text-sm text-ink">{fairness.data.note}</p> : null}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Mean difficulty" value={fairness.data?.mean?.toFixed(2) ?? '—'} tone="brand" />
                  <StatCard label="Variance" value={fairness.data?.variance?.toFixed(4) ?? '—'} />
                  <StatCard label="Spread" value={fairness.data?.spread?.toFixed(2) ?? '—'} tone={fairness.data?.withinTolerance ? 'success' : 'warning'} />
                  <StatCard label="Within tolerance" value={fairness.data?.withinTolerance ? 'Yes' : 'No'} tone={fairness.data?.withinTolerance ? 'success' : 'danger'} />
                </div>
                <DataTable
                  caption="Per-candidate paper difficulty"
                  columns={fairnessColumns}
                  rows={fairness.data?.papers}
                  rowKey={(p) => p.attemptId}
                  pageSize={6}
                  emptyState={<EmptyState title="No papers issued" />}
                />
              </>
            )}
          </CardContent>
        </Card>
      ) : view === 'report' ? (
        <Card as="section" aria-labelledby="report-heading">
          <CardHeader>
            <CardTitle id="report-heading">Exam report</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {report.isPending ? (
              <Skeleton className="h-40 w-full" />
            ) : report.error ? (
              <EmptyState title="Report unavailable" description={report.error.message} />
            ) : report.data ? (
              <>
                <VerificationPanel report={report.data} />
                <DownloadButton label="Download PDF" icon="pdf" variant="primary" action={() => downloadExamReport(exam.id)} disabledReason={exportBlocked} />
              </>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Summary" className="grid grid-cols-1 gap-4 min-[480px]:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Average" value={`${summary?.average ?? 0}%`} icon={Gauge} tone="brand" loading={results.isPending} />
            <StatCard label="Highest" value={`${summary?.highest ?? 0}%`} icon={TrendingUp} tone="success" loading={results.isPending} />
            <StatCard label="Lowest" value={`${summary?.lowest ?? 0}%`} icon={TrendingDown} tone="warning" loading={results.isPending} />
            <StatCard label="Pass rate" value={`${summary?.passRate ?? 0}%`} icon={Users} tone="info" loading={results.isPending} />
          </section>

          <ChartCard
            title="Score distribution"
            takeaway={distributionTakeaway(distribution)}
            isLoading={results.isPending}
            error={results.error}
            onRetry={results.refetch}
            isRetrying={results.isRefetching}
            empty={!distribution.some((d) => d.count > 0)}
            emptyText="No scores to chart yet."
          >
            <Suspense fallback={<Skeleton className="h-64 w-full" />}>
              <ScoreDistributionChart distribution={distribution} />
            </Suspense>
          </ChartCard>

          <DataTable
            caption="Candidate scores"
            columns={resultsColumns}
            rows={results.data?.rows}
            rowKey={(r) => r.attemptId}
            isLoading={results.isPending}
            error={results.error}
            onRetry={results.refetch}
            isRetrying={results.isRefetching}
            pageSize={8}
            searchText={(r) => `${r.candidate.name} ${r.candidate.email}`}
            searchLabel="Search candidates"
            searchPlaceholder="Search by name or email"
            initialSort={{ key: 'percent', dir: 'desc' }}
            emptyState={<EmptyState icon={Users} title="No submissions" />}
            toolbarActions={
              <div className="flex flex-wrap gap-2">
                <DownloadButton label="CSV" action={() => exportResults(exam.id, 'csv')} disabledReason={exportBlocked} />
                <DownloadButton label="PDF" icon="pdf" action={() => exportResults(exam.id, 'pdf')} disabledReason={exportBlocked} />
              </div>
            }
          />
        </>
      )}
    </div>
  )
}