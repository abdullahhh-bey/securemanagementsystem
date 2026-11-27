import { useEffect } from 'react'
import { Controller, useFieldArray, useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Trash2 } from 'lucide-react'
import { applyFieldErrors } from '@/api/client'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input, Select, Textarea } from '@/components/ui/input'
import { FormField } from '@/components/FormField'
import { useCreateQuestion, useUpdateQuestion } from '@/hooks/useQuestions'
import { DIFFICULTY_OPTIONS, QUESTION_TYPE_OPTIONS } from '@/lib/constants'
import { questionSchema } from '@/lib/schemas'

const isSingle = (type) => type === 'SINGLE_CHOICE' || type === 'MCQ_SINGLE'
const isChoice = (type) => isSingle(type)
const isLegacyMultipleChoice = (type) => type === 'MULTIPLE_SELECT' || type === 'MCQ_MULTI'

const EMPTY = {
  type: 'SINGLE_CHOICE',
  text: '',
  topic: '',
  difficulty: 'MEDIUM',
  defaultMarks: 5,
  options: [
    { text: '', isCorrect: false },
    { text: '', isCorrect: false },
  ],
  penalty: 0.25,
  modelAnswer: '',
}

const toForm = (question) =>
  question
    ? {
        type: isLegacyMultipleChoice(question.type) ? 'SINGLE_CHOICE' : question.type,
        text: question.text,
        topic: question.topic ?? '',
        difficulty: question.difficulty,
        defaultMarks: question.defaultMarks,
        options: question.options?.length
          ? question.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect }))
          : EMPTY.options,
        penalty: question.penalty ?? 0.25,
        modelAnswer: question.modelAnswer ?? '',
      }
    : EMPTY

const toPayload = (values) => {
  const filled = values.options.filter((o) => o.text.trim())
  return {
    type: values.type,
    text: values.text.trim(),
    topic: values.topic?.trim() ?? '',
    difficulty: values.difficulty,
    defaultMarks: Number(values.defaultMarks),
    options: values.type === 'WRITTEN' ? [] : filled.map((o) => ({ text: o.text.trim(), isCorrect: o.isCorrect })),
    markingRule: null,
    penalty: values.type === 'SINGLE_CHOICE' ? Number(values.penalty) : 0,
    modelAnswer: values.type === 'WRITTEN' ? values.modelAnswer.trim() : '',
  }
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
        </DialogHeader>
        <DialogBody>
          <form id="question-form" noValidate className="grid gap-4" onSubmit={save}>
            <fieldset disabled={pending} className="grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Question type" error={errors.type?.message} required>
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

              {question && isLegacyMultipleChoice(question.type) && (
                <p className="rounded-md border border-warning/40 bg-warning-soft px-3 py-2 text-sm text-ink" role="note">
                  This existing question allowed more than one correct answer. Choose exactly one correct option to convert it to Multiple Choices.
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <FormField label="Topic (optional)" error={errors.topic?.message}>
                  {(field) => <Input {...field} {...register('topic')} placeholder="e.g. Networking" />}
                </FormField>
                <FormField label="Marks" error={errors.defaultMarks?.message} required>
                  {(field) => <Input {...field} type="number" min={1} step={1} {...register('defaultMarks', { valueAsNumber: true })} />}
                </FormField>
              </div>

              <FormField label="Question" error={errors.text?.message} required>
                {(field) => <Textarea {...field} rows={4} {...register('text')} />}
              </FormField>

              {isChoice(type) && (
                <div className="space-y-3">
                  <p className="text-sm text-muted">Mark one correct answer. Students can select only one option.</p>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">Options</p>
                    <Button type="button" variant="secondary" size="sm" onClick={() => append({ text: '', isCorrect: false })} disabled={fields.length >= 8}>
                      <Plus /> Add
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
                            <input
                              type="radio"
                              name="correct-option"
                              className="mt-2.5 size-4 shrink-0 accent-primary"
                              checked={checkField.value}
                              onChange={() => {
                                fields.forEach((_, i) => {
                                  if (i !== index) setValue(`options.${i}.isCorrect`, false)
                                })
                                checkField.onChange(true)
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
                  {type === 'SINGLE_CHOICE' && (
                    <FormField
                      label="Wrong-answer penalty (fraction of marks)"
                      error={errors.penalty?.message}
                      hint="For example, 0.25 deducts one quarter of this question's marks when exam negative marking is on."
                    >
                      {(field) => <Input {...field} type="number" min={0} max={1} step={0.05} {...register('penalty', { valueAsNumber: true })} />}
                    </FormField>
                  )}
                </div>
              )}

              {type === 'WRITTEN' && (
                <FormField label="Model answer" error={errors.modelAnswer?.message}>
                  {(field) => <Textarea {...field} rows={3} {...register('modelAnswer')} />}
                </FormField>
              )}
            </fieldset>
          </form>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={() => handleOpenChange(false)} disabled={pending}>
            Cancel
          </Button>
          <Button type="submit" form="question-form" loading={pending} loadingLabel="Saving…">
            {question ? 'Save' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
