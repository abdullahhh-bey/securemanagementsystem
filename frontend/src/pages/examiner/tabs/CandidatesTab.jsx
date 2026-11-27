import { useState } from 'react'
import { FileUp, Lock, UserMinus, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { ImportDialog } from '@/components/import/ImportDialog'
import { useAvailableCandidates, useEnrollCandidates, useExamCandidates, useRemoveCandidate } from '@/hooks/useExams'
import { useToast } from '@/hooks/useToast'
import { parseCandidateEnrollRecord } from '@/lib/importSchemas'
import { formatDateTime } from '@/lib/format'
import { pluralize } from '@/lib/utils'
import { CandidatePicker } from './CandidatePicker'

export function CandidatesTab({ exam }) {
  // The server decides what can change; this only mirrors the documented rules for a friendlier UI.
  const canEnroll = exam.status === 'DRAFT' || exam.status === 'PUBLISHED'
  const canRemove = canEnroll
  const toast = useToast()

  const enrolled = useExamCandidates(exam.id)
  const available = useAvailableCandidates(exam.id, { enabled: canEnroll })
  const [selected, setSelected] = useState([])
  const [removeTarget, setRemoveTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)

  const enroll = useEnrollCandidates(exam.id, { onSuccess: () => setSelected([]) })
  const remove = useRemoveCandidate(exam.id)

  // Ignore ids that are no longer enrollable (e.g. after a refetch).
  const availableIds = new Set((available.data ?? []).map((c) => c.id))
  const effectiveSelected = selected.filter((id) => availableIds.has(id))

  const columns = [
    {
      key: 'name',
      header: 'Candidate',
      sortValue: (c) => c.name.toLowerCase(),
      cell: (c) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{c.name}</p>
          <p className="truncate text-xs text-muted">{c.email}</p>
        </div>
      ),
    },
    { key: 'enrolledAt', header: 'Enrolled', sortValue: (c) => c.enrolledAt, cell: (c) => <span className="num text-xs text-muted">{formatDateTime(c.enrolledAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (c) => (
        <Button
          variant="ghost"
          size="sm"
          className="text-danger hover:bg-danger-soft"
          onClick={() => setRemoveTarget(c)}
          aria-label={`Remove ${c.name}`}
          disabledReason={canRemove ? undefined : "Candidates can't be removed once the exam has started."}
        >
          <UserMinus /> Remove
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {canEnroll ? (
        <Card as="section" aria-labelledby="enroll-heading">
          <CardHeader>
            <CardTitle id="enroll-heading">Enroll candidates</CardTitle>
            <CardDescription>Search, tick one or more people, then enroll them in one go.</CardDescription>
          </CardHeader>
          <CardContent>
            {available.error ? (
              <ErrorState compact error={available.error} onRetry={available.refetch} isRetrying={available.isRefetching} />
            ) : (
              <>
                <CandidatePicker
                  candidates={available.data ?? []}
                  selected={effectiveSelected}
                  onChange={setSelected}
                  isLoading={available.isPending}
                  disabled={enroll.isPending}
                />
                <div className="mt-4 flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
                  <p role="status" aria-live="polite" className="text-sm text-muted">
                    <span className="num font-semibold text-ink">{effectiveSelected.length}</span> selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="secondary" onClick={() => setImportOpen(true)}>
                      <FileUp /> Import CSV
                    </Button>
                    <Button
                      onClick={() => enroll.mutate(effectiveSelected)}
                      loading={enroll.isPending}
                      disabledReason={effectiveSelected.length === 0 ? 'Select at least one candidate first.' : undefined}
                    >
                      {!enroll.isPending && <UserPlus />}
                      Enroll {effectiveSelected.length > 0 ? pluralize(effectiveSelected.length, 'candidate') : 'selected'}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <p className="flex items-center gap-2 rounded-lg border border-border bg-surface p-3 text-sm text-muted">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          Enrollment is closed because this exam has {exam.status === 'ONGOING' ? 'started' : 'finished'}.
        </p>
      )}

      <section aria-labelledby="enrolled-heading">
        <h2 id="enrolled-heading" className="mb-3 flex items-center gap-2 text-base font-semibold">
          Enrolled candidates
          {enrolled.data && <span className="num rounded-md bg-sunken px-2 py-0.5 text-sm text-muted">{enrolled.data.length}</span>}
        </h2>
        <DataTable
          caption="Enrolled candidates"
          columns={columns}
          rows={enrolled.data}
          isLoading={enrolled.isPending}
          error={enrolled.error}
          onRetry={enrolled.refetch}
          isRetrying={enrolled.isRefetching}
          pageSize={6}
          searchText={(c) => `${c.name} ${c.email}`}
          searchLabel="Search enrolled candidates"
          searchPlaceholder="Search enrolled candidates"
          initialSort={{ key: 'name', dir: 'asc' }}
          emptyState={
            <EmptyState
              icon={Users}
              title="No candidates enrolled yet"
              description={canEnroll ? 'Pick people from the list above to give them access to this exam.' : 'Nobody was enrolled in this exam.'}
            />
          }
        />
      </section>

      <ConfirmDialog
        open={Boolean(removeTarget)}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
        title={`Remove ${removeTarget?.name}?`}
        description="They will no longer see this exam. You can enroll them again later."
        confirmLabel="Remove candidate"
        tone="danger"
        isPending={remove.isPending}
        onConfirm={() =>
          remove.mutate(removeTarget.enrollmentId ?? removeTarget.id, {
            onSettled: () => setRemoveTarget(null),
          })
        }
      />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import candidates"
        description="Upload a CSV or JSON file of emails. Only people who already have candidate accounts and are not already enrolled can be added."
        sampleHint="Required column: email"
        templateCsv={'email\r\ncandidate1@demo.com\r\ncandidate2@demo.com\r\n'}
        parseRecord={parseCandidateEnrollRecord}
        columns={[{ key: 'email', header: 'Email', cell: (row) => row.value.email }]}
        onImport={async (rows) => {
          const byEmail = new Map((available.data ?? []).map((c) => [c.email.toLowerCase(), c.id]))
          const ids = []
          const missing = []
          for (const row of rows) {
            const id = byEmail.get(row.email.toLowerCase())
            if (id) ids.push(id)
            else missing.push(row.email)
          }
          if (ids.length === 0) {
            throw new Error(
              missing.length
                ? 'None of those emails match an enrollable candidate account.'
                : 'No valid candidate emails to enroll.',
            )
          }
          await enroll.mutateAsync(ids)
          if (missing.length) {
            toast.error(`${missing.length} email${missing.length === 1 ? '' : 's'} could not be matched and were skipped.`)
          }
        }}
      />
    </div>
  )
}
