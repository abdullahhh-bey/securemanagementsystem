import { useMemo, useState } from 'react'
import { ScrollText, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input, Select } from '@/components/ui/input'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { RoleChip } from '@/components/StatusBadge'
import { useAuditLog } from '@/hooks/useAdmin'
import { AUDIT_ACTION_LABELS } from '@/lib/constants'
import { formatDateTime, localInputToIso } from '@/lib/format'

export default function AdminAuditPage() {
  const [draft, setDraft] = useState({ actorId: '', action: '', from: '', to: '' })

  const apiFilters = useMemo(() => {
    const next = {}
    if (draft.actorId) next.actorId = draft.actorId
    if (draft.action) next.action = draft.action
    if (draft.from) next.from = localInputToIso(draft.from)
    if (draft.to) next.to = localInputToIso(draft.to)
    return next
  }, [draft])

  const { data, isPending, error, refetch, isRefetching } = useAuditLog(apiFilters)

  const actorOptions = data?.actors ?? []
  const actionOptions = useMemo(
    () => (data?.actions ?? []).map((action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] ?? action })),
    [data?.actions],
  )

  const hasFilters = Object.values(draft).some(Boolean)

  const columns = [
    {
      key: 'at',
      header: 'When',
      sortValue: (e) => e.at,
      cell: (e) => <span className="num text-xs text-muted">{formatDateTime(e.at)}</span>,
    },
    { key: 'actorName', header: 'Actor', sortValue: (e) => e.actorName.toLowerCase(), cell: (e) => <span className="font-medium">{e.actorName}</span> },
    { key: 'actorRole', header: 'Role', sortValue: (e) => e.actorRole, cell: (e) => <RoleChip role={e.actorRole} /> },
    {
      key: 'action',
      header: 'Action',
      sortValue: (e) => e.action,
      cell: (e) => <span>{AUDIT_ACTION_LABELS[e.action] ?? e.action}</span>,
    },
    { key: 'target', header: 'Target', sortValue: (e) => e.target.toLowerCase(), cell: (e) => <span className="truncate">{e.target}</span> },
    { key: 'detail', header: 'Detail', cell: (e) => <span className="text-muted">{e.detail}</span> },
  ]

  return (
    <>
      <PageHeader title="Audit log" description="A read-only history of important actions across the system." />

      <Card className="mb-4 border-b-0 shadow-none">
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:flex-wrap md:items-end">
          <div className="flex flex-col gap-1.5 md:w-48">
            <label htmlFor="audit-actor" className="text-xs font-medium text-muted">
              Actor
            </label>
            <Select
              id="audit-actor"
              value={draft.actorId}
              disabled={isPending && !data}
              onChange={(event) => setDraft((current) => ({ ...current, actorId: event.target.value }))}
            >
              <option value="">All actors</option>
              {actorOptions.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 md:w-52">
            <label htmlFor="audit-action" className="text-xs font-medium text-muted">
              Action
            </label>
            <Select
              id="audit-action"
              value={draft.action}
              disabled={isPending && !data}
              onChange={(event) => setDraft((current) => ({ ...current, action: event.target.value }))}
            >
              <option value="">All actions</option>
              {actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-col gap-1.5 md:w-52">
            <label htmlFor="audit-from" className="text-xs font-medium text-muted">
              From
            </label>
            <Input
              id="audit-from"
              type="datetime-local"
              value={draft.from}
              disabled={isPending && !data}
              onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-1.5 md:w-52">
            <label htmlFor="audit-to" className="text-xs font-medium text-muted">
              To
            </label>
            <Input
              id="audit-to"
              type="datetime-local"
              value={draft.to}
              disabled={isPending && !data}
              onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))}
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="md" onClick={() => setDraft({ actorId: '', action: '', from: '', to: '' })}>
              <X /> Clear
            </Button>
          )}
        </div>
      </Card>

      <DataTable
        caption="Audit log entries"
        columns={columns}
        rows={data?.entries}
        isLoading={isPending}
        error={error}
        onRetry={refetch}
        isRetrying={isRefetching}
        initialSort={{ key: 'at', dir: 'desc' }}
        pageSize={10}
        emptyState={
          <EmptyState
            icon={ScrollText}
            title="No audit entries yet"
            description="Actions such as sign-ins, exam changes and account updates will appear here."
          />
        }
      />
    </>
  )
}