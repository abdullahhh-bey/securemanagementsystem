import { ApiError, pick, request } from './client'
import { getExam } from './exams'
import { mapQuestionToApi, normalizeQuestion } from '@/lib/schema'

/**
 * Aligns with prisma Question + QuestionVersion.
 * Real list/create traffic uses /api/examiner/questions.
 * Exam assignments use /api/examiner/exams/:examId/questions (POST/DELETE).
 * There is no GET …/questions; assigned list is derived from GET exam by id.
 */

const QUESTIONS_BASE = '/api/examiner/questions'
const EXAMS_BASE = '/api/examiner/exams'

/** Flatten Question + latest QuestionVersion (+ category) into the bank UI DTO. */
function adaptQuestion(raw) {
  if (!raw || typeof raw !== 'object') return null

  const versions = Array.isArray(raw.versions) ? raw.versions : null
  const latest = versions?.length
    ? [...versions].sort((a, b) => (b.versionNumber ?? 0) - (a.versionNumber ?? 0))[0]
    : null
  const version = latest ?? raw
  const category = raw.category && typeof raw.category === 'object' ? raw.category : null

  const flat = {
    id: raw.id,
    authorId: raw.authorId,
    ownerId: raw.authorId ?? raw.ownerId,
    categoryId: raw.categoryId ?? category?.id ?? null,
    category: category ? { id: category.id, name: category.name } : undefined,
    // Bank UI filters on `topic`; map category name when the backend has no topic field.
    topic: raw.topic ?? category?.name ?? '',
    isActive: raw.isActive,
    createdAt: raw.createdAt ?? version.createdAt,
    updatedAt: raw.updatedAt,
    type: version.type,
    difficulty: version.difficulty,
    questionText: version.questionText ?? version.text,
    text: version.questionText ?? version.text,
    defaultMarks: Number(version.defaultMarks),
    markingGuide: version.markingGuide ?? '',
    modelAnswer: version.modelAnswer ?? version.markingGuide ?? '',
    options: Array.isArray(version.options) ? version.options : [],
    versionId: latest ? latest.id : undefined,
    versionNumber: version.versionNumber,
  }

  return normalizeQuestion(flat)
}

function pickQuestion(response) {
  const question = pick(response, 'question')
  const adapted = adaptQuestion(question)
  if (!adapted?.id) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected question payload.',
    })
  }
  return adapted
}

function pickQuestionList(response) {
  const questions = pick(response, 'questions')
  return (Array.isArray(questions) ? questions : []).map(adaptQuestion).filter(Boolean)
}

/** Body accepted by POST /api/examiner/questions. */
function toQuestionWriteBody(input) {
  const mapped = mapQuestionToApi(input)
  const type = mapped.type
  const body = {
    questionText: mapped.questionText,
    difficulty: mapped.difficulty,
    type,
    defaultMarks: mapped.defaultMarks,
    markingGuide: mapped.markingGuide ? mapped.markingGuide : null,
  }
  if (mapped.categoryId) body.categoryId = mapped.categoryId
  if (type === 'WRITTEN') {
    body.options = []
  } else {
    body.options = (mapped.options ?? []).map((option) => ({
      optionText: option.optionText,
      isCorrect: Boolean(option.isCorrect),
    }))
  }
  return body
}

// GET /api/examiner/questions -> Question[]
export const listQuestions = () =>
  request(QUESTIONS_BASE).then(pickQuestionList)

// POST /api/examiner/questions -> Question
export const createQuestion = (input) => {
  return request(QUESTIONS_BASE, { method: 'POST', body: toQuestionWriteBody(input) }).then(pickQuestion)
}

/**
 * QuestionFormDialog calls update with `{ id, input: payload }`; the hook spreads to
 * `updateQuestion(id, { input: payload })`. Accept either a flat payload or `{ input }`.
 */
function resolveQuestionInput(input) {
  if (
    input &&
    typeof input === 'object' &&
    input.input &&
    typeof input.input === 'object' &&
    input.type === undefined &&
    input.text === undefined &&
    input.questionText === undefined
  ) {
    return input.input
  }
  return input
}

/**
 * Backend has no PATCH question. Edits create a new version:
 * POST /api/examiner/questions/:questionId/versions
 * then refetch GET /api/examiner/questions/:questionId for the bank DTO.
 */
