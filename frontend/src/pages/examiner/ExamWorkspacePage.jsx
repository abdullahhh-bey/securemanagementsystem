import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { AlertTriangle, CircleCheck, Hourglass, Send, XCircle } from 'lucide-react'
import { startSandboxAttempt, submitSandboxAttempt } from '@/api/workspace'
import { Badge } from '@/components/StatusBadge'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCountdown } from '@/hooks/useServerClock'
import { QUESTION_TYPE_META } from '@/lib/constants'
import { formatCountdown, formatDuration } from '@/lib/format'
import { cn } from '@/lib/utils'

const ANSWER_STATUS = {
  correct: { label: 'Correct', tone: 'success', icon: CircleCheck },
  partial: { label: 'Partial', tone: 'warning', icon: AlertTriangle },
  incorrect: { label: 'Incorrect', tone: 'danger', icon: XCircle },
  skipped: { label: 'Skipped', tone: 'neutral', icon: CircleCheck },
  'needs-marking': { label: 'Needs marking', tone: 'info', icon: Hourglass },
}

function ExamTimer({ expiresAt }) {
  const { msLeft } = useCountdown(expiresAt)
  return (
    <Badge tone={msLeft !== null && msLeft < 300_000 ? 'danger' : 'brand'} icon={Hourglass} className="num px-2.5 py-1 text-sm" role="timer">
      {msLeft === null ? 'Syncing clock…' : msLeft === 0 ? 'Time is up' : formatCountdown(msLeft)}
    </Badge>
  )
}

function McqSingle({ question, value, onChange }) {
  const selected = value?.selected?.[0] ?? ''
  const group = `q-${question.id}`
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Options for question {question.number}</legend>
      {question.options.map((opt) => {
        const id = `${group}-${opt.id}`
        return (
          <label key={opt.id} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 hover:bg-sunken">
            <input
              type="radio"
              id={id}
              name={group}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={selected === opt.id}
              onChange={() => onChange({ selected: [opt.id] })}
            />
            <span className="text-sm">{opt.text}</span>
          </label>
        )
      })}
    </fieldset>
  )
}

function McqMulti({ question, value, onChange }) {
  const selected = new Set(value?.selected ?? [])
  const toggle = (optId, checked) => {
    const next = new Set(selected)
    if (checked) next.add(optId)
    else next.delete(optId)
    onChange({ selected: [...next] })
  }
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Options for question {question.number} (select all that apply)</legend>
      {question.options.map((opt) => {
        const id = `q-${question.id}-${opt.id}`
        const checked = selected.has(opt.id)
        return (
          <label key={opt.id} htmlFor={id} className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-surface p-3 hover:bg-sunken">
            <Checkbox id={id} checked={checked} onCheckedChange={(next) => toggle(opt.id, next === true)} className="mt-0.5" />
            <span className="text-sm">{opt.text}</span>
          </label>
        )
      })}
    </fieldset>
  )
}

function WrittenAnswer({ question, value, onChange }) {
  const id = `written-${question.id}`
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Your answer</Label>
      <Textarea
        id={id}
        value={value?.text ?? ''}
        onChange={(e) => onChange({ text: e.target.value })}
        rows={6}
        placeholder="Write your response here…"
      />
    </div>
  )
}

function QuestionBlock({ question, answer, onAnswer }) {
  const typeMeta = QUESTION_TYPE_META[question.type]
  return (
    <Card as="section" aria-labelledby={`q-title-${question.id}`} className="scroll-mt-24">
      <CardHeader>
        <CardTitle id={`q-title-${question.id}`} className="flex flex-wrap items-baseline gap-2 text-base">
          <span className="num text-muted">Q{question.number}</span>
          <span>{question.text}</span>
          <span className="num rounded bg-sunken px-2 py-0.5 text-xs font-semibold text-muted">
            {typeMeta?.short ?? question.type} · {question.marks} marks
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {question.type === 'MCQ_SINGLE' && <McqSingle question={question} value={answer} onChange={onAnswer} />}
        {question.type === 'MCQ_MULTI' && <McqMulti question={question} value={answer} onChange={onAnswer} />}
        {question.type === 'WRITTEN' && <WrittenAnswer question={question} value={answer} onChange={onAnswer} />}
      </CardContent>
    </Card>
  )
}

function SandboxBanner({ text }) {
  return (
    <div className="sticky top-0 z-40 border-b border-warning/40 bg-warning px-4 py-2.5 text-center text-sm font-bold text-ink shadow-sm">
      {text}
    </div>
  )
}

