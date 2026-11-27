import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { CircleHelp, Flag, Gavel, Hourglass, Medal, Timer, Unplug } from 'lucide-react'
import { downloadCandidateReport } from '@/api/results'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { DownloadButton } from '@/components/report/DownloadButton'
import { VerificationPanel } from '@/components/report/VerificationPanel'
import { Badge, StatusBadge } from '@/components/StatusBadge'
import { StatCard } from '@/components/StatCard'
import { useCandidateReportPreview, useCandidateResult, useCreateDispute } from '@/hooks/useDisputes'
import { DISPUTE_CATEGORY_META } from '@/lib/constants'
import { formatDateTime, formatWindow } from '@/lib/format'
import { cn } from '@/lib/utils'

const CATEGORIES = ['GRADING_ERROR', 'AMBIGUOUS_QUESTION', 'TECHNICAL_INCIDENT']

const ANSWER_STATUS = {
  correct: { label: 'Correct', tone: 'success' },
  partial: { label: 'Partial', tone: 'warning' },
  incorrect: { label: 'Incorrect', tone: 'danger' },
  skipped: { label: 'Skipped', tone: 'neutral' },
}

function NotPublishedState() {
  return (
    <EmptyState
      icon={Hourglass}
      title="Results aren't published yet"
      description="Your examiner hasn't published results for this exam. You'll be able to view your score and raise a dispute once they do."
    />
  )
}