export const updateQuestion = async (id, input) => {
  const payload = resolveQuestionInput(input)

  await request(`${QUESTIONS_BASE}/${id}/versions`, {
    method: 'POST',
    body: toQuestionWriteBody(payload),
  })
  return request(`${QUESTIONS_BASE}/${id}`).then(pickQuestion)
}

// DELETE /api/examiner/questions/:questionId
// Hard-deletes when unused; soft-deactivates (isActive=false) when assigned or used in attempts.
export const deleteQuestion = async (id) => {
  await request(`${QUESTIONS_BASE}/${id}`, { method: 'DELETE' })
  return null
}

// POST /api/questions/import  { questions: QuestionInput[] } -> { created }
export const importQuestions = async (rows) => {
  let created = 0
  for (const question of rows) {
    try {
      await createQuestion(question)
      created += 1
    } catch (error) {
      if (created === 0) throw error
      throw new ApiError({
        code: 'PARTIAL_IMPORT',
        message: `Imported ${created} of ${rows.length} questions before the next row failed: ${error.message}`,
        status: error.status,
      })
    }
  }
  return { created }
}

/** Map ExamQuestion + questionVersion (from getExam) to the AssignedQuestions draft item. */
function adaptExamQuestionItem(examQuestion) {
  if (!examQuestion || typeof examQuestion !== 'object') return null
  const version = examQuestion.questionVersion
  if (!version || typeof version !== 'object') return null

  const questionId = version.questionId
  if (!questionId) return null

  const question = normalizeQuestion({
    id: questionId,
    versionId: version.id,
    type: version.type,
    difficulty: version.difficulty,
    questionText: version.questionText,
    text: version.questionText,
    defaultMarks: Number(version.defaultMarks),
    markingGuide: version.markingGuide ?? '',
    modelAnswer: version.markingGuide ?? '',
    options: Array.isArray(version.options) ? version.options : [],
    topic: '',
  })

  const marks = Number(examQuestion.assignedMarks)
  return {
    examQuestionId: examQuestion.id,
    questionId,
    questionVersionId: version.id,
    marks: Number.isFinite(marks) ? marks : Number(version.defaultMarks) || 0,
    position: examQuestion.position,
    group: null,
    question,
  }
}

function toExamQuestionsDto(exam) {
  const items = (Array.isArray(exam?.questions) ? exam.questions : [])
    .map(adaptExamQuestionItem)
    .filter(Boolean)
  const paperMarks = items.reduce((sum, item) => sum + Number(item.marks || 0), 0)
  return {
    items,
    paperMarks,
    examTotalMarks: Number(exam?.totalMarks) || paperMarks,
    warnings: [],
    editable: exam?.status === 'DRAFT',
  }
}

// Assigned list: no GET …/questions — use GET /api/examiner/exams/:examId (includes questions).
export const listExamQuestions = async (examId) => {
  const exam = await getExam(examId)
  return toExamQuestionsDto(exam)
}

async function assignExamQuestion(examId, { questionVersionId, assignedMarks }) {
  return request(`${EXAMS_BASE}/${examId}/questions`, {
    method: 'POST',
    body: {
      questionVersionId,
      assignedMarks: Number(assignedMarks),
    },
  })
}

async function removeExamQuestionAssignment(examId, examQuestionId) {
  return request(`${EXAMS_BASE}/${examId}/questions/${examQuestionId}`, { method: 'DELETE' })
}

/**
 * UI saves a full draft list. Backend only has single assign/remove, so replace by
 * deleting current assignments then assigning each draft item in order.
 */
export const setExamQuestions = async (examId, items) => {
  const current = await listExamQuestions(examId)
  for (const item of current.items) {
    if (item.examQuestionId) {
      await removeExamQuestionAssignment(examId, item.examQuestionId)
    }
  }

  const bank = await listQuestions()
  const versionByQuestionId = new Map(bank.map((question) => [question.id, question.versionId]))

  for (const item of items ?? []) {
    const questionVersionId = versionByQuestionId.get(item.questionId)
    if (!questionVersionId) {
      throw new ApiError({
        code: 'INVALID_QUESTION',
        message: 'One of the questions is missing a version and cannot be assigned.',
      })
    }
    await assignExamQuestion(examId, {
      questionVersionId,
      assignedMarks: Number(item.marks),
    })
  }

  return listExamQuestions(examId)
}

