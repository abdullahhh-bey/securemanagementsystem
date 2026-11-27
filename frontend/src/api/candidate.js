import { ApiError, USE_MOCK, pick, request } from './client'
import { formatDateTime } from '@/lib/format'
import * as mock from './mock/candidate'
import * as studentMock from './mock/student'

function toNumber(value) {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

/** Map backend exam payload to the CandidateExam shape the UI already expects. */
function normalizeExam(exam) {
  if (!exam || typeof exam !== 'object') return exam

  const questions = Array.isArray(exam.questions) ? exam.questions : []
  const marksFromQuestions = questions.reduce(
    (sum, question) => sum + (toNumber(question.assignedMarks) ?? 0),
    0,
  )
  const startAt = exam.startAt ?? exam.startsAt
  const endAt = exam.endAt ?? exam.endsAt
  const randomizeQuestions = exam.randomizeQuestions ?? exam.settings?.shuffleQuestions ?? false
  const randomizeOptions = exam.randomizeOptions ?? exam.settings?.shuffleOptions ?? false

  return {
    id: exam.id,
    title: exam.title,
    instructions: exam.instructions ?? '',
    startAt,
    endAt,
    durationMinutes: toNumber(exam.durationMinutes) ?? exam.durationMinutes,
    totalMarks: toNumber(exam.totalMarks) ?? marksFromQuestions,
    questionCount: exam.questionCount ?? exam._count?.questions ?? questions.length,
    status: exam.status,
    accessStatus: exam.accessStatus,
    resultsPublished: Boolean(exam.resultsPublished),
    enrolledAt: exam.enrolledAt,
    settings: {
      shuffleQuestions: Boolean(randomizeQuestions),
      shuffleOptions: Boolean(randomizeOptions),
      negativeMarking: Boolean(exam.settings?.negativeMarking ?? exam.negativeMarking ?? false),
    },
  }
}

function pickExamList(response) {
  const exams = pick(response, 'exams')
  return Array.isArray(exams) ? exams.map(normalizeExam) : []
}

function pickExam(response) {
  const exam = pick(response, 'exam')
  if (!exam || typeof exam !== 'object' || Array.isArray(exam) || !exam.id) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected exam payload.',
    })
  }
  return normalizeExam(exam)
}

/**
 * Backend returns the exam for any enrolled candidate (with accessStatus).
 * Detail entry in the UI still refuses UPCOMING/CLOSED the same way the mock does.
 */
function assertCanEnter(exam) {
  if (exam.accessStatus === 'UPCOMING') {
    throw new ApiError({
      code: 'EXAM_NOT_OPEN',
      message: `This exam hasn't opened yet. It opens on ${formatDateTime(exam.startAt)}.`,
      status: 403,
    })
  }
  if (exam.accessStatus === 'CLOSED') {
    throw new ApiError({
      code: 'EXAM_CLOSED',
      message: 'This exam window has closed, so you can no longer enter.',
      status: 403,
    })
  }
  return exam
}

/**
 * Candidate exam: Exam fields plus
 *   accessStatus: AVAILABLE | UPCOMING | CLOSED   <- decided by the server
 *   resultsPublished: boolean                      <- true once the examiner has published results (see api/results.js)
 */

// GET /api/candidate/exams -> CandidateExam[]
export const listCandidateExams = () =>
  USE_MOCK
    ? mock.listCandidateExams()
    : request('/api/candidate/exams').then(pickExamList)

// GET /api/candidate/exams/:id -> CandidateExam   (403 with a message when access is refused)
export const getCandidateExam = (id) =>
  USE_MOCK
    ? mock.getCandidateExam(id)
    : request(`/api/candidate/exams/${id}`).then((r) => assertCanEnter(pickExam(r)))

/** Backend returns a full ExamAttempt; Start Exam only needs id (+ status, matching mock). */
function pickAttempt(response) {
  const attempt = pick(response, 'attempt')
  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt) || !attempt.id) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected attempt payload.',
    })
  }
  return {
    id: attempt.id,
    status: attempt.status,
  }
}

