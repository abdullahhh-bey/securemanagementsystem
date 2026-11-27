import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CircleAlert, Clock3, Flag, Send } from 'lucide-react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ErrorState } from '@/components/ErrorState'
import { PageHeader } from '@/components/PageHeader'
import { Badge } from '@/components/StatusBadge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCandidateAttemptWorkspace, useSaveCandidateAnswer, useSubmitCandidateAttempt } from '@/hooks/useStudentPortal'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useCountdown } from '@/hooks/useServerClock'
import { formatCountdown } from '@/lib/format'
import { cn } from '@/lib/utils'

function ExamTimer({ expiresAt }) {
  const { msLeft } = useCountdown(expiresAt)
  const urgent = msLeft !== null && msLeft < 5 * 60_000
  return (
    <Badge tone={urgent ? 'danger' : 'brand'} icon={Clock3} className="num px-3 py-1.5 text-sm" role="timer">
      {msLeft === null ? 'Syncing clock…' : msLeft === 0 ? 'Time is up' : formatCountdown(msLeft)}
    </Badge>
  )
}

function QuestionOptions({ question, value, disabled, onChange }) {
  const multiple = question.question.type === 'MULTIPLE_SELECT'
  const selected = value.selectedOptionIds ?? []
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">Answer options for question {question.position}</legend>
      {question.options.map((option) => {
        const checked = selected.includes(option.id)
        const inputId = `${question.id}-${option.id}`
        return (
          <label
            key={option.id}
            htmlFor={inputId}
            className={cn(
              'flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors',
              checked ? 'border-primary/50 bg-sky/50' : 'border-border bg-surface hover:bg-sunken',
              disabled && 'cursor-not-allowed opacity-70',
            )}
          >
            <input
              id={inputId}
              type={multiple ? 'checkbox' : 'radio'}
              name={`answer-${question.id}`}
              className="mt-0.5 size-4 shrink-0 accent-primary"
              checked={checked}
              disabled={disabled}
              onChange={() => {
                if (!multiple) {
                  onChange({ ...value, selectedOptionIds: [option.id] })
                  return
                }
                onChange({
                  ...value,
                  selectedOptionIds: checked ? selected.filter((id) => id !== option.id) : [...selected, option.id],
                })
              }}
            />
            <span className="text-sm leading-relaxed">{option.optionText ?? option.text}</span>
          </label>
        )
      })}
    </fieldset>
  )
}

function AnswerEditor({ question, value, disabled, onChange, onSave }) {
  if (question.question.type === 'WRITTEN') {
    return (
      <div className="space-y-2">
        <Label htmlFor={`answer-${question.id}`}>Your answer</Label>
        <Textarea
          id={`answer-${question.id}`}
          value={value.textResponse}
          onChange={(event) => onChange({ ...value, textResponse: event.target.value })}
          onBlur={onSave}
          rows={8}
          disabled={disabled}
          placeholder="Write your response here…"
        />
      </div>
    )
  }
  return <QuestionOptions question={question} value={value} disabled={disabled} onChange={onChange} />
}