function RaiseDisputeDialog({ examId, open, onOpenChange, questions, windowOpen }) {
  const [category, setCategory] = useState('GRADING_ERROR')
  const [questionId, setQuestionId] = useState('')
  const [explanation, setExplanation] = useState('')
  const create = useCreateDispute(examId, {
    onSuccess: () => {
      onOpenChange(false)
      setCategory('GRADING_ERROR')
      setQuestionId('')
      setExplanation('')
    },
  })

  const needsQuestion = category !== 'TECHNICAL_INCIDENT'
  const explanationTrim = explanation.trim()
  const explanationValid = explanationTrim.length >= 20
  const questionValid = !needsQuestion || Boolean(questionId)
  const canSubmit = windowOpen && questionValid && explanationValid && !create.isPending

  const handleOpenChange = (next) => {
    if (create.isPending) return
    if (!next) {
      setCategory('GRADING_ERROR')
      setQuestionId('')
      setExplanation('')
    }
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Raise a dispute</DialogTitle>
          <DialogDescription>
            Tell the examiner what you think went wrong. They will review your case before the dispute window closes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 px-6 pb-2">
          <fieldset className="space-y-3">
            <legend className="text-sm font-semibold">What is this about?</legend>
            {CATEGORIES.map((key) => {
              const meta = DISPUTE_CATEGORY_META[key]
              const Icon = meta.icon
              const id = `dispute-cat-${key}`
              return (
                <label
                  key={key}
                  htmlFor={id}
                  className={cn(
                    'flex cursor-pointer gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-sunken',
                    category === key && 'border-primary bg-sky',
                  )}
                >
                  <input
                    id={id}
                    type="radio"
                    name="dispute-category"
                    className="mt-1"
                    checked={category === key}
                    onChange={() => {
                      setCategory(key)
                      if (key === 'TECHNICAL_INCIDENT') setQuestionId('')
                    }}
                    disabled={create.isPending}
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
                      {meta.label}
                    </span>
                    <span className="mt-0.5 block text-sm text-muted">{meta.description}</span>
                  </span>
                </label>
              )
            })}
          </fieldset>

          {needsQuestion && (
            <FormField label="Question" required hint="Pick the question your dispute relates to.">
              {(field) => (
                <Select
                  {...field}
                  value={questionId}
                  onChange={(e) => setQuestionId(e.target.value)}
                  disabled={create.isPending}
                >
                  <option value="">Select a question…</option>
                  {questions.map((q) => (
                    <option key={q.id} value={q.id}>
                      Q{q.number}: {q.text.slice(0, 80)}
                      {q.text.length > 80 ? '…' : ''}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
          )}

          <FormField
            label="Explanation"
            required
            hint="At least 20 characters so the examiner can act on your case."
            error={explanationTrim.length > 0 && !explanationValid ? 'Explain the problem in at least 20 characters.' : undefined}
          >
            {(field) => (
              <Textarea
                {...field}
                value={explanation}
                onChange={(e) => setExplanation(e.target.value)}
                disabled={create.isPending}
                placeholder="Describe what happened…"
              />
            )}
          </FormField>
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button
            loading={create.isPending}
            disabledReason={
              !windowOpen
                ? 'The dispute window for this exam has closed.'
                : !canSubmit
                  ? 'Choose a category, fill in the required fields, and write at least 20 characters.'
                  : undefined
            }
            onClick={() =>
              create.mutate({
                category,
                questionId: needsQuestion ? questionId : undefined,
                explanation: explanationTrim,
              })
            }
          >
            <Gavel /> Submit dispute
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function CandidateResultPage() {
  const { id } = useParams()
  const result = useCandidateResult(id)
  const report = useCandidateReportPreview(id, { enabled: Boolean(result.data) })
  const [disputeOpen, setDisputeOpen] = useState(false)
  const back = { to: '/candidate', label: 'My exams' }

  if (result.error?.code === 'RESULTS_NOT_PUBLISHED') {
    return (
      <>
        <PageHeader title="Exam result" back={back} />
        <NotPublishedState />
      </>
    )
  }

  if (result.error) {
    return (
      <>
        <PageHeader title="Exam result" back={back} />
        <ErrorState error={result.error} onRetry={result.refetch} isRetrying={result.isRefetching} title="We couldn't load your result" />
      </>
    )
  }

  if (result.isPending) {
    return (
      <>
        <PageHeader title="Exam result" back={back} />
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading your result</span>
          <div className="grid gap-4 sm:grid-cols-3">
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
            <Skeleton className="h-28" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </>
    )
  }

  const data = result.data
  const { score, exam, disputeWindow: dw, disputes, questions } = data
  const windowOpen = Boolean(dw?.isOpen)

  const questionColumns = [
    {
      key: 'number',
      header: 'Q',
      className: 'w-12',
      sortValue: (q) => q.number,
      cell: (q) => <span className="num font-semibold">{q.number}</span>,
    },
    {
      key: 'text',
      header: 'Question',
      cell: (q) => <p className="line-clamp-2 max-w-md text-sm">{q.text}</p>,
    },
    {
      key: 'marks',
      header: 'Marks',
      sortValue: (q) => q.marks,
      cell: (q) => (
        <span className="num font-medium">
          {q.marks} / {q.max}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Result',
      sortValue: (q) => q.status,
      cell: (q) => {
        const meta = ANSWER_STATUS[q.status] ?? { label: q.status, tone: 'neutral' }
        return <Badge tone={meta.tone}>{meta.label}</Badge>
      },
    },
    {
      key: 'feedback',
      header: 'Feedback',
      cell: (q) => <p className="line-clamp-2 max-w-xs text-sm text-muted">{q.feedback || '—'}</p>,
    },
  ]

  const disputeColumns = [
    {
      key: 'category',
      header: 'Category',
      cell: (d) => {
        const meta = DISPUTE_CATEGORY_META[d.category]
        const Icon = meta?.icon ?? Flag
        return (
          <span className="flex items-center gap-2 text-sm">
            <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />
            {meta?.label ?? d.category}
          </span>
        )
      },
    },
    {
      key: 'question',
      header: 'Question',
      cell: (d) => (d.question ? `Q${d.question.number}` : '—'),
    },
    {
      key: 'status',
      header: 'Status',
      cell: (d) => <StatusBadge kind="dispute" status={d.status} />,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      cell: (d) => (d.outcome ? <StatusBadge kind="outcome" status={d.outcome} /> : '—'),
    },
    {
      key: 'created',
      header: 'Raised',
      sortValue: (d) => d.createdAt,
      cell: (d) => <span className="num text-xs text-muted">{formatDateTime(d.createdAt)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title={exam.title}
        back={back}
        description={`Published ${formatDateTime(data.publishedAt)} · ${formatWindow(exam.startAt, exam.endAt)}`}
        actions={
          <Button
            variant="secondary"
            onClick={() => setDisputeOpen(true)}
            disabledReason={
              !windowOpen
                ? dw
                  ? `Disputes closed on ${formatDateTime(dw.closesAt)}.`
                  : 'Disputes are not available for this exam.'
                : undefined
            }
          >
            <Gavel /> Raise dispute
          </Button>
        }
        meta={
          dw && (
            <Badge tone={windowOpen ? 'success' : 'neutral'} icon={Timer}>
              {windowOpen ? 'Dispute window open' : 'Dispute window closed'}
            </Badge>
          )
        }
      />

      <div className="space-y-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Your score" value={`${score.total} / ${score.max}`} icon={Medal} tone="brand" hint={`${score.percent}%`} />
          <StatCard label="Grade" value={score.grade} icon={CircleHelp} tone={score.passed ? 'success' : 'warning'} hint={score.passed ? 'Passed' : 'Did not pass'} />
          <StatCard
            label="Score version"
            value={`v${score.version}`}
            icon={Flag}
            tone={score.revised ? 'info' : 'neutral'}
            hint={score.revised ? 'Revised after a dispute — earlier versions are kept on record.' : 'Original published score'}
          />
          {data.compensationMinutes > 0 && (
            <StatCard label="Time compensation" value={`${data.compensationMinutes} min`} icon={Unplug} tone="info" hint="Granted for technical issues" />
          )}
        </div>

        <Card as="section" aria-labelledby="breakdown-heading">
          <CardHeader>
            <CardTitle id="breakdown-heading">Question breakdown</CardTitle>
            <CardDescription>How each question on your paper was marked.</CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            <DataTable
              caption="Per-question marks"
              columns={questionColumns}
              rows={questions}
              pageSize={10}
              initialSort={{ key: 'number', dir: 'asc' }}
              emptyState={<EmptyState compact title="No questions" description="There are no marked questions to show." />}
            />
          </CardContent>
        </Card>

        <Card as="section" aria-labelledby="disputes-heading">
          <CardHeader>
            <CardTitle id="disputes-heading">Your disputes</CardTitle>
            <CardDescription>
              {disputes.length === 0
                ? 'You have not raised any disputes for this exam.'
                : 'Track the status of disputes you have raised.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0 sm:p-0">
            {disputes.length === 0 ? (
              <EmptyState
                compact
                icon={Gavel}
                className="border-0"
                title="No disputes"
                description={windowOpen ? 'Use “Raise dispute” above if you believe something was marked incorrectly.' : 'The dispute window has closed.'}
              />
            ) : (
              <DataTable
                caption="Your disputes"
                columns={disputeColumns}
                rows={disputes}
                pageSize={5}
                initialSort={{ key: 'created', dir: 'desc' }}
              />
            )}
          </CardContent>
        </Card>

        <section aria-labelledby="report-heading" className="space-y-4">
          <h2 id="report-heading" className="text-base font-semibold">
            Official report
          </h2>
          {report.isPending ? (
            <Skeleton className="h-36 w-full" />
          ) : report.error ? (
            <ErrorState compact error={report.error} onRetry={report.refetch} isRetrying={report.isRefetching} />
          ) : report.data ? (
            <>
              <VerificationPanel report={report.data} />
              <DownloadButton label="Download PDF report" icon="pdf" action={() => downloadCandidateReport(id)} />
            </>
          ) : null}
        </section>
      </div>

      <RaiseDisputeDialog
        examId={id}
        open={disputeOpen}
        onOpenChange={setDisputeOpen}
        questions={questions}
        windowOpen={windowOpen}
      />
    </>
  )
}