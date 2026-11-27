import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { BookOpenCheck, CalendarClock, CircleCheck, DoorOpen } from 'lucide-react'
import * as candidateApi from '@/api/candidate'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { useCandidateExams } from '@/hooks/useCandidateExams'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/queryKeys'
import { CandidateExamCard } from './CandidateExamCard'

function Group({ id, icon: Icon, title, count, emptyTitle, emptyText, children }) {
  return (
    <section aria-labelledby={id} className="space-y-4">
      <h2 id={id} className="flex items-center gap-2.5 text-lg font-bold">
        <Icon className="size-5 text-primary" aria-hidden="true" />
        {title}
        <span className="num rounded-md bg-sunken px-2 py-0.5 text-sm font-medium text-muted">{count}</span>
      </h2>
      {count === 0 ? <EmptyState compact icon={Icon} title={emptyTitle} description={emptyText} className="rounded-lg border border-dashed border-input/50 bg-surface/60" /> : <div className="space-y-4">{children}</div>}
    </section>
  )
}

function ListSkeleton() {
  return (
    <div className="space-y-10" role="status">
      <span className="sr-only">Loading your exams</span>
      {[0, 1].map((group) => (
        <div key={group} className="space-y-4">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-52 w-full rounded-lg" />
        </div>
      ))}
    </div>
  )
}

export default function CandidateExamsPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()
  const { data: exams, isPending, error, refetch, isRefetching } = useCandidateExams()
  const [enteringId, setEnteringId] = useState(null)
  const [entryErrors, setEntryErrors] = useState({})

  // A countdown reached zero: ask the server again (it decides, not the clock).
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.candidateExams })

  const enter = async (exam) => {
    setEnteringId(exam.id)
    setEntryErrors((current) => ({ ...current, [exam.id]: null }))
    try {
      // The server re-checks access when the exam is opened and may refuse.
      const opened = await queryClient.fetchQuery({
        queryKey: queryKeys.candidateExam(exam.id),
        queryFn: () => candidateApi.getCandidateExam(exam.id),
        staleTime: 0,
      })
      queryClient.setQueryData(queryKeys.candidateExam(exam.id), opened)
      navigate(`/candidate/exams/${exam.id}`)
    } catch (err) {
      setEntryErrors((current) => ({ ...current, [exam.id]: err.message }))
      toast.error(err.message, { description: exam.title })
      refresh() // the list may be out of date (e.g. the window just closed)
    } finally {
      setEnteringId(null)
    }
  }

  const byStatus = (status) => (exams ?? []).filter((e) => e.accessStatus === status)
  const available = byStatus('AVAILABLE').sort((a, b) => new Date(a.endAt) - new Date(b.endAt))
  const upcoming = byStatus('UPCOMING').sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
  const completed = byStatus('CLOSED').sort((a, b) => new Date(b.endAt) - new Date(a.endAt))

  const renderCard = (exam) => (
    <CandidateExamCard
      key={exam.id}
      exam={exam}
      onEnter={enter}
      isEntering={enteringId === exam.id}
      entryError={entryErrors[exam.id]}
      onElapsed={refresh}
    />
  )

  return (
    <>
      <PageHeader title="My exams" description="Everything you've been enrolled in. Enter an exam as soon as its window opens." />

      {error ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="We couldn't load your exams" />
      ) : isPending ? (
        <ListSkeleton />
      ) : exams.length === 0 ? (
        <EmptyState
          icon={BookOpenCheck}
          title="No exams assigned yet"
          description="When an examiner enrolls you in an exam it will appear here. There's nothing you need to do right now."
        />
      ) : (
        <div className="space-y-12">
          <Group id="available-heading" icon={DoorOpen} title="Available now" count={available.length} emptyTitle="Nothing is open right now" emptyText="Check the upcoming exams below to see what opens next.">
            {available.map(renderCard)}
          </Group>
          <Group id="upcoming-heading" icon={CalendarClock} title="Upcoming" count={upcoming.length} emptyTitle="No upcoming exams" emptyText="New exams will show up here with a countdown to when they open.">
            {upcoming.map(renderCard)}
          </Group>
          <Group id="completed-heading" icon={CircleCheck} title="Completed" count={completed.length} emptyTitle="No completed exams yet" emptyText="Exams whose window has closed will be listed here.">
            {completed.map(renderCard)}
          </Group>
        </div>
      )}
    </>
  )
}
