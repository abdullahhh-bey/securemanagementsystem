import { BookOpenCheck } from 'lucide-react'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useAdminExams } from '@/hooks/useAdmin'
import { EXAM_STATUS_META } from '@/lib/constants'
import { formatWindow } from '@/lib/format'

const STATUS_OPTIONS = Object.entries(EXAM_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))

const FILTERS = [{ id: 'status', label: 'Status', allLabel: 'All statuses', options: STATUS_OPTIONS }]

const COLUMNS = [
  {
    key: 'title',
    header: 'Exam',
    sortValue: (e) => e.title.toLowerCase(),
    cell: (e) => <span className="font-semibold">{e.title}</span>,
  },
  {
    key: 'status',
    header: 'Status',
    sortValue: (e) => e.status,
    cell: (e) => <StatusBadge status={e.status} />,
  },
  {
    key: 'owner',
    header: 'Owner',
    sortValue: (e) => e.owner.name.toLowerCase(),
    cell: (e) => <span>{e.owner.name}</span>,
  },
  {
    key: 'window',
    header: 'Window',
    sortValue: (e) => e.startAt,
    cell: (e) => <span className="num text-muted">{formatWindow(e.startAt, e.endAt)}</span>,
  },
  {
    key: 'candidateCount',
    header: 'Candidates',
    sortValue: (e) => e.candidateCount,
    cell: (e) => <span className="num">{e.candidateCount}</span>,
  },
  {
    key: 'questionCount',
    header: 'Questions',
    sortValue: (e) => e.questionCount,
    cell: (e) => <span className="num">{e.questionCount}</span>,
  },
  {
    key: 'resultsState',
    header: 'Results',
    sortValue: (e) => e.resultsState,
    cell: (e) => <StatusBadge kind="results" status={e.resultsState} />,
  },
]

export default function AdminExamsPage() {
  const { data: exams, isPending, error, refetch, isRefetching } = useAdminExams()

  return (
    <>
      <PageHeader
        title="Exams"
        description="Every exam in the system, across all examiners."
      />
      <DataTable
        caption="All exams"
        columns={COLUMNS}
        rows={exams}
        isLoading={isPending}
        error={error}
        onRetry={refetch}
        isRetrying={isRefetching}
        searchText={(e) => `${e.title} ${e.owner.name}`}
        searchLabel="Search exams by title or owner"
        searchPlaceholder="Search by title or owner"
        filters={FILTERS}
        initialSort={{ key: 'startAt', dir: 'desc' }}
        emptyState={
          <EmptyState
            icon={BookOpenCheck}
            title="No exams yet"
            description="When examiners create exams they will show up here."
          />
        }
      />
    </>
  )
}