export default function CandidateAttemptPage() {
  const { attemptId } = useParams()
  const workspaceQuery = useCandidateAttemptWorkspace(attemptId)
  const [answers, setAnswers] = useState({})
  const [activeIndex, setActiveIndex] = useState(0)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [submitted, setSubmitted] = useState(null)
  const [saveFailure, setSaveFailure] = useState('')
  const automaticSubmitStarted = useRef(false)
  const workspace = workspaceQuery.data
  const questions = workspace?.questions ?? []
  const activeQuestion = questions[activeIndex]
  const save = useSaveCandidateAnswer(attemptId)
  const submit = useSubmitCandidateAttempt({
    onSuccess: (data) => {
      setSubmitted(data)
      setConfirmOpen(false)
    },
  })
  const saveAnswer = save.saveAnswer
  const saveAnswerAsync = save.saveAnswer
  const submitAttempt = submit.mutate
  const isSubmitPending = submit.isPending
  const { msLeft } = useCountdown(workspace?.expiresAt)
  const debouncedAnswers = useDebouncedValue(answers, 500)

  useEffect(() => {
    if (!workspace) return
    setAnswers(
      Object.fromEntries(
        workspace.questions.map((question) => [
          question.id,
          {
            selectedOptionIds: question.answer?.selectedOptionIds ?? [],
            textResponse: question.answer?.textResponse ?? '',
            isMarkedForReview: question.answer?.isMarkedForReview ?? false,
          },
        ]),
      ),
    )
  }, [workspace])

  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const answer = answers[question.id]
        return Boolean(answer?.textResponse?.trim() || answer?.selectedOptionIds?.length)
      }).length,
    [answers, questions],
  )

  const persist = useCallback(
    (question, answer) => {
      setSaveFailure('')
      saveAnswer({
        attemptQuestionId: question.id,
        answer: {
          selectedOptionIds: answer.selectedOptionIds ?? [],
          textResponse: answer.textResponse ?? '',
          isMarkedForReview: Boolean(answer.isMarkedForReview),
        },
      }).catch((error) => setSaveFailure(error.message))
    },
    [saveAnswer],
  )

  useEffect(() => {
    if (!workspace || workspace.status !== 'IN_PROGRESS' || msLeft === 0) return
    for (const question of questions) {
      if (question.question.type !== 'WRITTEN') continue
      const answer = debouncedAnswers[question.id]
      if (answer && answer.textResponse !== (question.answer?.textResponse ?? '')) persist(question, answer)
    }
  }, [debouncedAnswers, msLeft, persist, questions, workspace])

  const performSubmit = useCallback(async () => {
    setSaveFailure('')
    try {
      for (const question of questions) {
        const answer = answers[question.id] ?? { selectedOptionIds: [], textResponse: '', isMarkedForReview: false }
        await saveAnswerAsync({
          attemptQuestionId: question.id,
          answer: {
            selectedOptionIds: answer.selectedOptionIds ?? [],
            textResponse: answer.textResponse ?? '',
            isMarkedForReview: Boolean(answer.isMarkedForReview),
          },
        })
      }
      submitAttempt(attemptId)
    } catch (error) {
      setSaveFailure(error.message)
    }
  }, [answers, attemptId, questions, saveAnswerAsync, submitAttempt])

  useEffect(() => {
    if (
      msLeft === 0 &&
      workspace?.status === 'IN_PROGRESS' &&
      !submitted &&
      !isSubmitPending &&
      !automaticSubmitStarted.current
    ) {
      automaticSubmitStarted.current = true
      submitAttempt(attemptId)
    }
  }, [attemptId, isSubmitPending, msLeft, submitAttempt, submitted, workspace?.status])

  const updateAnswer = (question, answer) => {
    setAnswers((current) => ({ ...current, [question.id]: answer }))
    if (question.question.type !== 'WRITTEN') persist(question, answer)
  }

  if (workspaceQuery.isPending) {
    return (
      <>
        <PageHeader title="Opening exam room" back={{ to: '/candidate/exams', label: 'Exams' }} />
        <div className="space-y-4" role="status">
          <span className="sr-only">Loading exam questions</span>
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-80 w-full" />
        </div>
      </>
    )
  }

  if (workspaceQuery.error) {
    return (
      <>
        <PageHeader title="Exam room" back={{ to: '/candidate/exams', label: 'Exams' }} />
        <ErrorState
          error={workspaceQuery.error}
          onRetry={workspaceQuery.refetch}
          isRetrying={workspaceQuery.isRefetching}
          title="We couldn't open your exam"
        />
      </>
    )
  }

  if (submitted || workspace.status !== 'IN_PROGRESS') {
    const summary = submitted?.summary
    return (
      <>
        <PageHeader title="Exam submitted" description={workspace.exam.title} back={{ to: '/candidate/exams', label: 'Exams' }} />
        <Card className="mx-auto max-w-2xl border-success/30">
          <CardContent className="space-y-4 py-10 text-center">
            <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden="true">
              <Check className="size-7" />
            </span>
            <h2 className="text-xl font-bold">Your answers are recorded</h2>
            <p className="text-sm text-muted">
              {summary
                ? `${summary.answeredQuestions} of ${summary.totalQuestions} questions answered.`
                : 'This attempt has already been submitted or finalized.'}
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Button asChild variant="secondary"><Link to="/candidate/exams">Back to exams</Link></Button>
              <Button asChild><Link to="/candidate/results">View results</Link></Button>
            </div>
          </CardContent>
        </Card>
      </>
    )
  }

  const setReviewFlag = () => {
    const current = answers[activeQuestion.id] ?? { selectedOptionIds: [], textResponse: '', isMarkedForReview: false }
    const next = { ...current, isMarkedForReview: !current.isMarkedForReview }
    setAnswers((state) => ({ ...state, [activeQuestion.id]: next }))
    persist(activeQuestion, next)
  }

  return (
    <>
      <PageHeader
        title={workspace.exam.title}
        description="Your work saves as you answer. The timer continues if you leave this page."
        meta={<ExamTimer expiresAt={workspace.expiresAt} />}
        back={{ to: '/candidate/exams', label: 'Exit exam' }}
        actions={
          <Button variant="danger" onClick={() => setConfirmOpen(true)} loading={submit.isPending}>
            <Send /> Submit exam
          </Button>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-5">
          {(submit.error || saveFailure) && (
            <p role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-danger">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" /> {saveFailure || submit.error?.message}
            </p>
          )}
          {activeQuestion && (
            <Card as="section" aria-labelledby={`question-title-${activeQuestion.id}`}>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-muted">Question {activeQuestion.position} of {questions.length}</p>
                  <Badge tone="neutral">{activeQuestion.assignedMarks} marks</Badge>
                </div>
                <CardTitle id={`question-title-${activeQuestion.id}`} className="pt-2 text-lg leading-relaxed">
                  {activeQuestion.question.text}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <AnswerEditor
                  question={activeQuestion}
                  value={answers[activeQuestion.id] ?? { selectedOptionIds: [], textResponse: '', isMarkedForReview: false }}
                  disabled={submit.isPending || msLeft === 0}
                  onChange={(answer) => updateAnswer(activeQuestion, answer)}
                  onSave={() => persist(activeQuestion, answers[activeQuestion.id] ?? { selectedOptionIds: [], textResponse: '', isMarkedForReview: false })}
                />
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                  <Button
                    variant={answers[activeQuestion.id]?.isMarkedForReview ? 'secondary' : 'ghost'}
                    size="sm"
                    onClick={setReviewFlag}
                    disabled={msLeft === 0}
                  >
                    <Flag /> {answers[activeQuestion.id]?.isMarkedForReview ? 'Marked for review' : 'Mark for review'}
                  </Button>
                  <p className="text-xs text-muted" role="status">
                    {save.isPending ? 'Saving answer…' : save.error ? 'Save failed — edit your answer to retry.' : 'Changes save automatically'}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex items-center justify-between gap-3">
            <Button
              variant="secondary"
              onClick={() => setActiveIndex((index) => Math.max(0, index - 1))}
              disabled={activeIndex === 0}
            >
              <ArrowLeft /> Previous
            </Button>
            {activeIndex < questions.length - 1 && (
              <Button onClick={() => setActiveIndex((index) => Math.min(questions.length - 1, index + 1))}>
                Next <ArrowRight />
              </Button>
            )}
          </div>
        </div>

        <Card as="aside" aria-label="Question navigator" className="h-fit xl:sticky xl:top-20">
          <CardHeader>
            <CardTitle>Question navigator</CardTitle>
            <p className="text-sm text-muted">{answeredCount} of {questions.length} answered</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-2">
              {questions.map((question, index) => {
                const answer = answers[question.id]
                const isAnswered = Boolean(answer?.textResponse?.trim() || answer?.selectedOptionIds?.length)
                return (
                  <button
                    key={question.id}
                    type="button"
                    onClick={() => setActiveIndex(index)}
                    aria-label={`Question ${question.position}${isAnswered ? ', answered' : ', unanswered'}${answer?.isMarkedForReview ? ', marked for review' : ''}`}
                    aria-current={index === activeIndex ? 'step' : undefined}
                    className={cn(
                      'relative flex size-10 items-center justify-center rounded-md border text-sm font-semibold transition-colors',
                      index === activeIndex ? 'border-primary bg-primary text-on-primary' : isAnswered ? 'border-success/30 bg-success-soft text-success' : 'border-border bg-surface text-muted hover:bg-sunken',
                    )}
                  >
                    {question.position}
                    {answer?.isMarkedForReview && <Flag className="absolute -right-1 -top-1 size-3 text-warning" aria-hidden="true" />}
                  </button>
                )
              })}
            </div>
            <div className="mt-5 space-y-2 border-t border-border pt-4 text-xs text-muted">
              <p><span className="mr-2 inline-block size-2.5 rounded-full bg-success align-middle" /> Answered</p>
              <p><span className="mr-2 inline-block size-2.5 rounded-full bg-sunken align-middle" /> Not answered</p>
              <p><Flag className="mr-1.5 inline size-3 text-warning" aria-hidden="true" /> Marked for review</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Submit this exam?"
        description={`You have answered ${answeredCount} of ${questions.length} questions. You cannot change your answers after submitting.`}
        confirmLabel="Submit exam"
        isPending={submit.isPending}
        onConfirm={() => void performSubmit()}
      >
        {saveFailure && <p role="alert" className="rounded-md bg-danger-soft p-3 text-sm text-danger">{saveFailure}</p>}
      </ConfirmDialog>
    </>
  )
}
