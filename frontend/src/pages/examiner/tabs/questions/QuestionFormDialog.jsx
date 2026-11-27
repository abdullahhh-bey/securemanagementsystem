import { useEffect } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { applyFieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Select, Textarea } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { useCreateQuestion, useUpdateQuestion } from '@/hooks/useQuestions'
import { DIFFICULTY_OPTIONS, MARKING_RULES, QUESTION_TYPE_OPTIONS } from '@/lib/constants'
import { questionSchema } from '@/lib/schemas'

const EMPTY = {
  type: 'MCQ_SINGLE',
  text: '',
  topic: '',
  difficulty: 'medium',
  defaultMarks: 5,
  options: [
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
  markingRule: 'ALL_OR_NOTHING',
  penalty: 0.25,
  modelAnswer: '',
}

const toForm = (question) =>
  question
    ? {
        type: question.type,
        text: question.text,
        topic: question.topic,
        difficulty: question.difficulty,
        defaultMarks: question.defaultMarks,
        options: question.options?.length
          ? question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
          : EMPTY.options,
        markingRule: question.markingRule ?? 'ALL_OR_NOTHING',
        penalty: question.penalty ?? 0.25,
        modelAnswer: question.modelAnswer ?? '',
      }
    : EMPTY

const toPayload = (values) => {
  const filled = values.options.filter((o) => o.text.trim())
  const base = {
    type: values.type,
    text: values.text.trim(),
    topic: values.topic.trim(),
    difficulty: values.difficulty,
    defaultMarks: Number(values.defaultMarks),
    options: values.type === 'WRITTEN' ? [] : filled.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
    markingRule: values.type === 'MCQ_MULTI' ? values.markingRule : null,
    penalty: values.type === 'MCQ_MULTI' && values.markingRule === 'PARTIAL' ? Number(values.penalty) : 0,
    modelAnswer: values.type === 'WRITTEN' ? values.modelAnswer.trim() : '',
  }
  return base
}

export function QuestionFormDialog({ open, onOpenChange, question }) {
  const create = useCreateQuestion()
  const update = useUpdateQuestion()
  const pending = create.isPending || update.isPending

  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(questionSchema),
    defaultValues: EMPTY,
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'options' })
  const type = useWatch({ control, name: 'type' })
  const markingRule = useWatch({ control, name: 'markingRule' })

  useEffect(() => {
    if (open) reset(toForm(question))
  }, [open, question, reset])

  const save = handleSubmit((values) => {
    const payload = toPayload(values)
    const onError = (error) => applyFieldErrors(error, setError)
    if (question) {
      update.mutate({ id: question.id, input: payload }, { onSuccess: () => onOpenChange(false), onError })
    } else {
      create.mutate(payload, { onSuccess: () => onOpenChange(false), onError })
    }
  })

  const handleOpenChange = (next) => {
    if (pending) return
    onOpenChange(next)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{question ? 'Edit question' : 'New question'}</DialogTitle>
          <DialogDescription>Add it to your bank first, then assign it to this exam.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form id="question-form" noValidate className="space-y-5" onSubmit={save}>
            <fieldset disabled={pending} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <FormField label="Type" error={errors.type?.message} required>
                  {(field) => (
                    <Select {...field} {...register('type')}>
                      {QUESTION_TYPE_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
                <FormField label="Difficulty" error={errors.difficulty?.message} required>
                  {(field) => (
                    <Select {...field} {...register('difficulty')}>
                      {DIFFICULTY_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </Select>
                  )}
                </FormField>
              </div>

              <FormField label="Topic" error={errors.topic?.message} required>
                {(field) => <Input {...field} {...register('topic')} placeholder="e.g. Networks" />}
              </FormField>

              <FormField label="Question text" error={errors.text?.message} required>
                {(field) => <Textarea {...field} rows={4} {...register('text')} />}
              </FormField>

              <FormField label="Default marks" error={errors.defaultMarks?.message} required hint={type === 'WRITTEN' ? 'Maximum marks when assigned to an exam.' : undefined}>
                {(field) => <Input {...field} type="number" min={1} step={1} {...register('defaultMarks', { valueAsNumber: true })} />}
              </FormField>

              {(type === 'MCQ_SINGLE' || type === 'MCQ_MULTI') && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Answer options</p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => append({ text: '', isCorrect: false })} disabled={fields.length >= 8}>
                      <Plus /> Add option
                    </Button>
                  </div>
                  {errors.options?.message && (
                    <p className="text-sm font-medium text-danger" role="alert">
                      {errors.options.message}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {fields.map((field, index) => (
                      <li key={field.id} className="flex items-start gap-2">
                        <Controller
                          control={control}
                          name={`options.${index}.isCorrect`}
                          render={({ field: checkField }) => (
                            <Checkbox
                              className="mt-2.5"
                              checked={checkField.value}
                              onCheckedChange={(checked) => {
                                if (type === 'MCQ_SINGLE' && checked === true) {
                                  fields.forEach((_, i) => {
                                    if (i !== index) setValue(`options.${i}.isCorrect`, false)
                                  })
                                }
                                checkField.onChange(checked === true)
                              }}
                              aria-label={`Mark option ${index + 1} as correct`}
                            />
                          )}
                        />
                        <FormField label={`Option ${index + 1}`} error={errors.options?.[index]?.text?.message} className="min-w-0 flex-1">
                          {(fieldProps) => <Input {...fieldProps} {...register(`options.${index}.text`)} />}
                        </FormField>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="mt-7 text-muted"
                          aria-label={`Remove option ${index + 1}`}
                          disabled={fields.length <= 2}
                          onClick={() => remove(index)}
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {type === 'MCQ_MULTI' && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField label="Marking rule" error={errors.markingRule?.message}>
                        {(field) => (
                          <Select {...field} {...register('markingRule')}>
                            {Object.entries(MARKING_RULES).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </Select>
                        )}
                      </FormField>
                      {markingRule === 'PARTIAL' && (
                        <FormField label="Penalty per wrong option" error={errors.penalty?.message} hint="Fraction of the marks lost (0 to 1).">
                          {(field) => <Input {...field} type="number" min={0} max={1} step={0.05} {...register('penalty', { valueAsNumber: true })} />}
                        </FormField>
                      )}
                    </div>
                  )}
                </div>
              )}

              {type === 'WRITTEN' && (
                <FormField label="Model answer" error={errors.modelAnswer?.message} hint="Optional reference for markers.">
                  {(field) => <Textarea {...field} rows={4} {...register('modelAnswer')} />}
                </FormField>
              )}
            </fieldset>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="question-form" loading={pending}>
            {question ? 'Save changes' : 'Create question'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}