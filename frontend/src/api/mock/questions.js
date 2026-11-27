import { examStatus, nextId, requireRole } from './db'
import { record } from './audit'
import { assignedFor, examQuestions, hash, paperMarks, questionById, questions, rng, buildPaper } from './examData'
import { ownedExam } from './exams'
import { clone, delay, fail, serverNow } from './helpers'

const TYPE_ALIASES = {
  SINGLE_CHOICE: 'MCQ_SINGLE',
  MULTIPLE_SELECT: 'MCQ_MULTI',
  WRITTEN: 'WRITTEN',
  MCQ_SINGLE: 'MCQ_SINGLE',
  MCQ_MULTI: 'MCQ_MULTI',
}
const DIFF_ALIASES = {
  EASY: 'easy',
  MEDIUM: 'medium',
  HARD: 'hard',
  easy: 'easy',
  medium: 'medium',
  hard: 'hard',
}
const RULES = ['ALL_OR_NOTHING', 'PARTIAL']

function usage(questionId) {
  return [...examQuestions.entries()].filter(([, items]) => items.some((i) => i.questionId === questionId)).length
}

const dto = (q) => ({ ...q, usedInExams: usage(q.id) })

function ownedQuestion(id) {
  const me = requireRole('EXAMINER')
  const found = questions.find((q) => q.id === id)
  if (!found) fail(404, 'NOT_FOUND', 'That question no longer exists.')
  if (found.ownerId !== me.id) fail(403, 'FORBIDDEN', 'That question belongs to another examiner.')
  return found
}

/** Validates and normalises a question payload. Throws 422 with field messages. */
export function normalizeQuestion(input) {
  const details = {}
  const type = TYPE_ALIASES[input.type] ?? null
  const difficulty = DIFF_ALIASES[input.difficulty] ?? null
  if (!type) details.type = 'Choose a question type.'
  if (!input.text?.trim()) details.text = 'Question text is required.'
  if (!input.topic?.trim()) details.topic = 'Topic is required.'
  if (!difficulty) details.difficulty = 'Difficulty must be easy, medium or hard.'
  if (!(Number(input.defaultMarks) > 0)) details.defaultMarks = 'Marks must be more than zero.'

  let options = []
  let markingRule = null
  let penalty = 0
  if (type === 'MCQ_SINGLE' || type === 'MCQ_MULTI') {
    options = (input.options ?? []).map((o) => ({ text: String(o.text ?? '').trim(), isCorrect: Boolean(o.isCorrect) })).filter((o) => o.text)
    const correct = options.filter((o) => o.isCorrect).length
    if (options.length < 2) details.options = 'Add at least two answer options.'
    else if (correct === 0) details.options = 'Mark at least one option as correct.'
    else if (type === 'MCQ_SINGLE' && correct > 1) details.options = 'A single-answer question can have only one correct option.'
    if (type === 'MCQ_MULTI') {
      markingRule = input.markingRule ?? 'ALL_OR_NOTHING'
      if (!RULES.includes(markingRule)) details.markingRule = 'Choose a marking rule.'
      if (markingRule === 'PARTIAL') {
        penalty = Number(input.penalty ?? 0)
        if (Number.isNaN(penalty) || penalty < 0 || penalty > 1) details.penalty = 'The penalty is a fraction between 0 and 1.'
      }
    }
  }
  if (Object.keys(details).length > 0) fail(422, 'VALIDATION_ERROR', 'Some of the question details are not valid.', details)
  return {
    type,
    text: input.text.trim(),
    topic: input.topic.trim(),
    difficulty,
    defaultMarks: Number(input.defaultMarks),
    options,
    markingRule,
    penalty,
    modelAnswer: type === 'WRITTEN' ? (input.modelAnswer ?? '').trim() : '',
  }
}

function build(normalized, ownerId, id = nextId('q')) {
  return {
    id,
    ownerId,
    ...normalized,
    options: normalized.options.map((o, i) => ({ id: `${id}_o${i + 1}`, ...o })),
  }
}

