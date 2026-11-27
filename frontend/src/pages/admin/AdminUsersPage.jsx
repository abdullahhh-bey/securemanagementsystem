import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Pencil, UserPlus, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { RoleChip, StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { useUpdateUser, useUsers } from '@/hooks/useUsers'
import { ROLE_OPTIONS } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { initials } from '@/lib/utils'
import { CreateUserDialog } from './CreateUserDialog'
import { EditRoleDialog } from './EditRoleDialog'

const FILTERS = [
  { id: 'role', label: 'Role', allLabel: 'All roles', options: ROLE_OPTIONS },
  {
    id: 'status',
    label: 'Status',
    allLabel: 'All statuses',
    options: [
      { value: 'ACTIVE', label: 'Active' },
      { value: 'INACTIVE', label: 'Inactive' },
    ],
    match: (user, value) => (value === 'ACTIVE') === user.isActive,
  },
]

export default function AdminUsersPage() {
  const { user: me } = useAuth()
  const [searchParams] = useSearchParams()
  const initialRole = ROLE_OPTIONS.some((o) => o.value === searchParams.get('role')) ? searchParams.get('role') : ''

  const { data: users, isPending, error, refetch, isRefetching } = useUsers()
  const [createOpen, setCreateOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)

  const updateUser = useUpdateUser({
    successMessage: (updated) => `${updated.name} is now ${updated.isActive ? 'active' : 'inactive'}`,
  })

  const columns = [
    {
      key: 'name',
      header: 'User',
      sortValue: (u) => u.name.toLowerCase(),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold" aria-hidden="true">
            {initials(u.name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <span className="truncate">{u.name}</span>
              {u.id === me.id && <span className="rounded bg-primary-soft px-1.5 py-0.5 text-xs font-semibold text-primary-hover">You</span>}
            </p>
            <p className="truncate text-xs text-muted">{u.email}</p>
          </div>
        </div>
      ),
    },
    { key: 'role', header: 'Role', sortValue: (u) => u.role, cell: (u) => <RoleChip role={u.role} /> },
    {
      key: 'status',
      header: 'Status',
      sortValue: (u) => Number(u.isActive),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <Switch
            checked={u.isActive}
            onCheckedChange={() => setToggleTarget(u)}
            aria-label={`${u.isActive ? 'Deactivate' : 'Activate'} ${u.name}`}
            disabledReason={u.id === me.id ? "You can't deactivate your own account." : undefined}
          />
          <StatusBadge kind="account" status={u.isActive ? 'ACTIVE' : 'INACTIVE'} />
        </div>
      ),
    },
    { key: 'createdAt', header: 'Created', sortValue: (u) => u.createdAt, cell: (u) => <span className="num text-xs text-muted">{formatDate(u.createdAt)}</span> },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (u) => (
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setRoleTarget(u)}
          aria-label={`Change role for ${u.name}`}
          disabledReason={u.id === me.id ? "You can't change your own role." : undefined}
        >
          <Pencil /> Change role
        </Button>
      ),
    },
  ]

  const deactivating = toggleTarget?.isActive

  return (
    <>
      <PageHeader
        title="Users"
        description="Create accounts, change roles and control who can sign in."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus /> Create user
          </Button>
        }
      />

      <DataTable
        caption="All user accounts"
        columns={columns}
        rows={users}
        isLoading={isPending}
        error={error}
        onRetry={refetch}
        isRetrying={isRefetching}
        searchText={(u) => `${u.name} ${u.email}`}
        searchLabel="Search users by name or email"
        searchPlaceholder="Search by name or email"
        filters={FILTERS}
        initialFilters={{ role: initialRole }}
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyState={
          <EmptyState
            icon={Users}
            title="No users yet"
            description="Create the first account to get people into the system."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <UserPlus /> Create user
              </Button>
            }
          />
        }
      />

      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditRoleDialog user={roleTarget} onOpenChange={(open) => !open && setRoleTarget(null)} />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={deactivating ? `Deactivate ${toggleTarget?.name}?` : `Activate ${toggleTarget?.name}?`}
        description={
          deactivating
            ? 'They will be signed out and will not be able to sign in until you activate the account again.'
            : 'They will be able to sign in again with their existing password.'
        }
        confirmLabel={deactivating ? 'Deactivate' : 'Activate'}
        tone={deactivating ? 'danger' : 'primary'}
        isPending={updateUser.isPending}
        onConfirm={() => updateUser.mutate({ id: toggleTarget.id, isActive: !toggleTarget.isActive }, { onSettled: () => setToggleTarget(null) })}
      />
    </>
  )
}