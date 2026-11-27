import { useNavigate, useParams } from 'react-router-dom'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowRight, Lock, Save } from 'lucide-react'
import { applyFieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input, Textarea } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { ErrorState } from '@/components/ErrorState'
import { FormField } from '@/components/FormField'
import { PageHeader } from '@/components/PageHeader'
import { ExamFlowStepper } from '@/components/exam/ExamFlowStepper'
import { useCreateExam, useExam, useUpdateExam } from '@/hooks/useExams'
import { SETTING_DEFS } from '@/lib/constants'
import { formatDuration, isoToLocalInput, localInputToIso, localTimeZoneLabel } from '@/lib/format'
import { examSchema } from '@/lib/schemas'

const EMPTY = {
  title: '',
  instructions: '',
  startAt: '',
  endAt: '',
  durationMinutes: 60,
  totalMarks: 100,
  settings: { shuffleQuestions: true, shuffleOptions: true, negativeMarking: false },
}

const toFormValues = (exam) => ({
  title: exam.title,
  instructions: exam.instructions ?? '',
  startAt: isoToLocalInput(exam.startAt),
  endAt: isoToLocalInput(exam.endAt),
  durationMinutes: exam.durationMinutes,
  totalMarks: exam.totalMarks,
  settings: { ...EMPTY.settings, ...exam.settings },
})

const toPayload = (values) => ({
  ...values,
  title: values.title.trim(),
  instructions: values.instructions.trim(),
  startAt: localInputToIso(values.startAt),
  endAt: localInputToIso(values.endAt),
})

function ExamForm({ exam }) {
  const navigate = useNavigate()
  const locked = Boolean(exam) && exam.status !== 'DRAFT'

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(examSchema),
    defaultValues: exam ? toFormValues(exam) : EMPTY,
  })

  const [startAt, endAt] = useWatch({ control, name: ['startAt', 'endAt'] })
  const windowMinutes = startAt && endAt ? Math.floor((new Date(endAt) - new Date(startAt)) / 60000) : null

  const createExam = useCreateExam()
  const updateExam = useUpdateExam(exam?.id)
  const mutation = exam ? updateExam : createExam
  const pending = mutation.isPending

  const save = (destination) =>
    handleSubmit((values) =>
      mutation.mutate(toPayload(values), {
        onSuccess: (saved) => navigate(destination === 'review' ? `/examiner/exams/${saved.id}/review` : `/examiner/exams/${saved.id}`),
        onError: (error) => applyFieldErrors(error, setError),
      }),
    )

  const tz = localTimeZoneLabel()

  return (
    <form noValidate onSubmit={save('review')}>
      <fieldset disabled={locked} className="space-y-6">
        <legend className="sr-only">Exam details</legend>

        <Card as="section" aria-labelledby="basics-heading">
          <CardHeader>
            <CardTitle id="basics-heading">Basics</CardTitle>
            <CardDescription>What candidates will see before they enter.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField label="Title" error={errors.title?.message} required>
              {(field) => <Input {...field} placeholder="e.g. Data Structures Midterm" {...register('title')} />}
            </FormField>
            <FormField
              label="Instructions"
              error={errors.instructions?.message}
              hint="Shown to candidates on their exam card and before they start."
            >
              {(field) => <Textarea {...field} rows={5} {...register('instructions')} />}
            </FormField>
          </CardContent>
        </Card>

        <Card as="section" aria-labelledby="schedule-heading">
          <CardHeader>
            <CardTitle id="schedule-heading">Schedule and scoring</CardTitle>
            <CardDescription>
              Candidates can enter any time inside the window and then get their full duration.{tz ? ` Times are in your timezone (${tz}).` : ''}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-5 sm:grid-cols-2">
            <FormField label="Opens at" error={errors.startAt?.message} required>
              {(field) => <Input {...field} type="datetime-local" {...register('startAt')} />}
            </FormField>
            <FormField label="Closes at" error={errors.endAt?.message} required>
              {(field) => <Input {...field} type="datetime-local" {...register('endAt')} />}
            </FormField>
            <FormField
              label="Duration (minutes)"
              error={errors.durationMinutes?.message}
              hint={windowMinutes > 0 ? `The window is ${formatDuration(windowMinutes)} long; duration must fit inside it.` : 'Must fit inside the window.'}
              required
            >
              {(field) => <Input {...field} type="number" inputMode="numeric" min={1} step={1} {...register('durationMinutes', { valueAsNumber: true })} />}
            </FormField>
            <FormField label="Total marks" error={errors.totalMarks?.message} required>
              {(field) => <Input {...field} type="number" inputMode="numeric" min={1} step={1} {...register('totalMarks', { valueAsNumber: true })} />}
            </FormField>
          </CardContent>
        </Card>

        <Card as="section" aria-labelledby="settings-heading">
          <CardHeader>
            <CardTitle id="settings-heading">Exam settings</CardTitle>
          </CardHeader>
          <ul className="divide-y divide-border">
            {SETTING_DEFS.map(({ key, label, description }) => (
              <li key={key} className="flex items-center justify-between gap-6 px-6 py-4">
                <div>
                  <Label htmlFor={`setting-${key}`}>{label}</Label>
                  <p id={`setting-${key}-desc`} className="mt-1 text-sm text-muted">
                    {description}
                  </p>
                </div>
                <Controller
                  control={control}
                  name={`settings.${key}`}
                  render={({ field }) => (
                    <Switch
                      id={`setting-${key}`}
                      aria-describedby={`setting-${key}-desc`}
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      onBlur={field.onBlur}
                      ref={field.ref}
                    />
                  )}
                />
              </li>
            ))}
          </ul>
        </Card>
      </fieldset>

      {locked ? (
        <p className="mt-6 flex items-center gap-2 rounded-lg border border-warning/30 bg-warning-soft p-3 text-sm font-medium text-warning">
          <Lock className="size-4 shrink-0" aria-hidden="true" />
          This exam is no longer a draft, so its details can't be edited.
        </p>
      ) : (
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => navigate(exam ? `/examiner/exams/${exam.id}` : '/examiner/exams')} disabled={pending}>
            Cancel
          </Button>
          <Button variant="secondary" onClick={save('details')} loading={pending}>
            {!pending && <Save />}
            Save draft
          </Button>
          <Button type="submit" loading={pending}>
            Save and review
            {!pending && <ArrowRight />}
          </Button>
        </div>
      )}
    </form>
  )
}

export default function ExamFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const { data: exam, isPending, error, refetch, isRefetching } = useExam(id)

  const header = (
    <PageHeader
      title={isEdit ? 'Edit exam' : 'Create exam'}
      description={isEdit ? 'Update the details, then review before publishing.' : 'Set up the basics now - you can enroll candidates after saving.'}
      back={isEdit ? { to: `/examiner/exams/${id}`, label: 'Back to exam' } : { to: '/examiner/exams', label: 'My exams' }}
    />
  )

  if (!isEdit) {
    return (
      <>
        {header}
        <ExamFlowStepper current={0} />
        <ExamForm />
      </>
    )
  }

  return (
    <>
      {header}
      <ExamFlowStepper current={0} />
      {error ? (
        <ErrorState error={error} onRetry={refetch} isRetrying={isRefetching} title="We couldn't load this exam" />
      ) : isPending ? (
        <div className="space-y-6" role="status">
          <span className="sr-only">Loading exam</span>
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-56 w-full" />
        </div>
      ) : (
        <ExamForm key={exam.id} exam={exam} />
      )}
    </>
  )
}
