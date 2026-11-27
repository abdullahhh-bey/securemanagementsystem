import { useParams } from 'react-router-dom'
import { DoorOpen, Hourglass, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { DescriptionList } from '@/components/DescriptionList'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/StatusBadge'
import { ExamSettings } from '@/components/exam/ExamSettings'
import { useCandidateExam } from '@/hooks/useCandidateExams'
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
  const { data: exam, isPending, error, refetch, isRefetching } = useCandidateExam(id)
  const back = { to: '/candidate', label: 'My exams' }

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

        <Card className="border-dashed">
          <CardContent className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <DoorOpen className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
              <div>
                <p className="font-semibold">The exam room is coming next</p>
                <p className="text-sm text-muted">Access is confirmed. Questions and the answer sheet arrive in the next release.</p>
              </div>
            </div>
            <Button size="lg" disabledReason="Questions are not available yet.">
              <Play /> Start exam
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
