import { useState } from 'react'
import { AlertTriangle, Megaphone, Pause, Play, Radio, Shield, TriangleAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { IncidentDrawer } from '@/components/monitor/IncidentDrawer'
import { estimateServerNow, formatAgo, formatSpan, useTick } from '@/components/monitor/time'
import { SectionNav } from '@/components/SectionNav'
import { StatusBadge } from '@/components/StatusBadge'
import {
  useAnnouncements,
  useCompensations,
  useDisruptions,
  useGrantCompensation,
  useMonitor,
  useSendAnnouncement,
} from '@/hooks/useMonitor'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'

const SUMMARY_CHIPS = [
  { key: 'enrolled', label: 'Enrolled' },
  { key: 'started', label: 'Started' },
  { key: 'notStarted', label: 'Not started' },
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'incidents', label: 'Incidents' },
]

const COMPENSATION_POLICY =
  'The exam deadline is never extended silently. Every compensation is recorded with a reason.'

function ProgressCell({ answered, total, percent }) {
  const pct = Number.isFinite(percent) ? percent : total ? Math.round((answered / total) * 100) : 0
  return (
    <div className="min-w-[8rem] space-y-1">
      <div className="num text-xs text-muted">
        {answered}/{total} ({pct}%)
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function SummaryChips({ summary }) {
  if (!summary) return null
  return (
    <div className="flex flex-wrap gap-2" aria-label="Live summary">
      {SUMMARY_CHIPS.map(({ key, label }) => (
        <span key={key} className="num inline-flex items-center gap-1.5 rounded-md border border-border bg-sunken px-2.5 py-1 text-xs font-semibold text-ink">
          <span className="text-muted">{label}</span>
          {summary[key] ?? 0}
        </span>
      ))}
    </div>
  )
}

function LiveSection({ examId, examStatus }) {
  const [polling, setPolling] = useState(true)
  const [incidentAttempt, setIncidentAttempt] = useState(null)
  const tick = useTick(1000)

  const live = examStatus === 'PUBLISHED' || examStatus === 'ONGOING'
  const monitor = useMonitor(examId, { enabled: true, polling: live && polling })

  // TanStack's dataUpdatedAt is the device clock when this payload arrived; between polls we advance with `tick`.
  const receivedAt = monitor.dataUpdatedAt || tick
  const serverNow = estimateServerNow(monitor.data?.serverTime, receivedAt, tick)

  const columns = [
    {
      key: 'candidate',
      header: 'Candidate',
      sortValue: (row) => row.candidate.name.toLowerCase(),
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-semibold">{row.candidate.name}</p>
          <p className="truncate text-xs text-muted">{row.candidate.email}</p>
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortValue: (row) => row.progressPercent,
      cell: (row) => <ProgressCell answered={row.answered} total={row.total} percent={row.progressPercent} />,
    },
    {
      key: 'lastSeen',
      header: 'Last seen',
      sortValue: (row) => row.lastSeenAt,
      cell: (row) => (
        <span className="num text-xs text-muted" title={formatDateTime(row.lastSeenAt)}>
          {formatAgo(row.lastSeenAt, serverNow)}
        </span>
      ),
    },
    {
      key: 'connection',
      header: 'Connection',
      sortValue: (row) => row.connection,
      cell: (row) => <StatusBadge kind="connection" status={row.connection} />,
    },
    {
      key: 'incidents',
      header: 'Incidents',
      sortValue: (row) => row.incidentCount,
      cell: (row) => (
        <Button
          variant="secondary"
          size="sm"
          className="num"
          onClick={() => setIncidentAttempt(row)}
          aria-label={`${row.incidentCount} incidents for ${row.candidate.name}`}
        >
          <TriangleAlert />
          {row.incidentCount}
        </Button>
      ),
    },
    {
      key: 'deadline',
      header: 'Personal deadline',
      sortValue: (row) => row.personalDeadline,
      cell: (row) =>
        row.compensationMinutes > 0 ? (
          <div className="num text-xs">
            <p className="font-semibold text-ink">{formatDateTime(row.personalDeadline)}</p>
            <p className="text-muted">+{row.compensationMinutes} min recorded</p>
          </div>
        ) : (
          <span className="text-xs text-muted">—</span>
        ),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SummaryChips summary={monitor.data?.summary} />
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPolling((on) => !on)}
          aria-pressed={polling}
          disabledReason={live ? undefined : 'Live polling applies once the exam is published.'}
        >
          {polling ? <Pause /> : <Play />}
          {polling ? 'Pause polling' : 'Resume polling'}
        </Button>
      </div>

      <DataTable
        caption="Live attempts"
        columns={columns}
        rows={monitor.data?.attempts ?? []}
        searchText={(row) => `${row.candidate.name} ${row.candidate.email}`}
        searchPlaceholder="Search candidates…"
        isLoading={monitor.isPending}
        error={monitor.error}
        onRetry={monitor.refetch}
        isRetrying={monitor.isRefetching}
        pageSize={10}
        emptyState={
          <EmptyState
            compact
            icon={Users}
            title="No attempts yet"
            description="Candidates appear here once they start the exam. Sandbox previews are never listed."
          />
        }
      />

      <IncidentDrawer
        open={Boolean(incidentAttempt)}
        onOpenChange={(open) => !open && setIncidentAttempt(null)}
        examId={examId}
        attempt={incidentAttempt}
      />
    </div>
  )
}

function AnnouncementsSection({ examId, examStatus }) {
  const [message, setMessage] = useState('')
  const [inactiveNote, setInactiveNote] = useState(null)
  const canSend = examStatus === 'PUBLISHED' || examStatus === 'ONGOING'

  const announcements = useAnnouncements(examId)
  const send = useSendAnnouncement(examId, {
    silentError: true,
    onSuccess: () => {
      setMessage('')
      setInactiveNote(null)
    },
    onError: (error) => {
      if (error?.status === 409) setInactiveNote(error.message)
      else setInactiveNote(null)
    },
  })

  const submit = (event) => {
    event.preventDefault()
    const text = message.trim()
    if (!text) return
    send.mutate(text)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card as="section" aria-labelledby="announce-form-heading">
        <CardHeader>
          <CardTitle id="announce-form-heading">Send announcement</CardTitle>
          <CardDescription>Broadcast a short message to everyone currently in this exam.</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <div className="space-y-2">
              <Label htmlFor="announcement-message">Message</Label>
              <Textarea
                id="announcement-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={4}
                placeholder="Write your announcement…"
                disabled={!canSend || send.isPending}
                aria-describedby={inactiveNote ? 'announcement-inactive' : undefined}
              />
            </div>
            {!canSend && (
              <p id="announcement-inactive" className="text-sm text-muted" role="note">
                Announcements can be sent once the exam is published and until it ends.
              </p>
            )}
            {inactiveNote && (
              <p className="rounded-md border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning" role="alert">
                {inactiveNote}
              </p>
            )}
            {send.error && send.error.status !== 409 && (
              <p className="text-sm text-danger" role="alert">
                {send.error.message}
              </p>
            )}
            <Button type="submit" loading={send.isPending} disabledReason={canSend ? undefined : 'Exam is not active.'}>
              <Megaphone />
              Send
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card as="section" aria-labelledby="announce-history-heading">
        <CardHeader>
          <CardTitle id="announce-history-heading">History</CardTitle>
          <CardDescription>Newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {announcements.error ? (
            <ErrorState compact error={announcements.error} onRetry={announcements.refetch} isRetrying={announcements.isRefetching} />
          ) : announcements.isPending ? (
            <p className="text-sm text-muted" role="status">
              Loading announcements…
            </p>
          ) : !(announcements.data ?? []).length ? (
            <EmptyState compact icon={Megaphone} title="No announcements yet" description="Sent messages appear here." />
          ) : (
            <ol className="space-y-3" aria-label="Announcement history">
              {(announcements.data ?? []).map((item) => (
                <li key={item.id} className="rounded-lg border border-border bg-sunken p-3">
                  <p className="text-sm">{item.message}</p>
                  <p className="num mt-2 text-xs text-muted">
                    <time dateTime={item.sentAt}>{formatDateTime(item.sentAt)}</time>
                    <span aria-hidden="true"> · </span>
                    {item.sentBy}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function CompensationForm({ examId, attemptId, remainingMinutes, candidateName }) {
  const [minutes, setMinutes] = useState('')
  const [reason, setReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [confirmOpen, setConfirmOpen] = useState(false)

  const grant = useGrantCompensation(examId, {
    onSuccess: () => {
      setMinutes('')
      setReason('')
      setFieldErrors({})
      setConfirmOpen(false)
    },
    onError: (error) => {
      if (error?.status === 422 && error.details && typeof error.details === 'object') {
        setFieldErrors(error.details)
      }
    },
  })

  const parsedMinutes = Number(minutes)
  const canSubmit =
    Number.isInteger(parsedMinutes) &&
    parsedMinutes >= 1 &&
    parsedMinutes <= remainingMinutes &&
    reason.trim().length >= 15

  const submit = () => {
    if (!canSubmit) return
    grant.mutate({ attemptId, minutes: parsedMinutes, reason: reason.trim() })
  }

  return (
  <>
      <form
        className="mt-4 space-y-3 rounded-lg border border-border bg-surface p-4"
        onSubmit={(e) => {
          e.preventDefault()
          setFieldErrors({})
          if (canSubmit) setConfirmOpen(true)
        }}
      >
        <p className="text-sm font-semibold">Grant compensation</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor={`minutes-${attemptId}`}>Minutes (max {remainingMinutes})</Label>
            <Input
              id={`minutes-${attemptId}`}
              type="number"
              min={1}
              max={remainingMinutes}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              aria-invalid={Boolean(fieldErrors.minutes)}
              className={cn(fieldErrors.minutes && 'border-danger')}
            />
            {fieldErrors.minutes && (
              <p className="text-xs text-danger" role="alert">
                {fieldErrors.minutes}
              </p>
            )}
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor={`reason-${attemptId}`}>Reason (at least 15 characters)</Label>
            <Textarea
              id={`reason-${attemptId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              aria-invalid={Boolean(fieldErrors.reason)}
              className={cn(fieldErrors.reason && 'border-danger')}
            />
            {fieldErrors.reason && (
              <p className="text-xs text-danger" role="alert">
                {fieldErrors.reason}
              </p>
            )}
          </div>
        </div>
        {grant.error && grant.error.status !== 422 && (
          <p className="text-xs text-danger" role="alert">
            {grant.error.message}
          </p>
        )}
        <Button type="submit" size="sm" disabledReason={canSubmit ? undefined : 'Enter valid minutes and a reason of at least 15 characters.'}>
          Review grant
        </Button>
      </form>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Record compensation?"
        description={`Grant ${parsedMinutes} extra minute${parsedMinutes === 1 ? '' : 's'} to ${candidateName}. Their personal deadline moves and this reason is stored in the audit trail.`}
        confirmLabel="Grant compensation"
        isPending={grant.isPending}
        onConfirm={submit}
      />
    </>
  )
}

function DisruptionsSection({ examId }) {
  const disruptions = useDisruptions(examId)
  const compensations = useCompensations(examId)

  if (disruptions.error) {
    return <ErrorState error={disruptions.error} onRetry={disruptions.refetch} isRetrying={disruptions.isRefetching} title="We couldn't load disruptions" />
  }

  const policy = disruptions.data?.policy ?? COMPENSATION_POLICY

  return (
    <div className="space-y-6">
      <div role="note" className="flex gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-info">
        <Shield className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <div>
          <p className="font-bold">Failure resilience</p>
          <p className="mt-1 text-sm text-ink">{policy}</p>
        </div>
      </div>

      {disruptions.isPending ? (
        <p className="text-sm text-muted" role="status">
          Loading connection gaps…
        </p>
      ) : !(disruptions.data?.attempts ?? []).length ? (
        <EmptyState icon={Radio} title="No connection gaps recorded" description="Gaps appear when a candidate cannot reach the server during the exam." />
      ) : (
        <ul className="space-y-4">
          {disruptions.data.attempts.map((entry) => (
            <li key={entry.attemptId} className="rounded-lg border border-border bg-surface">
              <div className="border-b border-border px-5 py-4">
                <p className="font-semibold">{entry.candidate.name}</p>
                <p className="text-xs text-muted">
                  {entry.totalGapSeconds > 0 ? (
                    <>
                      Total offline {formatSpan(entry.totalGapSeconds)}
                      <span aria-hidden="true"> · </span>
                      Cap {entry.cap.remainingMinutes} of {entry.cap.capMinutes} min left
                    </>
                  ) : (
                    <>No gaps recorded · Cap {entry.cap.remainingMinutes} of {entry.cap.capMinutes} min left</>
                  )}
                </p>
              </div>
              <div className="space-y-3 px-5 py-4">
                {entry.gaps.length === 0 ? (
                  <p className="text-sm text-muted">No connection gaps for this attempt.</p>
                ) : (
                  <ul className="space-y-2 text-sm" aria-label={`Connection gaps for ${entry.candidate.name}`}>
                    {entry.gaps.map((gap) => (
                      <li key={gap.id} className="flex flex-wrap items-baseline justify-between gap-2 rounded-md bg-sunken px-3 py-2">
                        <span className="num text-xs text-muted">
                          {formatDateTime(gap.from)}
                          {gap.to ? ` – ${formatDateTime(gap.to)}` : ' – ongoing'}
                        </span>
                        <span className="num text-xs font-semibold">{formatSpan(gap.seconds)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {entry.cap.remainingMinutes > 0 && entry.status === 'IN_PROGRESS' && (
                  <CompensationForm
                    examId={examId}
                    attemptId={entry.attemptId}
                    remainingMinutes={entry.cap.remainingMinutes}
                    candidateName={entry.candidate.name}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Card as="section" aria-labelledby="comp-audit-heading">
        <CardHeader>
          <CardTitle id="comp-audit-heading">Compensation audit trail</CardTitle>
          <CardDescription>Every grant, newest first.</CardDescription>
        </CardHeader>
        <CardContent>
          {compensations.error ? (
            <ErrorState compact error={compensations.error} onRetry={compensations.refetch} isRetrying={compensations.isRefetching} />
          ) : compensations.isPending ? (
            <p className="text-sm text-muted" role="status">
              Loading audit trail…
            </p>
          ) : !(compensations.data ?? []).length ? (
            <EmptyState compact icon={AlertTriangle} title="No compensations yet" description="Recorded grants appear here." />
          ) : (
            <ol className="space-y-3">
              {(compensations.data ?? []).map((row) => (
                <li key={row.id} className="rounded-lg border border-border bg-sunken p-3 text-sm">
                  <p className="font-semibold">
                    {row.candidate.name}
                    <span className="num font-normal text-muted">
                      {' '}
                      · +{row.minutes} min
                    </span>
                  </p>
                  <p className="mt-1 text-muted">{row.reason}</p>
                  <p className="num mt-2 text-xs text-muted">
                    <time dateTime={row.at}>{formatDateTime(row.at)}</time>
                    <span aria-hidden="true"> · </span>
                    {row.grantedBy}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * @param {{ exam: object, view?: 'live' | 'announcements' | 'disruptions' }} props
 */
export function MonitorTab({ exam, view = 'live' }) {
  const base = `/examiner/exams/${exam.id}/monitor`
  const items = [
    { to: base, label: 'Live', end: true },
    { to: `${base}/announcements`, label: 'Announcements' },
    { to: `${base}/disruptions`, label: 'Disruptions' },
  ]

  return (
    <div>
      <SectionNav items={items} />
      {view === 'announcements' ? (
        <AnnouncementsSection examId={exam.id} examStatus={exam.status} />
      ) : view === 'disruptions' ? (
        <DisruptionsSection examId={exam.id} />
      ) : (
        <LiveSection examId={exam.id} examStatus={exam.status} />
      )}
    </div>
  )
}