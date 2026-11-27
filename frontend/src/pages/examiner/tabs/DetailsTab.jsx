import {
  Award,
  CalendarDays,
  Clock3,
  FileText,
  Settings2,
  UsersRound,
  ClipboardList,
  UserRound,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DescriptionList } from '@/components/DescriptionList'
import { ExamSettings } from '@/components/exam/ExamSettings'
import { formatDateTime, formatDuration } from '@/lib/format'

function MetricCard({ icon: Icon, label, value, detail, tone }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="stat-number mt-3 text-2xl tracking-tight">{value}</p>
          <p className="mt-1 text-xs text-muted">{detail}</p>
        </div>
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="size-5" aria-hidden="true" />
        </span>
      </div>
    </Card>
  )
}

function SchedulePoint({ label, value, icon: Icon, emphasis }) {
  return (
    <div className="flex gap-3">
      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg ${emphasis ? 'bg-primary text-on-primary' : 'bg-sunken text-muted'}`}>
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</p>
        <p className="num mt-1 text-sm font-semibold">{formatDateTime(value)}</p>
      </div>
    </div>
  )
}

export function DetailsTab({ exam }) {
  const questionCount = exam.questionCount ?? exam.questions?.length ?? 0
  const maxAttempts = exam.maxAttempts ?? 1
  const createdBy = exam.owner?.fullName ?? exam.createdBy ?? '—'

  return (
    <div className="space-y-6">
      <section aria-label="Exam summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={UsersRound}
          label="Enrolled candidates"
          value={exam.candidateCount ?? 0}
          detail="Candidates with active enrollment"
          tone="bg-sky text-primary-hover"
        />
        <MetricCard
          icon={ClipboardList}
          label="Questions"
          value={questionCount}
          detail="Assigned to this exam"
          tone="bg-info-soft text-info"
        />
        <MetricCard
          icon={Award}
          label="Total marks"
          value={exam.totalMarks ?? 0}
          detail="Maximum available score"
          tone="bg-success-soft text-success"
        />
        <MetricCard
          icon={Clock3}
          label="Duration"
          value={formatDuration(exam.durationMinutes)}
          detail={`${maxAttempts} ${maxAttempts === 1 ? 'attempt' : 'attempts'} allowed`}
          tone="bg-warning-soft text-warning"
        />
      </section>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.8fr)]">
        <Card as="section" aria-labelledby="exam-overview-heading" className="overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-sky/70 to-surface">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
                <FileText className="size-5" aria-hidden="true" />
              </span>
              <div>
                <CardTitle id="exam-overview-heading">Exam overview</CardTitle>
                <p className="mt-1 text-sm text-muted">The essential context candidates need before they begin.</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {exam.description && (
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted">Description</h3>
                <p className="mt-2 text-sm leading-6">{exam.description}</p>
              </div>
            )}
            <div className="rounded-lg border border-primary/15 bg-sky/35 p-4 sm:p-5">
              <h3 className="text-sm font-semibold">Candidate instructions</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted">
                {exam.instructions || 'No candidate instructions have been added.'}
              </p>
            </div>
            <DescriptionList
              className="gap-y-4"
              items={[
                { label: 'Maximum attempts', value: String(maxAttempts), mono: true },
                { label: 'Created by', value: createdBy },
                { label: 'Created on', value: formatDateTime(exam.createdAt), mono: true },
                { label: 'Last updated', value: formatDateTime(exam.updatedAt), mono: true },
              ]}
            />
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card as="section" aria-labelledby="schedule-heading">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sky text-primary-hover">
                  <CalendarDays className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle id="schedule-heading">Exam schedule</CardTitle>
                  <p className="mt-1 text-sm text-muted">Availability window</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-5">
                <SchedulePoint label="Starts" value={exam.startsAt ?? exam.startAt} icon={CalendarDays} emphasis />
                <div className="ml-4 h-4 border-l border-dashed border-border" aria-hidden="true" />
                <SchedulePoint label="Ends" value={exam.endsAt ?? exam.endAt} icon={Clock3} />
              </div>
            </CardContent>
          </Card>

          <Card as="section" aria-labelledby="settings-heading">
            <CardHeader>
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-lg bg-sunken text-muted">
                  <Settings2 className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <CardTitle id="settings-heading">Exam settings</CardTitle>
                  <p className="mt-1 text-sm text-muted">Rules applied to candidate attempts</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ExamSettings settings={exam.settings} />
            </CardContent>
          </Card>
        </div>
      </div>

      <Card className="border-dashed bg-sunken/50">
        <CardContent className="flex items-start gap-3 p-4">
          <UserRound className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden="true" />
          <p className="text-xs leading-relaxed text-muted">
            Candidate access, attempt timing, and result visibility are enforced by the server and reflected in the exam lifecycle above.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