// GET /api/questions
export async function listQuestions() {
  const me = requireRole('EXAMINER')
  await delay()
  return clone(questions.filter((q) => q.ownerId === me.id).map(dto).sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
}

// POST /api/questions
export async function createQuestion(input) {
  const me = requireRole('EXAMINER')
  await delay()
  const created = build(normalizeQuestion(input), me.id)
  created.createdAt = new Date(serverNow()).toISOString()
  questions.push(created)
  record(me, 'QUESTION_CREATED', 'Question bank', `Created "${created.text.slice(0, 48)}"`)
  return clone(dto(created))
}

// PATCH /api/questions/:id
export async function updateQuestion(id, input) {
  const target = ownedQuestion(id)
  await delay()
  const normalized = normalizeQuestion(input)
  Object.assign(target, build(normalized, target.ownerId, target.id), { createdAt: target.createdAt })
  return clone(dto(target))
}

// DELETE /api/questions/:id
export async function deleteQuestion(id) {
  const target = ownedQuestion(id)
  await delay()
  if (usage(id) > 0) fail(409, 'QUESTION_IN_USE', 'This question is assigned to an exam. Remove it from the exam first.')
  questions.splice(questions.indexOf(target), 1)
  return null
}

// POST /api/questions/import  { questions: QuestionInput[] }  -> { created }
export async function importQuestions(rows) {
  const me = requireRole('EXAMINER')
  await delay(400, 800)
  const errors = []
  const accepted = []
  rows.forEach((row, index) => {
    try {
      accepted.push(normalizeQuestion(row))
    } catch (error) {
      errors.push({ row: index + 1, messages: Object.values(error.details ?? { x: error.message }) })
    }
  })
  if (errors.length > 0) fail(422, 'VALIDATION_ERROR', 'Some rows are not valid. Nothing was imported.', errors)
  const now = new Date(serverNow()).toISOString()
  for (const normalized of accepted) questions.push({ ...build(normalized, me.id), createdAt: now })
  record(me, 'QUESTIONS_IMPORTED', 'Question bank', `${accepted.length} questions imported`)
  return { created: accepted.length }
}

// --- exam papers -------------------------------------------------------------------

function examQuestionsDto(exam) {
  const items = assignedFor(exam.id).map((item) => ({ ...item, question: clone(dto(questionById(item.questionId))) }))
  const groups = new Map()
  for (const item of items) if (item.group) groups.set(item.group, [...(groups.get(item.group) ?? []), item])
  const warnings = []
  for (const [group, variants] of groups) {
    if (variants.length < 2) warnings.push(`Variant group ${group} has only one question; add an alternative or clear the group.`)
    if (new Set(variants.map((v) => v.marks)).size > 1) warnings.push(`Variants in group ${group} are worth different marks, so papers would not be equal.`)
  }
  return {
    items,
    paperMarks: paperMarks(assignedFor(exam.id)),
    examTotalMarks: exam.totalMarks,
    warnings,
    editable: examStatus(exam) === 'DRAFT',
  }
}

// GET /api/exams/:id/questions -> { items: [{ questionId, marks, group, question }], paperMarks, examTotalMarks, warnings, editable }
export async function listExamQuestions(examId) {
  const exam = ownedExam(examId)
  await delay()
  return examQuestionsDto(exam)
}

// PUT /api/exams/:id/questions  { items: [{ questionId, marks, group|null }] }   (replaces the whole list)
export async function setExamQuestions(examId, items) {
  const exam = ownedExam(examId)
  await delay()
  if (examStatus(exam) !== 'DRAFT') fail(409, 'EXAM_LOCKED', 'Questions can only be changed while the exam is a draft.')
  const seen = new Set()
  const next = items.map((item) => {
    const question = questions.find((q) => q.id === item.questionId)
    if (!question) fail(422, 'INVALID_QUESTION', 'One of the questions no longer exists.')
    if (seen.has(item.questionId)) fail(422, 'DUPLICATE_QUESTION', 'A question can only be added to an exam once.')
    seen.add(item.questionId)
    if (!(Number(item.marks) > 0)) fail(422, 'VALIDATION_ERROR', 'Every question needs marks greater than zero.')
    return { questionId: item.questionId, marks: Number(item.marks), group: item.group || null }
  })
  examQuestions.set(examId, next)
  return examQuestionsDto(exam)
}

// GET /api/exams/:id/shuffle-preview?seed=123 -> { seed, papers: [{ label, questions: [{ id, number, text, type, marks, options: [{ id, text }] }] }] }
export async function getShufflePreview(examId, seed) {
  const exam = ownedExam(examId)
  await delay(150, 300)
  if (assignedFor(examId).length === 0) fail(409, 'NO_QUESTIONS', 'Add questions to this exam first.')
  const papers = [0, 1].map((n) => {
    const random = rng(hash(`${examId}:${seed}:${n}`))
    const paper = buildPaper(examId, 'preview', random, exam.settings)
    return {
      label: `Sample paper ${String.fromCharCode(65 + n)}`,
      questions: paper.map((entry, i) => {
        const q = questionById(entry.questionId)
        return {
          id: q.id,
          number: i + 1,
          text: q.text,
          type: q.type,
          marks: entry.marks,
          options: entry.optionOrder.map((optionId) => ({ id: optionId, text: q.options.find((o) => o.id === optionId).text })),
        }
      }),
    }
  })
  return { seed, shuffleQuestions: exam.settings.shuffleQuestions, shuffleOptions: exam.settings.shuffleOptions, papers }
}
