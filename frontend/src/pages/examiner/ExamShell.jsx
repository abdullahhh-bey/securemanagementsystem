import { Suspense, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate, useParams } from 'react-router-dom'
import {
  Activity,
  BarChart3,
  ClipboardCheck,
  Eye,
  FileText,
  Gavel,
  HelpCircle,
  Pencil,
  Send,
  Trash2,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ExamLifecycle } from '@/components/exam/ExamLifecycle'
import { useDeleteExam, useExam } from '@/hooks/useExams'
import { formatWindow } from '@/lib/format'
import { examWindow, normalizeExam } from '@/lib/schema'
import { cn } from '@/lib/utils'

const SECTIONS = [
  { to: '', label: 'Details', icon: FileText, end: true },
  { to: 'candidates', label: 'Candidates', icon: Users },
  { to: 'questions', label: 'Questions', icon: HelpCircle },
  { to: 'monitor', label: 'Monitor', icon: Activity },
  { to: 'grading', label: 'Grading', icon: ClipboardCheck },
  { to: 'results', label: 'Results', icon: BarChart3 },
  { to: 'disputes', label: 'Disputes', icon: Gavel },
]

function ShellSkeleton() {
  return (
    <div className="space-y-6" role="status">
      <span className="sr-only">Loading exam</span>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}

export default function ExamShell() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isPending, error, refetch, isRefetching } = useExam(id)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const deleteExam = useDeleteExam({ onSuccess: () => navigate('/examiner/exams', { replace: true }) })

  const back = { to: '/examiner/exams', label: 'Exams' }
  const exam = normalizeExam(data)
  const window = exam ? examWindow(exam) : null

  if (error) {
    return (
      <>
        <PageHeader title="Exam" back={back} />
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="Could not load this exam" />
      </>
    )
  }

  if (isPending || !exam) {
    return (
      <>
        <PageHeader title="Exam" back={back} />
        <ShellSkeleton />
      </>
    )
  }

  const isDraft = exam.status === 'DRAFT'
  const base = `/examiner/exams/${exam.id}`

  return (
    <>
      <PageHeader
        title={exam.title}
        back={back}
        meta={
          <>
            <StatusBadge status={exam.status} />
            <span className="num text-sm text-muted">{formatWindow(window.startsAt, window.endsAt)}</span>
          </>
        }
        actions={
          <>
            <Button asChild variant="secondary" size="sm">
              <Link to={`${base}/sandbox`}>
                <Eye /> Preview
              </Link>
            </Button>
            {isDraft ? (
              <>
                <Button asChild variant="secondary" size="sm">
                  <Link to={`${base}/edit`}>
                    <Pencil /> Edit
                  </Link>
                </Button>
                <Button asChild size="sm">
                  <Link to={`${base}/review`}>
                    <Send /> Publish
                  </Link>
                </Button>
                <Button variant="danger-outline" size="icon-sm" onClick={() => setDeleteOpen(true)} aria-label="Delete draft">
                  <Trash2 />
                </Button>
              </>
            ) : null}
          </>
        }
      />

      <div className="mb-5 rounded-lg border border-border bg-surface px-4 py-4 sm:px-5">
        <ExamLifecycle status={exam.status} />
      </div>

      <nav aria-label="Exam sections" className="mb-6 flex gap-1 overflow-x-auto border-b border-border pb-px">
        {SECTIONS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={label}
            to={to ? `${base}/${to}` : base}
            end={end}
            className={({ isActive }) =>
              cn(
                'inline-flex shrink-0 items-center gap-2 rounded-t-md px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted hover:bg-sunken hover:text-ink',
              )
            }
          >
            <Icon className="size-4" aria-hidden="true" />
            {label}
            {to === 'candidates' ? (
              <span className="num rounded bg-sunken px-1.5 text-xs text-ink">{exam.candidateCount ?? 0}</span>
            ) : null}
          </NavLink>
        ))}
      </nav>

      <Suspense
        fallback={
          <div className="space-y-4" role="status">
            <span className="sr-only">Loading</span>
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <Outlet context={{ exam }} />
      </Suspense>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Delete this draft?"
        description={`"${exam.title}" will be removed permanently.`}
        confirmLabel="Delete"
        tone="danger"
        isPending={deleteExam.isPending}
        onConfirm={() => deleteExam.mutate(exam.id, { onError: () => setDeleteOpen(false) })}
      />
    </>
  )
}