// POST /api/candidate/exams/:examId/attempts -> { id, status }
export const startCandidateAttempt = (examId) =>
  USE_MOCK
    ? studentMock.startCandidateAttempt(examId)
    : request(`/api/candidate/exams/${examId}/attempts`, { method: 'POST' }).then(pickAttempt)

function normalizeWorkspaceOption(option) {
  if (!option || typeof option !== 'object') return null
  // Never pass isCorrect / marking fields through to the candidate UI.
  return {
    id: option.id,
    position: option.position,
    optionText: option.optionText ?? option.text ?? '',
  }
}

function normalizeWorkspaceAnswer(answer) {
  if (!answer || typeof answer !== 'object') return null
  return {
    textResponse: answer.textResponse ?? '',
    status: answer.status,
    isMarkedForReview: Boolean(answer.isMarkedForReview),
    selectedOptionIds: Array.isArray(answer.selectedOptionIds) ? answer.selectedOptionIds : [],
  }
}

function normalizeWorkspaceQuestion(item) {
  if (!item || typeof item !== 'object') return null
  const question = item.question ?? {}
  return {
    id: item.id,
    position: item.position,
    assignedMarks: toNumber(item.assignedMarks) ?? item.assignedMarks,
    question: {
      id: question.id,
      text: question.text ?? question.questionText ?? '',
      difficulty: question.difficulty,
      type: question.type,
    },
    options: (Array.isArray(item.options) ? item.options : []).map(normalizeWorkspaceOption).filter(Boolean),
    answer: normalizeWorkspaceAnswer(item.answer),
  }
}

/** Map backend `{ success, workspace }` to the AttemptPage workspace DTO. */
function pickWorkspace(response) {
  const workspace = pick(response, 'workspace')
  if (!workspace || typeof workspace !== 'object' || Array.isArray(workspace) || !workspace.attemptId) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected workspace payload.',
    })
  }

  const exam = workspace.exam ?? {}
  return {
    attemptId: workspace.attemptId,
    attemptNumber: workspace.attemptNumber,
    status: workspace.status,
    startedAt: workspace.startedAt,
    expiresAt: workspace.expiresAt,
    serverTime: workspace.serverTime,
    exam: {
      id: exam.id,
      title: exam.title,
      instructions: exam.instructions ?? '',
      startsAt: exam.startsAt ?? exam.startAt,
      endsAt: exam.endsAt ?? exam.endAt,
    },
    questions: (Array.isArray(workspace.questions) ? workspace.questions : [])
      .map(normalizeWorkspaceQuestion)
      .filter(Boolean),
  }
}

// GET /api/candidate/attempts/:attemptId/workspace -> workspace DTO
export const getCandidateAttemptWorkspace = (attemptId) =>
  USE_MOCK
    ? studentMock.getCandidateAttemptWorkspace(attemptId)
    : request(`/api/candidate/attempts/${attemptId}/workspace`).then(pickWorkspace)

/** Body expected by PUT …/answer and by CandidateAttemptPage.persist. */
function toSaveAnswerBody(answer = {}) {
  return {
    selectedOptionIds: Array.isArray(answer.selectedOptionIds) ? answer.selectedOptionIds : [],
    textResponse: typeof answer.textResponse === 'string' ? answer.textResponse : '',
    isMarkedForReview: Boolean(answer.isMarkedForReview),
  }
}

/** Unwrap `{ success, answer }` to the saved-answer DTO the mock returns. */
function pickSavedAnswer(response) {
  const saved = pick(response, 'answer')
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected answer payload.',
    })
  }
  return {
    status: saved.status,
    selectedOptionIds: Array.isArray(saved.selectedOptionIds) ? saved.selectedOptionIds : [],
    textResponse: saved.textResponse ?? null,
    isMarkedForReview: Boolean(saved.isMarkedForReview),
  }
}

