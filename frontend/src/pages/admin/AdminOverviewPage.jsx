import { lazy, Suspense } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, GraduationCap, PencilLine, ScrollText, ShieldCheck, UserCheck, UserX, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { RoleChip } from '@/components/StatusBadge'
import { StatCard } from '@/components/StatCard'
import { useAuditLog } from '@/hooks/useAdmin'
import { useUsers } from '@/hooks/useUsers'
import { AUDIT_ACTION_LABELS } from '@/lib/constants'
import { formatDate, formatDateTime } from '@/lib/format'
import { userDisplayName } from '@/lib/schema'

const UsersByRoleChart = lazy(() => import('@/components/charts/UsersByRoleChart'))

export default function AdminOverviewPage() {
  const { data: users, isPending, error, refetch, isRefetching } = useUsers()
  const { data: audit, isPending: auditPending } = useAuditLog({})
  const recentActivity = audit?.entries?.slice(0, 10) ?? []

  const count = (predicate) => (users ? users.filter(predicate).length : 0)
  const recent = users ? [...users].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5) : []

  const stats = [
    { label: 'Users', value: users?.length ?? 0, icon: Users, tone: 'brand', to: '/admin/teachers' },
    { label: 'Admins', value: count((u) => u.role === 'ADMIN'), icon: ShieldCheck, to: '/admin/teachers' },
    { label: 'Teachers', value: count((u) => u.role === 'EXAMINER'), icon: PencilLine, to: '/admin/teachers' },
    { label: 'Students', value: count((u) => u.role === 'CANDIDATE'), icon: GraduationCap, to: '/admin/students' },
    { label: 'Active', value: count((u) => u.isActive), icon: UserCheck, tone: 'success' },
    { label: 'Inactive', value: count((u) => !u.isActive), icon: UserX, tone: 'warning' },
  ]

  return (
    <>
      <PageHeader title="Overview" />

      {error ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="Could not load overview" />
      ) : (
        <div className="space-y-6">
          <section aria-label="Account statistics" className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-3">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} loading={isPending} />
            ))}
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Card as="section" aria-labelledby="chart-heading">
              <CardHeader>
                <CardTitle id="chart-heading">Accounts by role</CardTitle>
              </CardHeader>
              <CardContent>
                {isPending ? (
                  <Skeleton className="h-72 w-full" />
                ) : (
                  <Suspense fallback={<Skeleton className="h-72 w-full" />}>
                    <UsersByRoleChart users={users} />
                  </Suspense>
                )}
              </CardContent>
            </Card>

            <Card as="section" aria-labelledby="recent-heading">
              <CardHeader>
                <CardTitle id="recent-heading">Recently added</CardTitle>
              </CardHeader>
              <ul className="divide-y divide-border">
                {isPending
                  ? Array.from({ length: 5 }, (_, i) => (
                      <li key={i} className="flex items-center justify-between px-6 py-3.5">
                        <Skeleton className="h-9 w-40" />
                        <Skeleton className="h-5 w-20" />
                      </li>
                    ))
                  : recent.map((user) => (
                      <li key={user.id} className="flex items-center justify-between gap-3 px-6 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{userDisplayName(user)}</p>
                          <p className="text-xs text-muted">{formatDate(user.createdAt)}</p>
                        </div>
                        <RoleChip role={user.role} />
                      </li>
                    ))}
              </ul>
            </Card>
          </div>

          <Card as="section" aria-labelledby="activity-heading">
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
              <CardTitle id="activity-heading">Recent activity</CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link to="/admin/audit">
                  View all <ArrowRight />
                </Link>
              </Button>
            </CardHeader>
            <ul className="divide-y divide-border">
              {auditPending
                ? Array.from({ length: 6 }, (_, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 px-6 py-3.5">
                      <Skeleton className="h-9 w-56" />
                      <Skeleton className="h-4 w-24" />
                    </li>
                  ))
                : recentActivity.length === 0
                  ? (
                      <li className="px-6 py-8">
                        <EmptyState compact icon={ScrollText} title="No activity yet" />
                      </li>
                    )
                  : recentActivity.map((entry) => (
                      <li key={entry.id} className="flex items-start justify-between gap-3 px-6 py-3.5">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {AUDIT_ACTION_LABELS[entry.action] ?? entry.action}
                          </p>
                          <p className="truncate text-xs text-muted">
                            {entry.actorName ?? 'System'}
                            {entry.target ? ` · ${entry.target}` : ''}
                          </p>
                        </div>
                        <time className="num shrink-0 text-xs text-muted" dateTime={entry.at}>
                          {formatDateTime(entry.at)}
                        </time>
                      </li>
                    ))}
            </ul>
          </Card>
        </div>
      )}
    </>
  )
}
