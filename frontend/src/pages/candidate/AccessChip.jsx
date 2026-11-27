import { Clock, DoorOpen, LoaderCircle, LockKeyhole } from 'lucide-react'
import { Badge } from '@/components/StatusBadge'
import { useCountdown } from '@/hooks/useServerClock'
import { formatCountdown, formatDateTime } from '@/lib/format'

function UpcomingChip({ exam, onElapsed }) {
  // Counts down on the server clock; when it hits zero the list is re-fetched
  // and the server's accessStatus decides whether the exam is really open.
  const { msLeft, elapsed } = useCountdown(exam.startAt, onElapsed)
  const label = msLeft === null ? 'Checking time\u2026' : elapsed ? 'Opening now\u2026' : `Opens in ${formatCountdown(msLeft)}`
  return (
    <Badge tone="info" icon={elapsed ? LoaderCircle : Clock} className="num px-2.5 py-1 text-sm" role="timer" aria-label={`Opens ${formatDateTime(exam.startAt)}`} title={`Opens ${formatDateTime(exam.startAt)}`}>
      {label}
    </Badge>
  )
}

/** Access chip: icon + text, driven by the server's `accessStatus`. */
export function AccessChip({ exam, onElapsed }) {
  if (exam.accessStatus === 'AVAILABLE') {
    return (
      <Badge tone="success" icon={DoorOpen} className="px-2.5 py-1 text-sm">
        Enter exam
      </Badge>
    )
  }
  if (exam.accessStatus === 'UPCOMING') return <UpcomingChip exam={exam} onElapsed={onElapsed} />
  return (
    <Badge tone="neutral" icon={LockKeyhole} className="px-2.5 py-1 text-sm">
      Closed
    </Badge>
  )
}