// PUT /api/candidate/attempts/:attemptId/questions/:attemptQuestionId/answer
export const saveCandidateAnswer = (attemptId, attemptQuestionId, answer) =>
  USE_MOCK
    ? studentMock.saveCandidateAnswer(attemptId, attemptQuestionId, answer)
    : request(`/api/candidate/attempts/${attemptId}/questions/${attemptQuestionId}/answer`, {
        method: 'PUT',
        body: toSaveAnswerBody(answer),
      }).then(pickSavedAnswer)

/** Unwrap `{ success, attempt, summary }` to the submit DTO AttemptPage expects. */
function pickSubmitResult(response) {
  const attempt = pick(response, 'attempt')
  const summary = response?.summary ?? pick(response, 'summary')

  if (!attempt || typeof attempt !== 'object' || Array.isArray(attempt) || !attempt.id) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected submit payload.',
    })
  }

  const totalQuestions = toNumber(summary?.totalQuestions) ?? 0
  const answeredQuestions = toNumber(summary?.answeredQuestions) ?? 0
  const unansweredQuestions =
    toNumber(summary?.unansweredQuestions) ?? Math.max(0, totalQuestions - answeredQuestions)

  return {
    attempt: {
      id: attempt.id,
      status: attempt.status,
      submittedAt: attempt.submittedAt,
    },
    summary: {
      totalQuestions,
      answeredQuestions,
      unansweredQuestions,
    },
  }
}

// POST /api/candidate/attempts/:attemptId/submit -> { attempt, summary }
export const submitCandidateAttempt = (attemptId) =>
  USE_MOCK
    ? studentMock.submitCandidateAttempt(attemptId)
    : request(`/api/candidate/attempts/${attemptId}/submit`, { method: 'POST' }).then(pickSubmitResult)

/** Map POST …/events response → monitor-compatible event DTO `{ id, type, occurredAt, metadata }`. */
function pickAttemptEvent(response) {
  const event = pick(response, 'event')
  if (!event || typeof event !== 'object' || Array.isArray(event) || !event.id) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected event payload.',
    })
  }
  return {
    id: event.id,
    type: event.type,
    occurredAt: event.occurredAt ?? event.at ?? null,
    metadata: event.metadata ?? null,
  }
}

// POST /api/candidate/attempts/:attemptId/events  { type, metadata? }
export const reportAttemptEvent = (attemptId, { type, metadata } = {}) =>
  USE_MOCK
    ? studentMock.reportAttemptEvent(attemptId, { type, metadata })
    : request(`/api/candidate/attempts/${attemptId}/events`, {
        method: 'POST',
        body: metadata === undefined ? { type } : { type, metadata },
      }).then(pickAttemptEvent)

function normalizeResultDispute(dispute) {
  if (!dispute || typeof dispute !== 'object') return null
  return {
    id: dispute.id,
    explanation: dispute.explanation,
    status: dispute.status,
    resolution: dispute.resolution ?? null,
    createdAt: dispute.createdAt,
  }
}

/** Map a published Result row to the CandidateResults / dashboard DTO. */
function normalizeResult(result) {
  if (!result || typeof result !== 'object') return null

  // Backend already filters PUBLISHED; keep the guard for safety.
  if (result.status && result.status !== 'PUBLISHED') return null

  const attempt = result.attempt ?? {}
  const exam = attempt.exam ?? {}

  return {
    id: result.id,
    attemptId: result.attemptId ?? attempt.id,
    totalMarks: toNumber(result.totalMarks) ?? result.totalMarks,
    obtainedMarks:
      result.obtainedMarks == null ? null : (toNumber(result.obtainedMarks) ?? result.obtainedMarks),
    status: result.status,
    publishedAt: result.publishedAt,
    attempt: {
      id: attempt.id,
      attemptNumber: attempt.attemptNumber,
      submittedAt: attempt.submittedAt,
      exam: {
        id: exam.id,
        title: exam.title,
      },
    },
    disputes: (Array.isArray(result.disputes) ? result.disputes : [])
      .map(normalizeResultDispute)
      .filter(Boolean),
  }
}

