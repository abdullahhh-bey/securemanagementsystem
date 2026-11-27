import { useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, DoorOpen, Hourglass, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DescriptionList } from '@/components/DescriptionList'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/StatusBadge'
import { ExamSettings } from '@/components/exam/ExamSettings'
import { useCandidateExam } from '@/hooks/useCandidateExams'
import { useStartCandidateAttempt } from '@/hooks/useStudentPortal'
import { useCountdown } from '@/hooks/useServerClock'
import { formatCountdown, formatDuration, formatWindow } from '@/lib/format'

function WindowCountdown({ endAt }) {
  const { msLeft } = useCountdown(endAt)
  return (
    <Badge tone="success" icon={Hourglass} className="num px-2.5 py-1 text-sm" role="timer">
      {msLeft === null ? 'Checking time\u2026' : `Window closes in ${formatCountdown(msLeft)}`}
    </Badge>
  )
}

export default function CandidateExamPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: exam, isPending, error, refetch, isRefetching } = useCandidateExam(id)
  const start = useStartCandidateAttempt({
    onSuccess: (attempt) => navigate(`/candidate/exams/${id}/attempt/${attempt.id}`),
  })
  const back = { to: '/candidate/exams', label: 'Exams' }

  if (error) {
    return (
      <>
        <PageHeader title="Exam" back={back} />
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="You can't enter this exam" />
      </>
    )
  }

  if (isPending) {
    return (
      <>
        <PageHeader title="Opening exam" back={back} />
        <div className="space-y-6" role="status">
          <span className="sr-only">Checking your access</span>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </>
    )
  }

  return (
    <>
      <PageHeader title={exam.title} back={back} meta={<WindowCountdown endAt={exam.endAt} />} />

      <div className="space-y-6">
        <Card as="section" aria-labelledby="before-heading">
          <CardHeader>
            <CardTitle id="before-heading">Before you begin</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <DescriptionList
              items={[
                { label: 'Instructions', value: exam.instructions, wide: true },
                { label: 'Exam window', value: formatWindow(exam.startAt, exam.endAt), mono: true, wide: true },
                { label: 'Time to complete', value: formatDuration(exam.durationMinutes), mono: true },
                { label: 'Total marks', value: String(exam.totalMarks), mono: true },
              ]}
            />
            <ExamSettings settings={exam.settings} studentView />
          </CardContent>
        </Card>

        <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-sky/60 via-surface to-surface">
          <CardContent className="flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                <DoorOpen className="size-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold">Ready when you are</p>
                <p className="mt-1 max-w-xl text-sm text-muted">
                  Your answers save as you work. You can resume an in-progress attempt, but the timer continues while you are away.
                </p>
              </div>
            </div>
            <Button
              size="lg"
              loading={start.isPending}
              loadingLabel="Preparing your exam…"
              onClick={() => start.mutate(id)}
              className="sm:shrink-0"
            >
              <Play /> Start exam <ArrowRight />
            </Button>
          </CardContent>
        </Card>
        {start.error && (
          <p role="alert" className="rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
            {start.error.message}
          </p>
        )}
      </div>
    </>
  )
}
