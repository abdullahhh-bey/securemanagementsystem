import { useState } from 'react'
import { Gavel, History, Scale, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, Textarea } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge, StatusBadge } from '@/components/StatusBadge'
import {
  useDisputeImpact,
  useDisputes,
  useResolveDispute,
  useScoreHistory,
  useStartDisputeReview,
} from '@/hooks/useDisputes'
import { DISPUTE_CATEGORY_META, DISPUTE_OUTCOME_META } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'

const OUTCOMES = ['UPHELD', 'PARTIALLY_UPHELD', 'REJECTED']

function WindowBanner({ window: win }) {
  if (!win) {
    return (
      <p className="rounded-lg border border-border bg-sunken p-3 text-sm text-muted">
        No results have been published yet, so candidates cannot raise disputes.
      </p>
    )
  }
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-2">
        <Timer className="size-4 shrink-0 text-muted" aria-hidden="true" />
        <Badge tone={win.isOpen ? 'success' : 'neutral'} icon={Timer}>
          {win.isOpen ? 'Dispute window open' : 'Dispute window closed'}
        </Badge>
      </div>
      <p className="text-sm text-muted">
        {win.isOpen ? (
          <>
            Candidates can raise disputes until <span className="num font-medium text-ink">{formatDateTime(win.closesAt)}</span>
          </>
        ) : (
          <>Window closed on <span className="num font-medium text-ink">{formatDateTime(win.closesAt)}</span></>
        )}
      </p>
    </div>
  )
}

function CountChips({ counts }) {
  if (!counts) return null
  const items = [
    { key: 'open', label: 'Open', tone: 'warning' },
    { key: 'underReview', label: 'Under review', tone: 'info' },
    { key: 'resolved', label: 'Resolved', tone: 'success' },
  ]
  return (
    <div className="flex flex-wrap gap-2" role="list" aria-label="Dispute counts">
      {items.map(({ key, label, tone }) => (
        <Badge key={key} tone={tone} className="num px-2.5 py-1 text-sm" role="listitem">
          {label}: {counts[key] ?? 0}
        </Badge>
      ))}
    </div>
  )
}