function pickResultList(response) {
  const results = pick(response, 'results')
  return (Array.isArray(results) ? results : []).map(normalizeResult).filter(Boolean)
}

// GET /api/candidate/results -> published CandidateResult[]
export const listCandidateResults = () =>
  USE_MOCK
    ? studentMock.listCandidateResults()
    : request('/api/candidate/results').then(pickResultList)

function normalizeDisputeResult(result) {
  if (!result || typeof result !== 'object') return undefined
  const attempt = result.attempt ?? {}
  const exam = attempt.exam ?? {}
  return {
    id: result.id,
    totalMarks: toNumber(result.totalMarks) ?? result.totalMarks,
    obtainedMarks:
      result.obtainedMarks == null ? null : (toNumber(result.obtainedMarks) ?? result.obtainedMarks),
    status: result.status,
    attempt: {
      exam: {
        id: exam.id,
        title: exam.title,
      },
    },
  }
}

/** Map a ResultDispute (+ optional nested result) to the CandidateDisputesPage DTO. */
function normalizeDispute(dispute) {
  if (!dispute || typeof dispute !== 'object') return null
  const result = normalizeDisputeResult(dispute.result)
  return {
    id: dispute.id,
    resultId: dispute.resultId ?? result?.id,
    explanation: dispute.explanation ?? '',
    status: dispute.status,
    resolution: dispute.resolution ?? null,
    resolvedAt: dispute.resolvedAt ?? null,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    ...(result ? { result } : {}),
  }
}

function pickDisputeList(response) {
  const disputes = pick(response, 'disputes')
  return (Array.isArray(disputes) ? disputes : []).map(normalizeDispute).filter(Boolean)
}

function pickDispute(response) {
  const dispute = pick(response, 'dispute')
  const normalized = normalizeDispute(dispute)
  if (!normalized?.id) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an unexpected dispute payload.',
    })
  }
  return normalized
}

// GET /api/candidate/disputes -> CandidateDispute[]
export const listCandidateDisputes = () =>
  USE_MOCK
    ? studentMock.listCandidateDisputes()
    : request('/api/candidate/disputes').then(pickDisputeList)

// POST /api/candidate/results/:resultId/disputes { explanation } -> CandidateDispute
export const createCandidateDispute = (resultId, explanation) =>
  USE_MOCK
    ? studentMock.createCandidateDispute(resultId, { explanation })
    : request(`/api/candidate/results/${resultId}/disputes`, {
        method: 'POST',
        body: { explanation: typeof explanation === 'string' ? explanation.trim() : '' },
      }).then(pickDispute)

function normalizeAnnouncement(announcement) {
  if (!announcement || typeof announcement !== 'object') return null

  // Backend only returns published rows; skip any without a publish time.
  const publishedAt = announcement.publishedAt ?? announcement.sentAt
  if (!publishedAt) return null

  const exam = announcement.exam ?? {}
  const author = announcement.author ?? {}

  return {
    id: announcement.id,
    examId: announcement.examId ?? exam.id,
    title: announcement.title || 'Exam announcement',
    message: announcement.message ?? '',
    publishedAt,
    createdAt: announcement.createdAt ?? publishedAt,
    exam: {
      id: exam.id,
      title: exam.title,
    },
    author: {
      id: author.id,
      fullName: author.fullName ?? author.name ?? 'Exam team',
    },
  }
}

function pickAnnouncementList(response) {
  const announcements = pick(response, 'announcements')
  return (Array.isArray(announcements) ? announcements : []).map(normalizeAnnouncement).filter(Boolean)
}

// GET /api/candidate/announcements -> CandidateAnnouncement[]
export const listCandidateAnnouncements = () =>
  USE_MOCK
    ? studentMock.listCandidateAnnouncements()
    : request('/api/candidate/announcements').then(pickAnnouncementList)
