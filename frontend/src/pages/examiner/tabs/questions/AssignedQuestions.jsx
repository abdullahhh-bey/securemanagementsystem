import { AlertTriangle, Lock, Save, Shuffle, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { StatusBadge } from '@/components/StatusBadge'
import { QUESTION_TYPE_META } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { computePaperMarks } from './paperMarks'

function localWarnings(items) {
  const warnings = []
  const groups = new Map()
  for (const item of items) {
    if (!item.group) continue
    if (!groups.has(item.group)) groups.set(item.group, [])
    groups.get(item.group).push(item)
  }
  for (const [group, variants] of groups) {
    if (variants.length < 2) warnings.push(`Variant group ${group} has only one question; add an alternative or clear the group.`)
    if (new Set(variants.map((v) => Number(v.marks))).size > 1) {
      warnings.push(`Variants in group ${group} are worth different marks, so papers would not be equal.`)
    }
  }
  return warnings
}

export function AssignedQuestions({
  exam,
  items,
  questionMap,
  editable,
  isDirty,
  onChange,
  onSave,
  isSaving,
  error,
  onRetry,
  isRetrying,
  isLoading,
  onPreviewShuffle,
  shuffleDisabledReason,
}) {
  const paperMarks = computePaperMarks(items)
  const targetMarks = exam.totalMarks
  const marksMismatch = paperMarks !== targetMarks
  const warnings = [...localWarnings(items)]

  const updateItem = (index, patch) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  }

  const removeItem = (index) => {
    onChange(items.filter((_, i) => i !== index))
  }

  if (error) {
    return (
      <Card>
        <ErrorState error={error} onRetry={onRetry} isRetrying={isRetrying} />
      </Card>
    )
  }

  if (isLoading) {
    return (
      <Card as="section" aria-busy="true" aria-labelledby="assigned-heading">
        <CardHeader>
          <CardTitle id="assigned-heading">Assigned to this exam</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-10 animate-pulse rounded-md bg-sunken" />
          <div className="h-24 animate-pulse rounded-md bg-sunken" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card as="section" aria-labelledby="assigned-heading">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle id="assigned-heading">Assigned to this exam</CardTitle>
          <CardDescription>
            Set marks and optional variant groups (A, B, …) so each candidate gets one question per group.
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={onPreviewShuffle} disabledReason={shuffleDisabledReason}>
            <Shuffle /> Shuffle preview
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            loading={isSaving}
            disabledReason={!editable ? 'Questions are locked after the exam leaves draft.' : !isDirty ? 'No unsaved changes.' : items.length === 0 ? 'Add at least one question.' : undefined}
          >
            {!isSaving && <Save />}
            Save questions
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!editable && (
          <p className="flex items-center gap-2 rounded-lg border border-border bg-sunken p-3 text-sm text-muted">
            <Lock className="size-4 shrink-0" aria-hidden="true" />
            This exam is no longer a draft. The question list is read-only.
          </p>
        )}

        <div
          className={cn(
            'flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-3 py-2 text-sm',
            marksMismatch ? 'border-warning/40 bg-warning-soft text-warning' : 'border-border bg-sunken text-muted',
          )}
          role="status"
        >
          <span>
            Paper total:{' '}
            <span className="num font-semibold text-ink">
              {paperMarks}
            </span>
            {' / '}
            <span className="num">{targetMarks}</span> exam marks
          </span>
          {marksMismatch && (
            <span className="inline-flex items-center gap-1 font-medium">
              <AlertTriangle className="size-4" aria-hidden="true" />
              Totals do not match — adjust marks or update the exam total in Details.
            </span>
          )}
        </div>

        {warnings.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2 text-sm text-warning">
            {warnings.map((message) => (
              <li key={message} className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                {message}
              </li>
            ))}
          </ul>
        )}

        {items.length === 0 ? (
          <EmptyState title="No questions on this exam yet" description="Add questions from your bank below, then save." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {items.map((item, index) => {
              const question = questionMap.get(item.questionId) ?? item.question
              if (!question) return null
              const typeMeta = QUESTION_TYPE_META[question.type]
              return (
                <li key={item.questionId} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium text-ink">{question.text}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                      <span>{question.topic}</span>
                      <StatusBadge kind="difficulty" status={question.difficulty} />
                      {typeMeta && <span className="rounded-md border border-border bg-surface px-1.5 py-0.5 font-semibold">{typeMeta.short}</span>}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-end gap-3">
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                      Marks
                      <Input
                        type="number"
                        min={1}
                        step={1}
                        className="num w-24"
                        value={item.marks}
                        disabled={!editable}
                        onChange={(event) => updateItem(index, { marks: Number(event.target.value) })}
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-xs font-medium text-muted">
                      Group
                      <Input
                        type="text"
                        maxLength={2}
                        className="w-16 uppercase"
                        placeholder="—"
                        value={item.group ?? ''}
                        disabled={!editable}
                        onChange={(event) => {
                          const raw = event.target.value.trim().toUpperCase()
                          updateItem(index, { group: raw || null })
                        }}
                      />
                    </label>
                    {editable && (
                      <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" aria-label="Remove from exam" onClick={() => removeItem(index)}>
                        <Trash2 /> Remove
                      </Button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}