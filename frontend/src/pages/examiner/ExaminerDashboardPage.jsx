import { Link } from 'react-router-dom'
import { ArrowRight, CircleCheck, CircleDashed, CirclePlay, PartyPopper, Plus, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { StatCard } from '@/components/StatCard'
import { StatusBadge } from '@/components/StatusBadge'
import { useAuth } from '@/hooks/useAuth'
import { useExams } from '@/hooks/useExams'
import { useServerNow } from '@/hooks/useServerClock'
import { formatCountdown, formatDateTime } from '@/lib/format'
import { userDisplayName } from '@/lib/schema'

const DAY = 24 * 60 * 60 * 1000

/**
 * Turns the exam list into a prioritised to-do list. Exam *status* is trusted
 * from the server; the only time maths is relative to the synced server clock.
 */
function buildAttentionItems(exams, now) {
  const items = []
  for (const exam of exams) {
    const start = new Date(exam.startAt).getTime()
    const end = new Date(exam.endAt).getTime()
    const base = { exam, key: exam.id }
    if (exam.status === 'DRAFT') {
      if (now !== null && start <= now) {
        items.push({ ...base, level: 0, reason: 'The scheduled start has passed. Reschedule before publishing.', action: 'Edit schedule', to: `/examiner/exams/${exam.id}/edit` })
      } else if (exam.candidateCount === 0) {
        items.push({ ...base, level: 1, reason: 'No candidates are enrolled yet.', action: 'Enroll candidates', to: `/examiner/exams/${exam.id}?tab=candidates` })
      } else {
        items.push({ ...base, level: 2, reason: 'Ready to review and publish.', action: 'Review', to: `/examiner/exams/${exam.id}/review`, ready: true })
      }
    } else if (exam.status === 'PUBLISHED') {
      if (exam.candidateCount === 0) {
        items.push({ ...base, level: 0, reason: 'Published, but nobody is enrolled.', action: 'Enroll candidates', to: `/examiner/exams/${exam.id}?tab=candidates` })
      } else if (now !== null && start - now < DAY) {
        items.push({ ...base, level: 2, reason: `Opens in ${formatCountdown(start - now)} for ${exam.candidateCount} candidates.`, action: 'View exam', to: `/examiner/exams/${exam.id}`, ready: true })
      }
    } else if (exam.status === 'ONGOING') {
      items.push({
        ...base,
        level: 1,
        reason: now !== null ? `Live now, closes in ${formatCountdown(end - now)}.` : 'Live now.',
        action: 'Open monitor',
        to: `/examiner/exams/${exam.id}?tab=monitor`,
        ready: true,
      })
    }
  }
  return items.sort((a, b) => a.level - b.level)
}

function AttentionList({ items }) {
  return (
    <ul className="divide-y divide-border">
      {items.map((item) => (
        <li key={item.key} className="flex flex-col gap-3 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Link to={`/examiner/exams/${item.exam.id}`} className="rounded-sm font-semibold hover:text-primary-hover hover:underline">
                {item.exam.title}
              </Link>
              <StatusBadge status={item.exam.status} />
            </div>
            <p className="mt-1 text-sm text-muted">{item.reason}</p>
            <p className="num mt-0.5 text-xs text-muted">{formatDateTime(item.exam.startAt)}</p>
          </div>
          <Button asChild variant={item.ready ? 'secondary' : 'primary'} size="sm" className="shrink-0">
            <Link to={item.to}>
              {item.action} <ArrowRight />
            </Link>
          </Button>
        </li>
      ))}
    </ul>
  )
}

export default function ExaminerDashboardPage() {
  const { user } = useAuth()
  const { data: exams, isPending, error, refetch, isRefetching } = useExams()
  const now = useServerNow(30000)

  const count = (status) => (exams ? exams.filter((e) => e.status === status).length : 0)
  const attention = exams ? buildAttentionItems(exams, now) : []
  const firstName = (userDisplayName(user) || 'Teacher').replace(/^(Dr|Prof)\.?\s+/i, '').split(/\s+/)[0] || 'Teacher'

  const stats = [
    { label: 'Drafts', value: count('DRAFT'), icon: CircleDashed, hint: 'Still being prepared', to: '/examiner/exams?status=DRAFT' },
    { label: 'Published', value: count('PUBLISHED'), icon: Send, tone: 'info', hint: 'Waiting to open', to: '/examiner/exams?status=PUBLISHED' },
    { label: 'Live now', value: count('ONGOING'), icon: CirclePlay, tone: 'success', hint: 'Candidates can enter', to: '/examiner/exams?status=ONGOING' },
    { label: 'Completed', value: count('COMPLETED'), icon: CircleCheck, tone: 'brand', hint: 'Finished exams', to: '/examiner/exams?status=COMPLETED' },
  ]

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        actions={
          <Button asChild>
            <Link to="/examiner/exams/new">
              <Plus /> Create exam
            </Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="We couldn't load your exams" />
      ) : (
        <div className="space-y-6">
          <section aria-label="Exam statistics" className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <StatCard key={stat.label} {...stat} loading={isPending} />
            ))}
          </section>

          <Card as="section" aria-labelledby="attention-heading">
            <CardHeader>
              <CardTitle id="attention-heading">Needs attention</CardTitle>
              <CardDescription>Exams that are live, blocked, or close to opening.</CardDescription>
            </CardHeader>
            {isPending ? (
              <div className="space-y-4 p-6">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : attention.length === 0 ? (
              <EmptyState
                compact
                icon={PartyPopper}
                title={exams.length === 0 ? 'No exams yet' : "You're all caught up"}
                description={exams.length === 0 ? 'Create your first exam to get started.' : 'Nothing needs your attention right now.'}
                action={
                  exams.length === 0 && (
                    <Button asChild>
                      <Link to="/examiner/exams/new">
                        <Plus /> Create exam
                      </Link>
                    </Button>
                  )
                }
              />
            ) : (
              <AttentionList items={attention} />
            )}
          </Card>
        </div>
      )}
    </>
  )
}
