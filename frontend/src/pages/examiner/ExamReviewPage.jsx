import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Pencil, Send, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DescriptionList } from '@/components/DescriptionList'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { StatusBadge } from '@/components/StatusBadge'
import { ExamFlowStepper } from '@/components/exam/ExamFlowStepper'
import { ExamSettings } from '@/components/exam/ExamSettings'
import { useExam, useExamCandidates, usePublishExam } from '@/hooks/useExams'
import { useServerNow } from '@/hooks/useServerClock'
import { formatDateTime, formatDuration, formatWindow } from '@/lib/format'
import { pluralize } from '@/lib/utils'

function Checklist({ items }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.label} className="flex flex-col gap-2 px-6 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold">{item.label}</p>
            <p className="text-sm text-muted">{item.detail}</p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge kind="check" status={item.ok ? 'READY' : 'ATTENTION'} />
            {!item.ok && item.fix && (
              <Button asChild variant="link" size="sm">
                <Link to={item.fix.to}>{item.fix.label}</Link>
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function ExamReviewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: exam, isPending, error, refetch, isRefetching } = useExam(id)
  const { data: candidates } = useExamCandidates(id)
  const now = useServerNow(30000)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const publish = usePublishExam(id, {
    onSuccess: () => {
      setConfirmOpen(false)
      navigate(`/examiner/exams/${id}`)
    },
    onError: () => setConfirmOpen(false),
  })

  const header = (
    <PageHeader
      title="Review and publish"
      description="Check everything below. Once published, the exam details are locked and candidates can see it."
      back={{ to: `/examiner/exams/${id}`, label: 'Back to exam' }}
    />
  )

  if (error) {
    return (
      <>
        {header}
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="We couldn't load this exam" />
      </>
    )
  }

  if (isPending) {
    return (
      <>
        {header}
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading exam</span>
          <Skeleton className="h-10 w-72" />
          <Skeleton className="h-56 w-full" />
          <Skeleton className="h-44 w-full" />
        </div>
      </>
    )
  }

  const isDraft = exam.status === 'DRAFT'
  const startPassed = now !== null && new Date(exam.startAt).getTime() <= now
  const checks = [
    {
      label: 'Title and instructions',
      ok: Boolean(exam.title) && Boolean(exam.instructions?.trim()),
      detail: exam.instructions?.trim() ? 'Candidates will see clear instructions.' : 'No instructions yet. Candidates will have nothing to read before they start.',
      fix: { to: `/examiner/exams/${id}/edit`, label: 'Add instructions' },
    },
    {
      label: 'Schedule',
      ok: !startPassed,
      detail: startPassed ? 'The start time has already passed.' : `Opens ${formatDateTime(exam.startAt)}.`,
      fix: { to: `/examiner/exams/${id}/edit`, label: 'Change schedule' },
    },
    {
      label: 'Candidates',
      ok: (candidates?.length ?? exam.candidateCount) > 0,
      detail:
        (candidates?.length ?? exam.candidateCount) > 0
          ? `${pluralize(candidates?.length ?? exam.candidateCount, 'candidate')} enrolled.`
          : 'Nobody is enrolled yet. You can still publish and enroll people later.',
      fix: { to: `/examiner/exams/${id}?tab=candidates`, label: 'Enroll candidates' },
    },
  ]

  return (
    <>
      {header}
      <ExamFlowStepper current={1} />

      {!isDraft && (
        <p className="mb-6 flex items-center gap-2 rounded-lg border border-info/30 bg-info-soft p-3 text-sm font-medium text-info">
          <StatusBadge status={exam.status} />
          This exam has already been published.{' '}
          <Link to={`/examiner/exams/${id}`} className="underline">
            Go to the exam
          </Link>
        </p>
      )}

      <div className="space-y-6">
        <Card as="section" aria-labelledby="summary-heading">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <CardTitle id="summary-heading">{exam.title}</CardTitle>
            {isDraft && (
              <Button asChild variant="secondary" size="sm">
                <Link to={`/examiner/exams/${id}/edit`}>
                  <Pencil /> Edit details
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <DescriptionList
              items={[
                { label: 'Instructions', value: exam.instructions, wide: true },
                { label: 'Exam window', value: formatWindow(exam.startAt, exam.endAt), mono: true, wide: true },
                { label: 'Duration', value: formatDuration(exam.durationMinutes), mono: true },
                { label: 'Total marks', value: String(exam.totalMarks), mono: true },
              ]}
            />
          </CardContent>
        </Card>

        <Card as="section" aria-labelledby="settings-heading">
          <CardHeader>
            <CardTitle id="settings-heading">Settings</CardTitle>
          </CardHeader>
          <CardContent>
            <ExamSettings settings={exam.settings} />
          </CardContent>
        </Card>

        <Card as="section" aria-labelledby="readiness-heading">
          <CardHeader className="flex-row items-center justify-between gap-4">
            <CardTitle id="readiness-heading">Readiness</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/examiner/exams/${id}?tab=candidates`}>
                <Users /> Manage candidates
              </Link>
            </Button>
          </CardHeader>
          <Checklist items={checks} />
        </Card>

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button asChild variant="ghost">
            <Link to={`/examiner/exams/${id}`}>Back to exam</Link>
          </Button>
          <Button onClick={() => setConfirmOpen(true)} disabledReason={isDraft ? undefined : 'This exam has already been published.'}>
            <Send /> Publish exam
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Publish this exam?"
        description="Candidates you enrolled will see it straight away, and the exam details can no longer be edited."
        confirmLabel="Publish exam"
        isPending={publish.isPending}
        onConfirm={() => publish.mutate()}
      >
        <p className="rounded-md bg-sunken p-3 font-medium">
          {exam.title}
          <span className="num mt-1 block text-xs font-normal text-muted">{formatWindow(exam.startAt, exam.endAt)}</span>
        </p>
      </ConfirmDialog>
    </>
  )
}
