import { Bell, CalendarDays, Megaphone } from 'lucide-react'
import { Badge } from '@/components/StatusBadge'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Skeleton } from '@/components/ui/skeleton'
import { Card, CardContent } from '@/components/ui/card'
import { useCandidateAnnouncements } from '@/hooks/useStudentPortal'
import { formatDateTime } from '@/lib/format'

export default function CandidateAnnouncementsPage() {
  const query = useCandidateAnnouncements()
  const announcements = query.data ?? []

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Important instructions and updates from examiners for exams you're enrolled in."
        meta={<Badge tone="info" icon={Bell}>{announcements.length} updates</Badge>}
      />
      {query.error ? (
        <ErrorState error={query.error} onRetry={query.refetch} isRetrying={query.isRefetching} title="We couldn't load announcements" />
      ) : query.isPending ? (
        <div className="space-y-4" role="status">
          <span className="sr-only">Loading announcements</span>
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="You're all caught up"
          description="Published announcements for your exams will appear here."
        />
      ) : (
        <ol className="space-y-4">
          {announcements.map((announcement) => (
            <li key={announcement.id}>
              <Card as="article" className="overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-primary via-info to-sky" />
                <CardContent className="p-5 sm:p-6">
                  <div className="flex items-start gap-4">
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-sky text-primary-hover" aria-hidden="true">
                      <Megaphone className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h2 className="text-base font-semibold">{announcement.title}</h2>
                          <p className="mt-1 text-sm font-medium text-primary-hover">{announcement.exam?.title ?? 'Exam update'}</p>
                        </div>
                        <Badge tone="neutral" icon={CalendarDays} className="w-fit">
                          {formatDateTime(announcement.publishedAt)}
                        </Badge>
                      </div>
                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted">{announcement.message}</p>
                      <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
                        From {announcement.author?.fullName ?? 'Exam team'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ol>
      )}
    </>
  )
}
