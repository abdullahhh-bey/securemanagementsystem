import { Link } from 'react-router-dom'
import { ArrowRight, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { useTeacherStudents } from '@/hooks/useTeacherStudents'
import { initials } from '@/lib/utils'
import { userDisplayName } from '@/lib/schema'

const COLUMNS = [
  {
    key: 'name',
    header: 'Student',
    sortValue: (student) => userDisplayName(student).toLowerCase(),
    cell: (student) => (
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sky text-sm font-bold text-primary-hover" aria-hidden="true">
          {initials(userDisplayName(student))}
        </span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-ink">{userDisplayName(student)}</p>
          <p className="truncate text-sm text-muted">{student.email}</p>
        </div>
      </div>
    ),
  },
  {
    key: 'email',
    header: 'Account',
    sortValue: (student) => student.email.toLowerCase(),
    cell: () => <span className="text-sm text-muted">Active student</span>,
  },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    className: 'text-right',
    cell: () => (
      <Button asChild variant="secondary" size="sm">
        <Link to="/examiner/exams">
          Manage enrollment <ArrowRight />
        </Link>
      </Button>
    ),
  },
]

export default function StudentsPage() {
  const { data: students, isPending, error, refetch, isRefetching } = useTeacherStudents()

  return (
    <>
      <PageHeader
        title="Students"
        description="Browse active student accounts. Exam access is managed through each exam’s enrollment list."
        actions={
          <Button asChild variant="secondary">
            <Link to="/examiner/exams">
              <ArrowRight /> View exams
            </Link>
          </Button>
        }
      />

      <DataTable
        caption="Active students"
        columns={COLUMNS}
        rows={students}
        isLoading={isPending}
        error={error}
        onRetry={refetch}
        isRetrying={isRefetching}
        searchText={(student) => `${userDisplayName(student)} ${student.email}`}
        searchLabel="Search students"
        searchPlaceholder="Search by name or email"
        initialSort={{ key: 'name', dir: 'asc' }}
        emptyState={
          <EmptyState
            icon={Users}
            title="No active students found"
            description="Active student accounts will appear here when they are available for exam enrollment."
          />
        }
      />
    </>
  )
}
