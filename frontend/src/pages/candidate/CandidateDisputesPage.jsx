import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Clock3, Gavel, MessageSquareText, Plus, Send } from 'lucide-react'
import { Badge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCandidateDisputes, useCandidateResults, useCreateCandidateDispute } from '@/hooks/useStudentPortal'
import { formatDateTime } from '@/lib/format'

const tones = { OPEN: 'warning', UNDER_REVIEW: 'info', RESOLVED: 'success', REJECTED: 'danger' }

export default function CandidateDisputesPage() {
  const [searchParams] = useSearchParams()
  const resultsQuery = useCandidateResults()
  const disputesQuery = useCandidateDisputes()
  const [open, setOpen] = useState(false)
  const [resultId, setResultId] = useState('')
  const [explanation, setExplanation] = useState('')
  const disputes = disputesQuery.data ?? []
  const results = resultsQuery.data ?? []
  const disputedResultIds = useMemo(
    () => new Set(disputes.map((dispute) => dispute.result?.id ?? dispute.resultId)),
    [disputes],
  )
  const eligibleResults = useMemo(
    () => results.filter((result) => result.status === 'PUBLISHED' && !disputedResultIds.has(result.id)),
    [disputedResultIds, results],
  )
  const selectedResult = eligibleResults.find((result) => result.id === resultId)
  const trimmedExplanation = explanation.trim()
  const create = useCreateCandidateDispute({
    onSuccess: () => {
      setOpen(false)
      setExplanation('')
      setResultId('')
    },
  })

  useEffect(() => {
    const requestedId = searchParams.get('resultId')
    if (requestedId && eligibleResults.some((result) => result.id === requestedId)) {
      setResultId(requestedId)
      setOpen(true)
    }
  }, [searchParams, eligibleResults])

  const openDialog = () => {
    setResultId(eligibleResults[0]?.id ?? '')
    setOpen(true)
  }
  const closeDialog = (next) => {
    if (!next && !create.isPending) {
      setOpen(false)
      setExplanation('')
    }
  }

  return (
    <>
      <PageHeader
        title="Disputes"
        description="Submit a concern about a published result and follow its review status."
        actions={
          <Button onClick={openDialog} disabledReason={eligibleResults.length ? undefined : 'There are no results available for a new dispute.'}>
            <Plus /> New dispute
          </Button>
        }
      />

      {disputesQuery.error ? (
        <ErrorState error={disputesQuery.error} onRetry={disputesQuery.refetch} isRetrying={disputesQuery.isRefetching} title="We couldn't load your disputes" />
      ) : disputesQuery.isPending ? (
        <div className="space-y-4" role="status">
          <span className="sr-only">Loading disputes</span>
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : disputes.length === 0 ? (
        <EmptyState
          icon={Gavel}
          title="No disputes submitted"
          description="If you believe a published result needs review, you can submit one dispute for that result."
          action={eligibleResults.length > 0 && <Button onClick={openDialog}><Plus /> Start a dispute</Button>}
        />
      ) : (
        <div className="space-y-4">
          {disputes.map((dispute) => (
            <Card key={dispute.id} as="article">
              <CardHeader className="flex-row items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="truncate">{dispute.result?.attempt?.exam?.title ?? 'Exam result'}</CardTitle>
                  <p className="mt-1 text-sm text-muted">Submitted {formatDateTime(dispute.createdAt)}</p>
                </div>
                <Badge tone={tones[dispute.status] ?? 'neutral'}>{String(dispute.status).replaceAll('_', ' ').toLowerCase()}</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-2 rounded-md bg-sunken p-3">
                  <MessageSquareText className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{dispute.explanation}</p>
                </div>
                {dispute.resolution && (
                  <div className="rounded-md border border-success/20 bg-success-soft p-3">
                    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-success">
                      <Clock3 className="size-3.5" aria-hidden="true" /> Examiner response
                    </p>
                    <p className="mt-1 text-sm">{dispute.resolution}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Submit a result dispute</DialogTitle>
            <DialogDescription>
              Explain what needs a second look. Your dispute is linked to one published result and can be submitted once.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 px-6 pb-2">
            <FormField label="Published result" required>
              {(field) => (
                <Select {...field} value={resultId} onChange={(event) => setResultId(event.target.value)} disabled={create.isPending}>
                  <option value="">Select a result</option>
                  {eligibleResults.map((result) => (
                    <option key={result.id} value={result.id}>
                      {result.attempt?.exam?.title ?? 'Exam result'} · {formatDateTime(result.publishedAt)}
                    </option>
                  ))}
                </Select>
              )}
            </FormField>
            <FormField
              label="Explanation"
              required
              hint={`${trimmedExplanation.length}/20 characters minimum`}
              error={trimmedExplanation.length > 0 && trimmedExplanation.length < 20 ? 'Please provide at least 20 characters.' : undefined}
            >
              {(field) => (
                <Textarea
                  {...field}
                  rows={5}
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  disabled={create.isPending}
                  placeholder="Describe the issue with your result…"
                />
              )}
            </FormField>
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => closeDialog(false)} disabled={create.isPending}>Cancel</Button>
            <Button
              loading={create.isPending}
              disabledReason={!selectedResult || trimmedExplanation.length < 20 ? 'Choose a result and write at least 20 characters.' : undefined}
              onClick={() => create.mutate({ resultId, explanation: trimmedExplanation })}
            >
              <Send /> Submit dispute
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
