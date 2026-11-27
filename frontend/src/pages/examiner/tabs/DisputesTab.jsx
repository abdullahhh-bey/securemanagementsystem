import { useState } from 'react'
import { Gavel } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, Textarea } from '@/components/ui/input'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/StatusBadge'
import { useDisputes, useResolveDispute, useStartDisputeReview } from '@/hooks/useDisputes'
import { formatDateTime } from '@/lib/format'

function ResolveDialog({ dispute, open, onOpenChange }) {
  const [status, setStatus] = useState('RESOLVED')
  const [resolution, setResolution] = useState('')
  const update = useResolveDispute(dispute?.examId, {
    onSuccess: () => {
      setResolution('')
      setStatus('RESOLVED')
      onOpenChange(false)
    },
  })

  const close = (next) => {
    if (update.isPending) return
    if (!next) {
      setResolution('')
      setStatus('RESOLVED')
    }
    onOpenChange(next)
  }
  const explanation = resolution.trim()

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update dispute</DialogTitle>
          <DialogDescription>
            Record a resolution for {dispute?.candidate?.name ?? 'the candidate'}. The response will be visible to them.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 px-6 pb-2">
          <FormField label="Decision" required>
            {(field) => (
              <Select {...field} value={status} onChange={(event) => setStatus(event.target.value)} disabled={update.isPending}>
                <option value="RESOLVED">Resolve</option>
                <option value="REJECTED">Reject</option>
              </Select>
            )}
          </FormField>
          <FormField label="Response" required hint="Explain your decision to the candidate.">
            {(field) => (
              <Textarea
                {...field}
                value={resolution}
                onChange={(event) => setResolution(event.target.value)}
                disabled={update.isPending}
                placeholder="Write the decision and any relevant details…"
              />
            )}
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => close(false)} disabled={update.isPending}>Cancel</Button>
          <Button
            loading={update.isPending}
            disabledReason={!explanation ? 'Enter a response before submitting.' : undefined}
            onClick={() => update.mutate({ disputeId: dispute.id, status, resolution: explanation })}
          >
            Save decision
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function DisputesTab({ exam }) {
  const disputesQuery = useDisputes(exam.id)
  const startReview = useStartDisputeReview(exam.id)
  const [target, setTarget] = useState(null)
  const rows = disputesQuery.data ?? []

  const columns = [
    {
      key: 'candidate',
      header: 'Candidate',
      sortValue: (dispute) => dispute.candidate.name.toLowerCase(),
      cell: (dispute) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{dispute.candidate.name}</p>
          <p className="truncate text-xs text-muted">{dispute.candidate.email}</p>
        </div>
      ),
    },
    {
      key: 'explanation',
      header: 'Concern',
      cell: (dispute) => <p className="line-clamp-3 max-w-md text-sm">{dispute.explanation}</p>,
    },
    {
      key: 'status',
      header: 'Status',
      sortValue: (dispute) => dispute.status,
      cell: (dispute) => <StatusBadge kind="dispute" status={dispute.status} />,
    },
    {
      key: 'createdAt',
      header: 'Submitted',
      sortValue: (dispute) => dispute.createdAt,
      cell: (dispute) => <span className="num text-xs text-muted">{formatDateTime(dispute.createdAt)}</span>,
    },
    {
      key: 'resolution',
      header: 'Examiner response',
      cell: (dispute) => <p className="line-clamp-3 max-w-xs text-sm text-muted">{dispute.resolution ?? '—'}</p>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (dispute) => {
        if (dispute.status === 'OPEN') {
          return (
            <Button
              size="sm"
              variant="secondary"
              loading={startReview.isPending}
              onClick={() => startReview.mutate(dispute.id)}
            >
              Start review
            </Button>
          )
        }
        if (dispute.status === 'UNDER_REVIEW') {
          return <Button size="sm" onClick={() => setTarget(dispute)}>Record decision</Button>
        }
        return <span className="text-sm text-muted">Closed</span>
      },
    },
  ]

  return (
    <div className="space-y-5">
      {disputesQuery.isPending ? (
        <Skeleton className="h-16 w-full" />
      ) : disputesQuery.error ? (
        <ErrorState compact error={disputesQuery.error} onRetry={disputesQuery.refetch} isRetrying={disputesQuery.isRefetching} />
      ) : (
        <p className="text-sm text-muted">
          {rows.length} dispute{rows.length === 1 ? '' : 's'} for this exam.
        </p>
      )}
      <DataTable
        caption="Exam disputes"
        columns={columns}
        rows={rows}
        isLoading={disputesQuery.isPending}
        error={disputesQuery.error}
        onRetry={disputesQuery.refetch}
        isRetrying={disputesQuery.isRefetching}
        pageSize={6}
        searchText={(dispute) => `${dispute.candidate.name} ${dispute.candidate.email} ${dispute.explanation}`}
        searchLabel="Search disputes"
        searchPlaceholder="Search by candidate or explanation…"
        initialSort={{ key: 'createdAt', dir: 'desc' }}
        filters={[
          {
            id: 'status',
            label: 'Status',
            options: [
              { value: '', label: 'All statuses' },
              { value: 'OPEN', label: 'Open' },
              { value: 'UNDER_REVIEW', label: 'Under review' },
              { value: 'RESOLVED', label: 'Resolved' },
              { value: 'REJECTED', label: 'Rejected' },
            ],
            match: (row, value) => row.status === value,
          },
        ]}
        emptyState={<EmptyState icon={Gavel} title="No disputes yet" description="Candidate disputes for this exam will appear here." />}
      />
      <ResolveDialog dispute={target} open={Boolean(target)} onOpenChange={(open) => !open && setTarget(null)} />
    </div>
  )
}
