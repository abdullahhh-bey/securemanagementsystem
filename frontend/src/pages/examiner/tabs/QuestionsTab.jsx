import { useMemo, useState } from 'react'
import { FileUp, ListPlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { Badge, StatusBadge } from '@/components/StatusBadge'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { DataTable } from '@/components/DataTable'
import { EmptyState } from '@/components/EmptyState'
import { ImportDialog } from '@/components/import/ImportDialog'
import { Button } from '@/components/ui/button'
import {
  useDeleteQuestion,
  useExamQuestions,
  useImportQuestions,
  useQuestions,
  useSetExamQuestions,
} from '@/hooks/useQuestions'
import { DIFFICULTY_OPTIONS, QUESTION_TYPE_META } from '@/lib/constants'
import { parseQuestionRecord } from '@/lib/importSchemas'
import { AssignedQuestions } from './questions/AssignedQuestions'
import { QuestionFormDialog } from './questions/QuestionFormDialog'
import { ShufflePreviewDialog } from './questions/ShufflePreviewDialog'

const toDraftItems = (items) =>
  (items ?? []).map((item) => ({
    questionId: item.questionId,
    marks: item.marks,
    group: item.group ?? null,
    question: item.question,
  }))

export function QuestionsTab({ exam }) {
  const bank = useQuestions()
  const assigned = useExamQuestions(exam.id)
  const saveAssigned = useSetExamQuestions(exam.id)
  const removeQuestion = useDeleteQuestion()
  const importQuestions = useImportQuestions()

  const [draftOverride, setDraftOverride] = useState(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [importOpen, setImportOpen] = useState(false)
  const [shuffleOpen, setShuffleOpen] = useState(false)

  const editable = assigned.data?.editable ?? exam.status === 'DRAFT'
  const serverDraft = useMemo(() => toDraftItems(assigned.data?.items), [assigned.data])
  const draft = draftOverride ?? serverDraft
  const dirty = draftOverride !== null
  const setDraft = (updater) => {
    setDraftOverride((current) => {
      const base = current ?? serverDraft
      return typeof updater === 'function' ? updater(base) : updater
    })
  }
  const assignedIds = useMemo(() => new Set(draft.map((item) => item.questionId)), [draft])

  const questionMap = useMemo(() => {
    const map = new Map()
    for (const q of bank.data ?? []) map.set(q.id, q)
    for (const item of draft) {
      if (item.question) map.set(item.questionId, item.question)
    }
    return map
  }, [bank.data, draft])

  const addToExam = (question) => {
    if (!editable) return
    if (assignedIds.has(question.id)) return
    setDraft((current) => [...current, { questionId: question.id, marks: question.defaultMarks, group: null, question }])
  }

  const handleSave = () => {
    const payload = draft.map(({ questionId, marks, group }) => ({
      questionId,
      marks: Number(marks),
      group: group || null,
    }))
    saveAssigned.mutate(payload, {
      onSuccess: () => setDraftOverride(null),
    })
  }

  const savedCount = assigned.data?.items?.length ?? 0
  const hasUnsavedChanges = dirty
  const shuffleDisabledReason = hasUnsavedChanges
    ? 'Save your changes before previewing shuffle.'
    : savedCount === 0
      ? 'Add and save questions first.'
      : undefined

  const columns = [
    {
      key: 'text',
      header: 'Question',
      sortValue: (q) => q.text.toLowerCase(),
      cell: (q) => <p className="line-clamp-2 max-w-md text-sm">{q.text}</p>,
    },
    {
      key: 'type',
      header: 'Type',
      sortValue: (q) => q.type,
      cell: (q) => <Badge tone="brand">{QUESTION_TYPE_META[q.type]?.short ?? q.type}</Badge>,
    },
    {
      key: 'topic',
      header: 'Topic',
      sortValue: (q) => q.topic.toLowerCase(),
      cell: (q) => <span className="text-sm">{q.topic}</span>,
    },
    {
      key: 'difficulty',
      header: 'Difficulty',
      sortValue: (q) => q.difficulty,
      cell: (q) => <StatusBadge kind="difficulty" status={q.difficulty} />,
    },
    {
      key: 'defaultMarks',
      header: 'Marks',
      sortValue: (q) => q.defaultMarks,
      className: 'text-right',
      headerClassName: 'text-right',
      cell: (q) => <span className="num text-sm">{q.defaultMarks}</span>,
    },
    {
      key: 'actions',
      header: <span className="sr-only">Actions</span>,
      className: 'text-right',
      cell: (q) => (
        <div className="flex justify-end gap-1">
          <Button variant="ghost" size="sm" onClick={() => { setEditing(q); setFormOpen(true) }} aria-label="Edit question">
            <Pencil /> Edit
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addToExam(q)}
            disabledReason={
              !editable
                ? 'Questions are locked after the exam leaves draft.'
                : assignedIds.has(q.id)
                  ? 'Already on this exam.'
                  : undefined
            }
            aria-label="Add to exam"
          >
            <ListPlus /> Add
          </Button>
          <Button variant="ghost" size="sm" className="text-danger hover:bg-danger-soft" onClick={() => setDeleteTarget(q)} aria-label="Delete question">
            <Trash2 />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <AssignedQuestions
        exam={exam}
        items={draft}
        questionMap={questionMap}
        editable={editable}
        isDirty={dirty}
        onChange={setDraft}
        onSave={handleSave}
        isSaving={saveAssigned.isPending}
        error={assigned.error}
        onRetry={assigned.refetch}
        isRetrying={assigned.isRefetching}
        isLoading={assigned.isPending && !assigned.data}
        onPreviewShuffle={() => setShuffleOpen(true)}
        shuffleDisabledReason={shuffleDisabledReason}
      />

      <section aria-labelledby="bank-heading">
        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 id="bank-heading" className="text-base font-semibold">
            Question bank
          </h2>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <FileUp /> Import
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditing(null)
                setFormOpen(true)
              }}
            >
              <Plus /> New question
            </Button>
          </div>
        </div>

        <DataTable
          caption="Question bank"
          columns={columns}
          rows={bank.data}
          isLoading={bank.isPending}
          error={bank.error}
          onRetry={bank.refetch}
          isRetrying={bank.isRefetching}
          pageSize={8}
          searchText={(q) => `${q.text} ${q.topic}`}
          searchLabel="Search questions"
          searchPlaceholder="Search by text or topic"
          filters={[
            {
              id: 'topic',
              label: 'Topic',
              options: [
                { value: '', label: 'All topics' },
                ...[...new Set((bank.data ?? []).map((q) => q.topic))].sort().map((topic) => ({ value: topic, label: topic })),
              ],
              match: (q, value) => q.topic === value,
            },
            {
              id: 'difficulty',
              label: 'Difficulty',
              options: [{ value: '', label: 'Any difficulty' }, ...DIFFICULTY_OPTIONS],
              match: (q, value) => q.difficulty === value,
            },
          ]}
          initialSort={{ key: 'topic', dir: 'asc' }}
          emptyState={
            <EmptyState
              icon={Plus}
              title="Your question bank is empty"
              description="Create a question or import a CSV/JSON file to get started."
              action={
                <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
                  <Plus /> New question
                </Button>
              }
            />
          }
        />
      </section>

      <QuestionFormDialog open={formOpen} onOpenChange={setFormOpen} question={editing} />

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        title="Import questions"
        description="Upload a CSV or JSON file. Only valid rows are sent; fix every error before importing."
        sampleHint="Columns: type, text, topic, difficulty, defaultMarks, options (or option1…), correct, markingRule, penalty, modelAnswer."
        parseRecord={parseQuestionRecord}
        columns={[
          { key: 'topic', header: 'Topic' },
          { key: 'type', header: 'Type' },
          { key: 'difficulty', header: 'Difficulty' },
          {
            key: 'text',
            header: 'Text',
            cell: (row) => <span className="line-clamp-1">{row.value?.text}</span>,
          },
        ]}
        onImport={(rows) => importQuestions.mutateAsync(rows)}
      />

      <ShufflePreviewDialog open={shuffleOpen} onOpenChange={setShuffleOpen} examId={exam.id} hasSavedQuestions={savedCount > 0 && !hasUnsavedChanges} />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete this question?"
        description={
          deleteTarget?.usedInExams
            ? 'It is still assigned to an exam. Remove it from every exam before deleting.'
            : 'It will be removed from your bank permanently.'
        }
        confirmLabel="Delete question"
        tone="danger"
        isPending={removeQuestion.isPending}
        onConfirm={() => {
          if (!deleteTarget || deleteTarget.usedInExams > 0) return
          removeQuestion.mutate(deleteTarget.id, {
            onSettled: () => setDeleteTarget(null),
          })
        }}
      >
        {deleteTarget?.usedInExams > 0 && (
          <p className="text-muted">Used in {deleteTarget.usedInExams} exam{deleteTarget.usedInExams === 1 ? '' : 's'}.</p>
        )}
      </ConfirmDialog>
    </div>
  )
}