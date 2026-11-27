import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, ClipboardList } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { useExams } from '@/hooks/useExams'
import { EXAM_STATUS_META } from '@/lib/constants'
import { formatDuration, formatWindow } from '@/lib/format'

const STATUS_OPTIONS = Object.entries(EXAM_STATUS_META).map(([value, meta]) => ({ value, label: meta.label }))

const FILTERS = [{ id: 'status', label: 'Status', allLabel: 'All statuses', options: STATUS_OPTIONS }]

const COLUMNS = [
  {
    key: 'title',
    header: 'Exam',
    sortValue: (e) => e.title.toLowerCase(),
    cell: (e) => (
      <Link to={`/examiner/exams/${e.id}`} className="rounded-sm font-semibold hover:text-primary-hover hover:underline">
        {e.title}
      </Link>
    ),
  },
  { key: 'status', header: 'Status', sortValue: (e) => e.status, cell: (e) => <StatusBadge status={e.status} /> },
  {
    key: 'startAt',
    header: 'Window',
    sortValue: (e) => e.startAt,
    cell: (e) => <span className="text-muted">{formatWindow(e.startAt, e.endAt)}</span>,
  },
  { key: 'duration', header: 'Duration', sortValue: (e) => e.durationMinutes, cell: (e) => <span className="num">{formatDuration(e.durationMinutes)}</span> },
  { key: 'candidateCount', header: 'Candidates', sortValue: (e) => e.candidateCount, cell: (e) => <span className="num">{e.candidateCount}</span> },
  {
    key: 'actions',
    header: <span className="sr-only">Actions</span>,
    className: 'text-right',
    cell: (e) => (
      <Button asChild variant="ghost" size="sm">
        <Link to={`/examiner/exams/${e.id}`} aria-label={`Open ${e.title}`}>
          Open <ChevronRight />
        </Link>
      </Button>
    ),
  },
]

export default function ExamsListPage() {
  const [searchParams] = useSearchParams()
  const status = searchParams.get('status')
  const initialStatus = status && EXAM_STATUS_META[status] ? status : ''
  const { data: exams, isPending, error, refetch, isRefetching } = useExams()

  return (
    <>
      <PageHeader
        title="Exams"
        description="Every exam you have created, from first draft to final results."
      />
      <DataTable
        caption="Your exams"
        columns={COLUMNS}
        rows={exams}
        isLoading={isPending}
        error={error}
        onRetry={refetch}
        isRetrying={isRefetching}
        searchText={(e) => e.title}
        searchLabel="Search exams by title"
        searchPlaceholder="Search by title"
        filters={FILTERS}
        initialFilters={{ status: initialStatus }}
        initialSort={{ key: 'startAt', dir: 'desc' }}
        emptyState={
          <EmptyState
            icon={ClipboardList}
            title="You haven't created any exams yet"
            description="Use Create exam in the teacher navigation to set up your first assessment."
          />
        }
      />
    </>
  )
}
