import { ApiError, USE_MOCK, pick, request } from './client'
import { normalizeExam } from '@/lib/schema'
import * as mock from './mock/exams'

/**
 * Aligns with prisma `Exam` (+ UI helpers).
 * Real traffic uses /api/examiner/exams (mounted on the examiner router).
 */

const EXAMS_BASE = '/api/examiner/exams'

function toNumber(value) {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Body fields accepted by create/update exam controllers. */
function toExamWriteBody(input = {}) {
  const startsAt = input.startsAt ?? input.startAt
  const endsAt = input.endsAt ?? input.endAt
  const durationMinutes = toNumber(input.durationMinutes)
  const maxAttempts = toNumber(input.maxAttempts)

  return {
    title: input.title,
    description: input.description ?? null,
    instructions: input.instructions ?? null,
    startsAt,
    endsAt,
    durationMinutes: durationMinutes != null ? Math.round(durationMinutes) : undefined,
    maxAttempts: maxAttempts != null ? Math.round(maxAttempts) : 1,
    randomizeQuestions: Boolean(input.randomizeQuestions ?? input.settings?.shuffleQuestions),
    randomizeOptions: Boolean(input.randomizeOptions ?? input.settings?.shuffleOptions),
  }
}

/** Enrich backend exam rows for list/detail UI (counts, marks aliases). */
function adaptExam(raw) {
  if (!raw || typeof raw !== 'object') return null
  const exam = normalizeExam(raw)
  if (!exam) return null

  const questions = Array.isArray(raw.questions) ? raw.questions : []
  const marksFromQuestions = questions.reduce(
    (sum, question) => sum + (toNumber(question.assignedMarks) ?? 0),
    0,
  )
  const questionCount = exam.questionCount ?? raw._count?.questions ?? questions.length
  const candidateCount = exam.candidateCount ?? raw._count?.enrollments ?? 0
  const totalMarks = toNumber(exam.totalMarks) ?? (questions.length ? marksFromQuestions : undefined)

  return {
    ...exam,
    questionCount,
    candidateCount,
    totalMarks: totalMarks ?? exam.totalMarks ?? 0,
  }
}

function pickExam(response) {
  const exam = pick(response, 'exam')
  const adapted = adaptExam(exam)
  if (!adapted?.id) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected exam payload.',
    })
  }
  return adapted
}

function pickExamList(response) {
  const exams = pick(response, 'exams')
  return (Array.isArray(exams) ? exams : []).map(adaptExam).filter(Boolean)
}

const one = async (promise) => {
  const raw = await promise
  return adaptExam(raw) ?? normalizeExam(raw)
}
const many = async (promise) => {
  const list = await promise
  return (Array.isArray(list) ? list : []).map((exam) => adaptExam(exam) ?? normalizeExam(exam)).filter(Boolean)
}

// GET /api/examiner/exams -> Exam[]
export const listExams = () =>
  USE_MOCK ? many(mock.listExams()) : request(EXAMS_BASE).then(pickExamList)

// GET /api/examiner/exams/:examId -> Exam
export const getExam = (id) =>
  USE_MOCK ? one(mock.getExam(id)) : request(`${EXAMS_BASE}/${id}`).then(pickExam)

// POST /api/examiner/exams -> Exam
export const createExam = (input) =>
  USE_MOCK
    ? one(mock.createExam(input))
    : request(EXAMS_BASE, { method: 'POST', body: toExamWriteBody(input) }).then(pickExam)

// PUT /api/examiner/exams/:examId -> Exam
export const updateExam = (id, input) =>
  USE_MOCK
    ? one(mock.updateExam(id, input))
    : request(`${EXAMS_BASE}/${id}`, { method: 'PUT', body: toExamWriteBody(input) }).then(pickExam)

// DELETE /api/examiner/exams/:examId
export const deleteExam = (id) =>
  USE_MOCK ? mock.deleteExam(id) : request(`${EXAMS_BASE}/${id}`, { method: 'DELETE' })

// PATCH /api/examiner/exams/:examId/publish -> Exam
export const publishExam = (id) =>
  USE_MOCK
    ? one(mock.publishExam(id))
    : request(`${EXAMS_BASE}/${id}/publish`, { method: 'PATCH' }).then(pickExam)

function normalizePersonName(user) {
  if (!user || typeof user !== 'object') return ''
  return user.fullName || user.name || ''
}

/** Enrollment row → enrolled-candidate DTO used by CandidatesTab / review. */
function normalizeEnrolledCandidate(enrollment) {
  if (!enrollment || typeof enrollment !== 'object') return null
  const candidate = enrollment.candidate ?? enrollment
  const candidateId = candidate.id ?? enrollment.candidateId
  if (!candidateId) return null
  return {
    id: candidateId,
    enrollmentId: enrollment.id ?? enrollment.enrollmentId,
    name: normalizePersonName(candidate),
    email: candidate.email ?? '',
    enrolledAt: enrollment.enrolledAt,
    status: enrollment.status,
  }
}

function normalizeAvailableCandidate(user) {
  if (!user || typeof user !== 'object' || !user.id) return null
  return {
    id: user.id,
    name: normalizePersonName(user),
    email: user.email ?? '',
  }
}

function pickEnrollmentList(response) {
  // Backend: `{ success, data: Enrollment[] }` — pick falls back to `data`.
  const rows = pick(response, 'enrollments')
  return (Array.isArray(rows) ? rows : []).map(normalizeEnrolledCandidate).filter(Boolean)
}

function pickCandidateUserList(response) {
  // Backend: `{ success, data: User[] }` — pick falls back to `data`.
  const rows = pick(response, 'candidates')
  return (Array.isArray(rows) ? rows : []).map(normalizeAvailableCandidate).filter(Boolean)
}

// GET /api/examiner/exams/:examId/enrollments -> enrolled candidate DTOs
export const listExamCandidates = (id) =>
  USE_MOCK
    ? mock.listExamCandidates(id)
    : request(`${EXAMS_BASE}/${id}/enrollments`).then(pickEnrollmentList)

// GET /api/examiner/candidates, minus those already enrolled in this exam
export const listAvailableCandidates = async (id) => {
  if (USE_MOCK) return mock.listAvailableCandidates(id)
  const [allCandidates, enrolled] = await Promise.all([
    request('/api/examiner/candidates').then(pickCandidateUserList),
    listExamCandidates(id),
  ])
  const enrolledIds = new Set(enrolled.map((candidate) => candidate.id))
  return allCandidates.filter((candidate) => !enrolledIds.has(candidate.id))
}

// POST /api/examiner/exams/:examId/enrollments { candidateId } (once per selected id)
export const enrollCandidates = async (id, candidateIds) => {
  if (USE_MOCK) return mock.enrollCandidates(id, candidateIds)
  const ids = Array.isArray(candidateIds) ? candidateIds : []
  for (const candidateId of ids) {
    await request(`${EXAMS_BASE}/${id}/enrollments`, {
      method: 'POST',
      body: { candidateId },
    })
  }
  return { enrolled: ids.length }
}

// PATCH /api/examiner/exams/:examId/enrollments/:enrollmentId/withdraw
// Real mode expects enrollmentId; mock mode still keys by candidate id.
export const removeExamCandidate = (id, enrollmentOrCandidateId) =>
  USE_MOCK
    ? mock.removeExamCandidate(id, enrollmentOrCandidateId)
    : request(`${EXAMS_BASE}/${id}/enrollments/${enrollmentOrCandidateId}/withdraw`, {
        method: 'PATCH',
      })
