import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, ClipboardCheck, Hourglass, ListChecks, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { StatusBadge } from '@/components/StatusBadge'
import { useGradingQueue, usePublishResults, useResultsReview, useSaveGrade } from '@/hooks/useGrading'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

function nextUngradedAfter(items, key) {
  if (!items.length) return null
  const start = key ? items.findIndex((i) => i.key === key) + 1 : 0
  for (let i = start; i < items.length; i += 1) if (items[i].score === null) return items[i]
  for (let i = 0; i < start; i += 1) if (items[i].score === null) return items[i]
  return items[0]
}

function validateScoreInput(raw, max) {
  if (raw === '' || raw === null || raw === undefined) return 'Enter a score.'
  const value = Number(raw)
  if (Number.isNaN(value)) return 'Enter a score.'
  if (value < 0 || value > max) return `The score must be between 0 and ${max}.`
  return null
}

export function GradingTab({ exam }) {
  const queue = useGradingQueue(exam.id)
  const reviewEnabled = Boolean(queue.data && queue.data.state !== 'NOT_READY')
  const review = useResultsReview(exam.id, { enabled: reviewEnabled })
  const [publishOpen, setPublishOpen] = useState(false)

  const items = queue.data?.items ?? []
  const [currentKey, setCurrentKey] = useState(null)
  const current = useMemo(() => items.find((i) => i.key === currentKey) ?? items[0] ?? null, [items, currentKey])

  const [scoreInput, setScoreInput] = useState('')
  const [feedback, setFeedback] = useState('')
  const [scoreError, setScoreError] = useState(null)

  useEffect(() => {
    if (!items.length) {
      setCurrentKey(null)
      return
    }
    if (!currentKey || !items.some((i) => i.key === currentKey)) {
      const first = items.find((i) => i.score === null) ?? items[0]
      setCurrentKey(first.key)
    }
  }, [items, currentKey])

  useEffect(() => {
    if (!current) return
    setScoreInput(current.score !== null ? String(current.score) : '')
    setFeedback(current.feedback ?? '')
    setScoreError(null)
  }, [current])

  const saveGrade = useSaveGrade(exam.id, {
    onError: (err) => {
      const message = typeof err.details === 'object' && err.details?.score ? err.details.score : err.message
      setScoreError(message)
    },
  })

  const publish = usePublishResults(exam.id, { onSuccess: () => setPublishOpen(false) })

  const persist = (andNext) => {
    if (!current) return
    const clientErr = validateScoreInput(scoreInput, current.question.maxMarks)
    if (clientErr) {
      setScoreError(clientErr)
      return
    }
    setScoreError(null)
    saveGrade.mutate(
      { item: current, score: Number(scoreInput), feedback },
      {
        onSuccess: () => {
          if (andNext) setCurrentKey(nextUngradedAfter(items, current.key)?.key ?? current.key)
        },
      },
    )
  }

  const reviewColumns = [
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
      key: 'score',
      header: 'Score',
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
      header: 'Pending',
      sortValue: (r) => r.pending,
      cell: (r) => (r.pending > 0 ? <span className="num text-sm text-warning">{r.pending} written</span> : <span className="text-sm text-muted">None</span>),
    },
    {
      key: 'submittedAt',
      header: 'Submitted',
      sortValue: (r) => r.submittedAt,
      cell: (r) => <span className="num text-xs text-muted">{formatDateTime(r.submittedAt)}</span>,
    },
  ]

  if (queue.isPending) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="py-10">
            <p role="status" className="text-center text-sm text-muted">
              Loading the marking queue…
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (queue.error) {
    return <ErrorState error={queue.error} onRetry={queue.refetch} isRetrying={queue.isRefetching} title="We couldn't load grading" />
  }

  const { state, progress } = queue.data

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-ink">Mark written answers</h2>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge kind="results" status={state} />
          <p className="text-sm text-muted">
            <span className="num font-semibold text-ink">{progress.graded}</span> of <span className="num font-semibold text-ink">{progress.total}</span> written answers
            marked
          </p>
        </div>
      </div>

      {state === 'NOT_READY' ? (
        <EmptyState
          icon={Hourglass}
          title="Grading is not available yet"
          description="Written answers can be marked after the exam window closes and candidates have submitted."
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="Nothing to mark"
          description="This exam has no written answers that need manual marking. You can still review scores and publish when the exam has finished."
        />
      ) : (
        <Card as="section" aria-labelledby="marking-heading">
          <CardHeader>
            <CardTitle id="marking-heading">Blind marking queue</CardTitle>
            <CardDescription>Candidate names are hidden while you mark. Submissions are labelled only by number.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-ink">{current?.submissionLabel}</p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Previous answer"
                  onClick={() => {
                    const idx = items.findIndex((i) => i.key === current?.key)
                    if (idx > 0) setCurrentKey(items[idx - 1].key)
                  }}
                  disabled={!current || items.findIndex((i) => i.key === current?.key) === 0}
                >
                  <ChevronLeft />
                </Button>
                <span className="num text-xs text-muted">
                  {current ? items.findIndex((i) => i.key === current.key) + 1 : 0} / {items.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Next answer"
                  onClick={() => {
                    const idx = items.findIndex((i) => i.key === current?.key)
                    if (idx < items.length - 1) setCurrentKey(items[idx + 1].key)
                  }}
                  disabled={!current || items.findIndex((i) => i.key === current?.key) === items.length - 1}
                >
                  <ChevronRight />
                </Button>
              </div>
            </div>

            {current && (
              <>
                <QuestionBlock question={current.question} />
                {current.question.modelAnswer ? (
                  <AnswerBlock title="Model answer" body={current.question.modelAnswer} variant="sky" />
                ) : null}
                <AnswerBlock title="Candidate answer" body={current.answerText} variant="sunken" />
              </>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label={`Score (out of ${current?.question.maxMarks ?? '—'})`} error={scoreError} required>
                {(field) => (
                  <Input
                    {...field}
                    type="number"
                    inputMode="decimal"
                    min={0}
                    max={current?.question.maxMarks}
                    step="any"
                    value={scoreInput}
                    onChange={(e) => {
                      setScoreInput(e.target.value)
                      setScoreError(null)
                    }}
                    disabled={saveGrade.isPending || state === 'PUBLISHED'}
                  />
                )}
              </FormField>
            </div>

            <FormField label="Feedback for the candidate" hint="Optional. Shown on their result when published.">
              {(field) => (
                <Textarea
                  {...field}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  disabled={saveGrade.isPending || state === 'PUBLISHED'}
                />
              )}
            </FormField>

            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button loading={saveGrade.isPending} onClick={() => persist(false)} disabledReason={state === 'PUBLISHED' ? 'Results are already published.' : undefined}>
                Save
              </Button>
              <Button
                variant="secondary"
                loading={saveGrade.isPending}
                onClick={() => persist(true)}
                disabledReason={state === 'PUBLISHED' ? 'Results are already published.' : undefined}
              >
                Save and next
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {reviewEnabled && (
        <section aria-labelledby="review-heading" className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <h2 id="review-heading" className="text-base font-semibold">
              Results review
            </h2>
            {review.data?.state && <StatusBadge kind="results" status={review.data.state} />}
          </div>
          <DataTable
            caption="Provisional results before publishing"
            columns={reviewColumns}
            rows={review.data?.rows}
            rowKey={(r) => r.attemptId}
            isLoading={review.isPending}
            error={review.error}
            onRetry={review.refetch}
            isRetrying={review.isRefetching}
            pageSize={6}
            searchText={(r) => `${r.candidate.name} ${r.candidate.email}`}
            searchLabel="Search candidates"
            searchPlaceholder="Search by name or email"
            initialSort={{ key: 'score', dir: 'desc' }}
            emptyState={<EmptyState icon={ListChecks} title="No submissions yet" description="Nobody submitted an attempt for this exam." />}
            toolbarActions={
              review.data?.state !== 'PUBLISHED' ? (
                <Button onClick={() => setPublishOpen(true)} disabledReason={publishDisabledReason(review.data)}>
                  <Send />
                  Publish results
                </Button>
              ) : (
                <p className="text-sm text-muted">
                  Published {review.data?.publishedAt ? formatDateTime(review.data.publishedAt) : ''}
                </p>
              )
            }
          />

          {review.data?.blockers?.length > 0 && review.data.state !== 'PUBLISHED' && (
            <ul className="rounded-lg border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning">
              {review.data.blockers.map((b) => (
                <li key={b} className="list-inside list-disc">
                  {b}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ConfirmDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        title="Publish results to candidates?"
        description="Every candidate will see their score and can raise disputes. This creates score version 1 for all attempts."
        confirmLabel="Publish results"
        isPending={publish.isPending}
        onConfirm={() => publish.mutate()}
      />
    </div>
  )
}

function publishDisabledReason(review) {
  if (!review) return 'Loading review…'
  if (review.state === 'PUBLISHED') return 'Results have already been published.'
  if (!review.canPublish) return review.blockers?.[0] ?? 'Resolve the blockers before publishing.'
  return undefined
}

function QuestionBlock({ question }) {
  return (
    <div>
      {question.topic && <p className="text-xs font-medium uppercase tracking-wide text-muted">{question.topic}</p>}
      <p className="mt-1 text-sm font-semibold text-ink">{question.text}</p>
    </div>
  )
}

function AnswerBlock({ title, body, variant }) {
  return (
    <div className={cn('rounded-lg border border-border p-4', variant === 'sky' ? 'bg-sky' : 'bg-sunken')}>
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
      <p className="mt-2 whitespace-pre-wrap text-sm text-ink">{body}</p>
    </div>
  )
}