function ScoreHistoryDialog({ examId, dispute, open, onOpenChange }) {
  const history = useScoreHistory(examId, dispute?.attemptId, { enabled: open && Boolean(dispute) })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Score history</DialogTitle>
          <DialogDescription>
            Published scores are never overwritten. Each revision is stored as a new version so you and the candidate can see what changed.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[min(60vh,24rem)] overflow-y-auto px-6">
          {history.isPending ? (
            <LoadingBlock label="Loading score history" />
          ) : history.error ? (
            <ErrorState compact error={history.error} onRetry={history.refetch} isRetrying={history.isRefetching} />
          ) : (
            <ol className="space-y-3">
              {history.data?.versions.map((v) => (
                <li
                  key={v.version}
                  className="rounded-lg border border-border bg-surface p-3"
                  aria-current={v.isCurrent ? 'step' : undefined}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      Version <span className="num">v{v.version}</span>
                      {v.isCurrent && (
                        <Badge tone="brand" className="ml-2">
                          Current
                        </Badge>
                      )}
                    </p>
                    <p className="num text-sm text-muted">{formatDateTime(v.createdAt)}</p>
                  </div>
                  <p className="num mt-1 text-lg font-semibold">
                    {v.total} / {v.max}
                    {v.delta !== 0 && (
                      <span className={v.delta > 0 ? ' text-success' : ' text-danger'}>
                        {' '}
                        ({v.delta > 0 ? '+' : ''}
                        {v.delta})
                      </span>
                    )}
                  </p>
                  <p className="mt-2 text-sm text-muted">{v.reason}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function LoadingBlock({ label }) {
  return (
    <div className="space-y-2 px-6 py-2" role="status">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  )
}

function ResolveDisputeDialog({ examId, dispute, open, onOpenChange }) {
  const [outcome, setOutcome] = useState('UPHELD')
  const [reason, setReason] = useState('')
  const [confirmOpen, setConfirmOpen] = useState(false)
  const resolve = useResolveDispute(examId, {
    onSuccess: () => {
      setConfirmOpen(false)
      onOpenChange(false)
      setReason('')
      setOutcome('UPHELD')
    },
  })

  const impact = useDisputeImpact(examId, dispute?.id, outcome, { enabled: open && Boolean(dispute) })
  const reasonTrim = reason.trim()
  const reasonValid = reasonTrim.length >= 15
  const canConfirm = reasonValid && !impact.isPending && !impact.error

  const handleOpenChange = (next) => {
    if (resolve.isPending) return
    if (!next) {
      setReason('')
      setOutcome('UPHELD')
      setConfirmOpen(false)
    }
    onOpenChange(next)
  }

  const candidateName = dispute?.candidate?.name ?? 'Candidate'

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Resolve dispute</DialogTitle>
            <DialogDescription>
              Choose an outcome for {candidateName}&apos;s dispute. The candidate will see your written reason.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 px-6 pb-2">
            <FormField label="Outcome" required>
              {(field) => (
                <Select
                  {...field}
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                  disabled={resolve.isPending}
                >
                  {OUTCOMES.map((value) => (
                    <option key={value} value={value}>
                      {DISPUTE_OUTCOME_META[value].label}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>

            <div className="rounded-lg border border-border bg-sky p-4">
              <p className="text-sm font-medium text-muted">Impact preview</p>
              {impact.isPending ? (
                <Skeleton className="mt-2 h-6 w-56" />
              ) : impact.error ? (
                <ErrorState compact error={impact.error} onRetry={impact.refetch} isRetrying={impact.isRefetching} />
              ) : (
                <>
                  <p className="mt-1 text-lg font-bold">{impact.data?.summary}</p>
                  {impact.data?.changes?.length > 0 && (
                    <ul className="mt-3 max-h-40 space-y-2 overflow-y-auto text-sm">
                      {impact.data.changes.map((change) => (
                        <li key={change.attemptId} className="rounded-md border border-border bg-surface px-3 py-2">
                          <span className="font-medium">{change.name}</span>
                          <span className="num ml-2 text-muted">
                            {change.before} → {change.after} / {change.max}
                            {change.questionBefore != null && (
                              <>
                                {' '}
                                (Q: {change.questionBefore} → {change.questionAfter})
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>

            <FormField
              label="Resolution reason"
              required
              hint="At least 15 characters. The candidate will read this."
              error={reasonTrim.length > 0 && !reasonValid ? 'Explain your decision in at least 15 characters.' : undefined}
            >
              {(field) => (
                <Textarea
                  {...field}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={resolve.isPending}
                  placeholder="Explain why you chose this outcome…"
                />
              )}
            </FormField>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={resolve.isPending}>
              Cancel
            </Button>
            <Button disabledReason={!canConfirm ? 'Enter a reason of at least 15 characters and wait for the impact preview.' : undefined} onClick={() => setConfirmOpen(true)}>
              <Scale /> Review and confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Confirm resolution?"
        description={`This will mark the dispute as resolved with outcome “${DISPUTE_OUTCOME_META[outcome]?.label}”.`}
        confirmLabel="Resolve dispute"
        isPending={resolve.isPending}
        onConfirm={() => resolve.mutate({ disputeId: dispute.id, outcome, reason: reasonTrim })}
      >
        {impact.data?.summary && <p className="font-semibold">{impact.data.summary}</p>}
      </ConfirmDialog>
    </>
  )
}

export function DisputesTab({ exam }) {
  const disputesQuery = useDisputes(exam.id)
  const startReview = useStartDisputeReview(exam.id)
  const [resolveTarget, setResolveTarget] = useState(null)
  const [historyTarget, setHistoryTarget] = useState(null)

  const columns = [
    {
      key: 'candidate',
      header: 'Candidate',
      sortValue: (d) => d.candidate?.name?.toLowerCase() ?? '',
      cell: (d) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{d.candidate?.name}</p>
          <p className="truncate text-xs text-muted">{d.candidate?.email}</p>
        </div>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      sortValue: (d) => DISPUTE_CATEGORY_META[d.category]?.label ?? d.category,
      cell: (d) => {
        const meta = DISPUTE_CATEGORY_META[d.category]
        const Icon = meta?.icon
        return (
          <div className="flex items-center gap-2 text-sm">
            {Icon && <Icon className="size-4 shrink-0 text-muted" aria-hidden="true" />}
            <span>{meta?.label ?? d.category}</span>
          </div>
        )
      },
    },
    {
      key: 'question',
      header: 'Question',
      cell: (d) =>
        d.question ? (
          <div className="max-w-xs min-w-0">
            <p className="text-xs font-medium text-muted">
              Q<span className="num">{d.question.number}</span>
            </p>
            <p className="line-clamp-2 text-sm">{d.question.text}</p>
          </div>
        ) : (
          <span className="text-sm text-muted">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (d) => d.status,
      cell: (d) => <StatusBadge kind="dispute" status={d.status} />,
    },
    {
      key: 'dates',
      header: 'Raised',
      sortValue: (d) => d.createdAt,
      cell: (d) => (
        <div className="text-xs text-muted">
          <p className="num">{formatDateTime(d.createdAt)}</p>
          {d.resolvedAt && (
            <p className="num mt-0.5">
              Resolved {formatDateTime(d.resolvedAt)}
            </p>
          )}
        </div>
      ),
    },
    {
      key: 'resolution',
      header: 'Resolution',
      cell: (d) =>
        d.status === 'RESOLVED' ? (
          <div className="space-y-1">
            <StatusBadge kind="outcome" status={d.outcome} />
            <p className="line-clamp-2 text-xs text-muted">{d.resolutionReason}</p>
          </div>
        ) : (
          <p className="line-clamp-3 text-xs text-muted">{d.explanation}</p>
        ),
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (d) => {
        if (d.status === 'OPEN') {
          return (
            <Button
              size="sm"
              variant="secondary"
              loading={startReview.isPending}
              onClick={() => startReview.mutate(d.id)}
              aria-label={`Start review for ${d.candidate?.name}`}
            >
              Start review
            </Button>
          )
        }
        if (d.status === 'UNDER_REVIEW') {
          return (
            <Button size="sm" onClick={() => setResolveTarget(d)} aria-label={`Resolve dispute for ${d.candidate?.name}`}>
              <Gavel /> Resolve
            </Button>
          )
        }
        return (
          <Button size="sm" variant="ghost" onClick={() => setHistoryTarget(d)} aria-label={`View score history for ${d.candidate?.name}`}>
            <History /> Score history
          </Button>
        )
      },
    },
  ]

  const data = disputesQuery.data

  return (
    <div className="space-y-6">
      {disputesQuery.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : disputesQuery.error ? (
        <ErrorState compact error={disputesQuery.error} onRetry={disputesQuery.refetch} isRetrying={disputesQuery.isRefetching} />
      ) : (
        <>
          <WindowBanner window={data?.window} />
          <CountChips counts={data?.counts} />
        </>
      )}

      <section aria-labelledby="disputes-list-heading">
        <h2 id="disputes-list-heading" className="mb-3 flex items-center gap-2 text-base font-semibold">
          <Gavel className="size-4 text-primary" aria-hidden="true" />
          Disputes
          {data?.items && (
            <span className="num rounded-md bg-sunken px-2 py-0.5 text-sm text-muted">{data.items.length}</span>
          )}
        </h2>
        <DataTable
          caption="Exam disputes"
          columns={columns}
          rows={data?.items}
          isLoading={disputesQuery.isPending}
          error={disputesQuery.error}
          onRetry={disputesQuery.refetch}
          isRetrying={disputesQuery.isRefetching}
          pageSize={6}
          searchText={(d) =>
            `${d.candidate?.name} ${d.candidate?.email} ${d.explanation} ${d.question?.text ?? ''} ${DISPUTE_CATEGORY_META[d.category]?.label ?? ''}`
          }
          searchLabel="Search disputes"
          searchPlaceholder="Search by candidate or question…"
          initialSort={{ key: 'dates', dir: 'desc' }}
          filters={[
            {
              id: 'status',
              label: 'Status',
              options: [
                { value: '', label: 'All statuses' },
                { value: 'OPEN', label: 'Open' },
                { value: 'UNDER_REVIEW', label: 'Under review' },
                { value: 'RESOLVED', label: 'Resolved' },
              ],
              match: (row, value) => row.status === value,
            },
          ]}
          emptyState={
            <EmptyState
              icon={Gavel}
              title="No disputes yet"
              description="When candidates raise disputes about their results they will appear here for review."
            />
          }
        />
      </section>

      <ResolveDisputeDialog examId={exam.id} dispute={resolveTarget} open={Boolean(resolveTarget)} onOpenChange={(open) => !open && setResolveTarget(null)} />
      <ScoreHistoryDialog examId={exam.id} dispute={historyTarget} open={Boolean(historyTarget)} onOpenChange={(open) => !open && setHistoryTarget(null)} />
    </div>
  )
}