function ResultPanel({ result, questions }) {
  const byId = useMemo(() => Object.fromEntries((questions ?? []).map((q) => [q.id, q])), [questions])
  return (
    <div className="space-y-6">
      <Card className="border-warning/40 bg-warning-soft">
        <CardContent className="space-y-2 py-5 text-center">
          <p className="text-lg font-bold text-ink">Sandbox result — not recorded</p>
          <p className="text-sm text-muted">
            Auto-scored <span className="num font-semibold text-ink">{result.autoScore}</span> /{' '}
            <span className="num">{result.autoMax}</span>
            {result.pendingWritten > 0 && (
              <>
                {' '}
                · <span className="num">{result.pendingWritten}</span> written {result.pendingWritten === 1 ? 'response' : 'responses'} would need marking
              </>
            )}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-warning">recorded: false — does not affect real results</p>
        </CardContent>
      </Card>

      <ol className="space-y-3" aria-label="Per-question results">
        {result.questions.map((row) => {
          const meta = ANSWER_STATUS[row.status] ?? { label: row.status, tone: 'neutral', icon: CircleCheck }
          const source = byId[row.id]
          return (
            <li key={row.id} className="rounded-lg border border-border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-sm font-semibold">
                  <span className="num text-muted">Q{row.number}</span>
                  {source?.text && <span className="ml-2 font-normal text-ink">{source.text}</span>}
                </p>
                <Badge tone={meta.tone} icon={meta.icon}>
                  {meta.label}
                </Badge>
              </div>
              <p className="num mt-2 text-xs text-muted">
                {row.awarded === null ? 'Pending manual mark' : `${row.awarded} / ${row.marks} marks`}
              </p>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export default function ExamWorkspacePage() {
  const { id } = useParams()
  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)

  const back = { to: `/examiner/exams/${id}`, label: 'Back to exam' }

  const session = useQuery({
    queryKey: ['x', id, 'sandbox'],
    queryFn: () => startSandboxAttempt(id),
    retry: false,
    staleTime: Infinity,
  })

  const submit = useMutation({
    mutationFn: () => submitSandboxAttempt(session.data.attemptId, answers),
    onSuccess: (data) => setResult(data),
  })

  const setAnswer = (questionId, patch) => {
    setAnswers((prev) => ({ ...prev, [questionId]: { ...prev[questionId], ...patch } }))
  }

  if (session.isPending) {
    return (
      <>
        <PageHeader title="Sandbox preview" back={back} />
        <div className="space-y-4" role="status">
          <span className="sr-only">Starting sandbox attempt</span>
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      </>
    )
  }

  if (session.error) {
    const isNoQuestions = session.error?.code === 'NO_QUESTIONS'
    return (
      <>
        <PageHeader title="Sandbox preview" back={back} />
        <ErrorState
          error={session.error}
          title={isNoQuestions ? 'Add questions first' : "We couldn't start the sandbox"}
          onRetry={isNoQuestions ? undefined : session.refetch}
          isRetrying={session.isRefetching}
        />
        <p className="mt-4 text-center text-sm">
          <Link to={back.to} className="font-medium text-primary hover:text-primary-hover">
            Return to exam detail
          </Link>
        </p>
      </>
    )
  }

  const data = session.data
  const banner = data.banner ?? 'SANDBOX - does not affect real results'

  if (result) {
    return (
      <>
        <SandboxBanner text={banner} />
        <PageHeader title={`${data.exam.title} (sandbox)`} back={back} description="Preview finished — nothing was saved to real results." />
        <ResultPanel result={result} questions={data.questions} />
        <div className="mt-6">
          <Button asChild variant="secondary">
            <Link to={back.to}>Back to exam detail</Link>
          </Button>
        </div>
      </>
    )
  }

  return (
    <>
      <SandboxBanner text={banner} />
      <PageHeader
        title={data.exam.title}
        back={back}
        description={data.exam.instructions}
        meta={
          <>
            <ExamTimer expiresAt={data.expiresAt} />
            <span className="num text-sm text-muted">
              {formatDuration(data.exam.durationMinutes)} · {data.exam.totalMarks} marks
            </span>
          </>
        }
        actions={
          <Button loading={submit.isPending} onClick={() => submit.mutate()}>
            <Send />
            Submit preview
          </Button>
        }
      />

      {submit.error && (
        <p className="mb-4 rounded-md border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {submit.error.message}
        </p>
      )}

      <div className={cn('space-y-4', submit.isPending && 'pointer-events-none opacity-60')}>
        {data.questions.map((question) => (
          <QuestionBlock
            key={question.id}
            question={question}
            answer={answers[question.id]}
            onAnswer={(patch) => setAnswer(question.id, patch)}
          />
        ))}
      </div>

      <div className="mt-8 flex justify-end border-t border-border pt-6">
        <Button size="lg" loading={submit.isPending} onClick={() => submit.mutate()}>
          <Send />
          Submit preview
        </Button>
      </div>
    </>
  )
}