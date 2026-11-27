import { ArrowRight, CalendarClock, CircleAlert, Hourglass, Trophy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { formatDuration, formatWindow } from '@/lib/format'
import { AccessChip } from './AccessChip'

const BLOCKED_REASON = {
  UPCOMING: "This exam hasn't opened yet.",
  CLOSED: 'This exam has closed.',
}

function Fact({ icon: Icon, label, children }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      <Icon className="size-4 shrink-0" aria-hidden="true" />
      <span className="sr-only">{label}: </span>
      <span>{children}</span>
    </div>
  )
}

export function CandidateExamCard({ exam, onEnter, isEntering, entryError, onElapsed }) {
  const available = exam.accessStatus === 'AVAILABLE'
  const titleId = `exam-${exam.id}-title`
  return (
    <Card as="article" aria-labelledby={titleId} className="p-6 sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <h3 id={titleId} className="text-xl font-bold">
          {exam.title}
        </h3>
        <div className="shrink-0">
          <AccessChip exam={exam} onElapsed={onElapsed} />
        </div>
      </div>

      {exam.instructions && <p className="mt-3 line-clamp-2 max-w-2xl text-pretty leading-relaxed text-muted">{exam.instructions}</p>}

      <div className="mt-5 flex flex-col gap-2">
        <Fact icon={CalendarClock} label="Exam window">
          <span className="num">{formatWindow(exam.startAt, exam.endAt)}</span>
        </Fact>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          <Fact icon={Hourglass} label="Duration">
            <span className="num">{formatDuration(exam.durationMinutes)}</span> to complete
          </Fact>
          <Fact icon={Trophy} label="Total marks">
            <span className="num">{exam.totalMarks}</span> marks
          </Fact>
        </div>
      </div>

      {entryError && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft p-3 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {entryError}
        </p>
      )}

      <div className="mt-6 flex">
        <Button
          size="lg"
          onClick={() => onEnter(exam)}
          loading={isEntering}
          disabledReason={available ? undefined : (BLOCKED_REASON[exam.accessStatus] ?? 'This exam is not available.')}
          aria-label={`Enter exam: ${exam.title}`}
        >
          {isEntering ? 'Checking access\u2026' : 'Enter exam'}
          {!isEntering && <ArrowRight />}
        </Button>
      </div>
    </Card>
  )
}
