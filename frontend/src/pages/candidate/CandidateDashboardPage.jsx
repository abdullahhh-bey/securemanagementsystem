import { Link } from 'react-router-dom'
import { ArrowRight, Bell, BookOpenCheck, CalendarClock, CircleCheck, Medal, Sparkles } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useCandidateExams } from '@/hooks/useCandidateExams'
import { useCandidateAnnouncements, useCandidateResults } from '@/hooks/useStudentPortal'
import { userDisplayName } from '@/lib/schema'
import { formatDateTime } from '@/lib/format'
import { Badge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

function ExamPreview({ exam }) {
  const isAvailable = exam.accessStatus === 'AVAILABLE'
  return (
    <Link
      to={isAvailable ? `/candidate/exams/${exam.id}` : '/candidate/exams'}
      className="group flex flex-col gap-3 rounded-lg border border-border bg-surface p-4 transition-colors hover:border-primary/40 hover:bg-sky/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="min-w-0">
        <p className="truncate font-semibold group-hover:text-primary-hover">{exam.title}</p>
        <p className="mt-1 text-sm text-muted">
          {isAvailable ? 'Closes' : 'Opens'} {formatDateTime(isAvailable ? exam.endAt : exam.startAt)}
        </p>
      </div>
      <Badge tone={isAvailable ? 'success' : 'info'}>{isAvailable ? 'Available' : 'Upcoming'}</Badge>
    </Link>
  )
}

export default function CandidateDashboardPage() {
  const { user } = useAuth()
  const examsQuery = useCandidateExams()
  const resultsQuery = useCandidateResults()
  const announcementsQuery = useCandidateAnnouncements()
  const exams = examsQuery.data ?? []
  const results = resultsQuery.data ?? []
  const announcements = announcementsQuery.data ?? []
  const available = exams.filter((exam) => exam.accessStatus === 'AVAILABLE')
  const upcoming = exams
    .filter((exam) => exam.accessStatus === 'UPCOMING')
    .sort((a, b) => new Date(a.startAt) - new Date(b.startAt))
  const completed = exams.filter((exam) => exam.accessStatus === 'CLOSED')
  const activeItems = [...available, ...upcoming].slice(0, 3)
  const latestResults = [...results]
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    .slice(0, 3)
  const latestAnnouncements = announcements.slice(0, 2)

  return (
    <>
      <PageHeader
        title={`Welcome back, ${userDisplayName(user).split(' ')[0]}`}
        description="Your exam schedule, results and updates — all in one place."
        actions={
          <Button asChild variant="secondary">
            <Link to="/candidate/exams">View all exams <ArrowRight /></Link>
          </Button>
        }
      />

      {examsQuery.error ? (
        <ErrorState error={examsQuery.error} onRetry={examsQuery.refetch} isRetrying={examsQuery.isRefetching} title="We couldn't load your dashboard" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Available now" value={available.length} icon={BookOpenCheck} tone="brand" hint="Ready to start" to="/candidate/exams" loading={examsQuery.isPending} />
            <StatCard label="Upcoming exams" value={upcoming.length} icon={CalendarClock} tone="info" hint="On your schedule" to="/candidate/exams" loading={examsQuery.isPending} />
            <StatCard label="Completed" value={completed.length} icon={CircleCheck} tone="success" hint="Past exam windows" to="/candidate/exams" loading={examsQuery.isPending} />
            <StatCard label="Published results" value={resultsQuery.isError ? '—' : results.length} icon={Medal} tone="warning" hint={resultsQuery.isError ? 'Unavailable right now' : 'Scores released'} to="/candidate/results" loading={resultsQuery.isPending} />
          </div>

          <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.8fr)]">
            <Card as="section" aria-labelledby="schedule-heading">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle id="schedule-heading">Your schedule</CardTitle>
                  <p className="mt-1 text-sm text-muted">The next exams that need your attention.</p>
                </div>
                <CalendarClock className="size-5 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent className="space-y-3">
                {examsQuery.isPending ? (
                  <div className="space-y-3" role="status">
                    <span className="sr-only">Loading exam schedule</span>
                    <Skeleton className="h-20 w-full" />
                    <Skeleton className="h-20 w-full" />
                  </div>
                ) : activeItems.length ? (
                  activeItems.map((exam) => <ExamPreview key={exam.id} exam={exam} />)
                ) : (
                  <EmptyState compact icon={Sparkles} title="You're all caught up" description="New exams will appear here as soon as you're enrolled." />
                )}
              </CardContent>
            </Card>

            <Card as="section" aria-labelledby="announcements-heading">
              <CardHeader className="flex-row items-center justify-between">
                <div>
                  <CardTitle id="announcements-heading">Latest announcements</CardTitle>
                  <p className="mt-1 text-sm text-muted">Updates from your examiners.</p>
                </div>
                <Bell className="size-5 text-primary" aria-hidden="true" />
              </CardHeader>
              <CardContent className="space-y-4">
                {announcementsQuery.error ? (
                  <ErrorState compact error={announcementsQuery.error} onRetry={announcementsQuery.refetch} isRetrying={announcementsQuery.isRefetching} />
                ) : announcementsQuery.isPending ? (
                  <Skeleton className="h-20 w-full" />
                ) : latestAnnouncements.length ? (
                  latestAnnouncements.map((announcement) => (
                    <article key={announcement.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                      <p className="font-semibold">{announcement.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted">{announcement.message}</p>
                      <p className="mt-2 text-xs text-muted">
                        {announcement.exam?.title} · {formatDateTime(announcement.publishedAt)}
                      </p>
                    </article>
                  ))
                ) : (
                  <p className="text-sm text-muted">There are no announcements for your exams yet.</p>
                )}
                <Link to="/candidate/announcements" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:text-primary-hover">
                  All announcements <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </CardContent>
            </Card>
          </div>

          <Card as="section" aria-labelledby="recent-results-heading" className="mt-6">
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle id="recent-results-heading">Recent results</CardTitle>
                <p className="mt-1 text-sm text-muted">Results are shown after your examiner publishes them.</p>
              </div>
              <Medal className="size-5 text-primary" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              {resultsQuery.error ? (
                <ErrorState compact error={resultsQuery.error} onRetry={resultsQuery.refetch} isRetrying={resultsQuery.isRefetching} />
              ) : resultsQuery.isPending ? (
                <Skeleton className="h-16 w-full" />
              ) : latestResults.length ? (
                <ul className="divide-y divide-border">
                  {latestResults.map((result) => (
                    <li key={result.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium">{result.attempt?.exam?.title ?? 'Exam result'}</p>
                        <p className="text-xs text-muted">Published {formatDateTime(result.publishedAt)}</p>
                      </div>
                      <p className="stat-number text-lg">{result.obtainedMarks ?? '—'} / {result.totalMarks}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">You don't have any published results yet.</p>
              )}
              <div className="mt-4">
                <Button asChild variant="link" size="sm">
                  <Link to="/candidate/results">Go to results <ArrowRight /></Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </>
  )
}
