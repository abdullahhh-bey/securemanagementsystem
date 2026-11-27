import { useState } from 'react'
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
import { ROLES } from '@/lib/constants'
import { formatDate } from '@/lib/format'
import { userDisplayName } from '@/lib/schema'
import { initials } from '@/lib/utils'
import { CreateUserDialog } from './CreateUserDialog'
import { EditRoleDialog } from './EditRoleDialog'

const STATUS_FILTER = {
  id: 'status',
  label: 'Status',
  allLabel: 'All',
  options: [
    { value: 'ACTIVE', label: 'Active' },
    { value: 'INACTIVE', label: 'Inactive' },
  ],
  match: (user, value) => (value === 'ACTIVE') === user.isActive,
}

const PAGE = {
  [ROLES.EXAMINER]: {
    title: 'Teachers',
    caption: 'Teacher accounts',
    empty: 'No teachers yet',
    createLabel: 'Create teacher',
    defaultRole: ROLES.EXAMINER,
    allowedRoles: [ROLES.EXAMINER, ROLES.ADMIN],
  },
  [ROLES.CANDIDATE]: {
    title: 'Students',
    caption: 'Student accounts',
    empty: 'No students yet',
    createLabel: 'Create student',
    defaultRole: ROLES.CANDIDATE,
    allowedRoles: [ROLES.CANDIDATE],
  },
}

/**
 * @param {{ roleFilter: 'EXAMINER' | 'CANDIDATE' }} props
 */
export default function AdminUsersPage({ roleFilter }) {
  const config = PAGE[roleFilter] ?? PAGE[ROLES.CANDIDATE]
  const { user: me } = useAuth()
  const { data: users, isPending, error, refetch, isRefetching } = useUsers()
  const [createOpen, setCreateOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState(null)
  const [toggleTarget, setToggleTarget] = useState(null)

  const filtered = (users ?? []).filter((u) =>
    roleFilter === ROLES.EXAMINER ? u.role === ROLES.EXAMINER || u.role === ROLES.ADMIN : u.role === ROLES.CANDIDATE,
  )

  const updateUser = useUpdateUser({
    successMessage: (updated) => `${userDisplayName(updated)} is now ${updated.isActive ? 'active' : 'inactive'}`,
  })

  const columns = [
    {
      key: 'name',
      header: 'User',
      sortValue: (u) => userDisplayName(u).toLowerCase(),
      cell: (u) => (
        <div className="flex items-center gap-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-sunken text-xs font-bold" aria-hidden="true">
            {initials(userDisplayName(u))}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-2 font-semibold">
              <span className="truncate">{userDisplayName(u)}</span>
              {u.id === me.id && <span className="rounded bg-sky px-1.5 py-0.5 text-xs font-semibold text-primary-hover">You</span>}
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
            aria-label={`${u.isActive ? 'Deactivate' : 'Activate'} ${userDisplayName(u)}`}
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
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setRoleTarget(u)}
            aria-label={`Change role for ${userDisplayName(u)}`}
            disabledReason={u.id === me.id ? "You can't change your own role." : undefined}
          >
            <Pencil /> Role
          </Button>
        </div>
      ),
    },
  ]

  const deactivating = toggleTarget?.isActive

  return (
    <>
      <PageHeader
        title={config.title}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <UserPlus /> {config.createLabel}
          </Button>
        }
      />

      <DataTable
        caption={config.caption}
        columns={columns}
        rows={filtered}
        isLoading={isPending}
        error={error}
        onRetry={refetch}
        isRetrying={isRefetching}
        searchText={(u) => `${userDisplayName(u)} ${u.email}`}
        searchLabel={`Search ${config.title.toLowerCase()}`}
        searchPlaceholder="Search by name or email"
        filters={[STATUS_FILTER]}
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyState={
          <EmptyState
            icon={Users}
            title={config.empty}
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <UserPlus /> {config.createLabel}
              </Button>
            }
          />
        }
      />

      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        defaultRole={config.defaultRole}
        allowedRoles={config.allowedRoles.filter((role) => role !== ROLES.ADMIN)}
        title={config.createLabel}
      />

      <EditRoleDialog
        user={roleTarget}
        onOpenChange={(open) => !open && setRoleTarget(null)}
        allowedRoles={config.allowedRoles.filter((role) => role !== ROLES.ADMIN)}
      />

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onOpenChange={(open) => !open && setToggleTarget(null)}
        title={deactivating ? `Deactivate ${userDisplayName(toggleTarget)}?` : `Activate ${userDisplayName(toggleTarget)}?`}
        confirmLabel={deactivating ? 'Deactivate' : 'Activate'}
        tone={deactivating ? 'danger' : 'primary'}
        isPending={updateUser.isPending}
        onConfirm={() => updateUser.mutate({ id: toggleTarget.id, isActive: !toggleTarget.isActive }, { onSettled: () => setToggleTarget(null) })}
      />

    </>
  )
}
