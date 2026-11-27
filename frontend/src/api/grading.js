import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/grading'

const EXAMS_BASE = '/api/examiner/exams'

function toNumber(value) {
  if (value == null || value === '') return undefined
  const n = Number(value)
  return Number.isFinite(n) ? n : undefined
}

function adaptResultRow(result) {
  const attempt = result.attempt ?? {}
  const participant = attempt.participant ?? {}
  const total = toNumber(result.obtainedMarks)
  const max = toNumber(result.totalMarks) ?? 0
  const percent = total != null && max > 0 ? Math.round((total / max) * 100) : 0

  return {
    attemptId: attempt.id ?? result.attemptId,
    candidate: {
      id: participant.id,
      name: participant.fullName || participant.name || '',
      email: participant.email ?? '',
    },
    total: total ?? 0,
    max,
    percent,
    grade: null,
    passed: percent >= 50,
    pending: result.status === 'PENDING_REVIEW',
    version: null,
    submittedAt: attempt.submittedAt ?? null,
    incidentCount: 0,
    compensationMinutes: 0,
  }
}

function deriveReviewState(results) {
  if (!results.length) return 'NOT_READY'
  if (results.every((result) => result.status === 'PUBLISHED')) return 'PUBLISHED'
  if (results.some((result) => result.status === 'READY_TO_PUBLISH')) return 'GRADED'
  if (results.some((result) => result.status === 'PENDING_REVIEW')) return 'UNGRADED'
  return 'UNGRADED'
}

async function fetchExamResults(examId) {
  const response = await request(`${EXAMS_BASE}/${examId}/results`)
  const results = pick(response, 'results')
  return Array.isArray(results) ? results : []
}

/**
 * GET /api/examiner/exams/:examId/results → Results review DTO.
 * Backend statuses: PENDING_REVIEW | READY_TO_PUBLISH | PUBLISHED | …
 */
export const getResultsReview = async (examId) => {
  if (USE_MOCK) return mock.getResultsReview(examId)

  const results = await fetchExamResults(examId)
  const rows = results.map(adaptResultRow)
  const state = deriveReviewState(results)
  const readyCount = results.filter((result) => result.status === 'READY_TO_PUBLISH').length
  const pendingCount = results.filter((result) => result.status === 'PENDING_REVIEW').length
  const published = results.filter((result) => result.status === 'PUBLISHED' && result.publishedAt)
  const publishedAt =
    published
      .map((result) => result.publishedAt)
      .sort()
      .at(-1) ?? null

  const blockers = []
  if (state === 'NOT_READY') {
    blockers.push('No evaluated results are available yet. Run automatic evaluation first.')
  }
  if (pendingCount > 0) {
    blockers.push(
      `${pendingCount} result${pendingCount === 1 ? ' is' : 's are'} still pending review.`,
    )
  }
  if (results.length > 0 && readyCount === 0 && state !== 'PUBLISHED') {
    blockers.push('No evaluated results are ready to publish.')
  }

  return {
    state,
    canPublish: readyCount > 0,
    blockers: state === 'PUBLISHED' ? [] : [...new Set(blockers)],
    publishedAt,
    counts: {
      candidates: rows.length,
      graded: results.length - pendingCount,
      ungraded: pendingCount,
      totalMarks: rows[0]?.max ?? 0,
    },
    rows,
  }
}

function adaptGradingQueueItem(item) {
  if (!item || typeof item !== 'object') return null
  const question = item.question ?? {}
  return {
    key: item.key ?? `${item.attemptId}:${question.id}`,
    attemptId: item.attemptId,
    submissionLabel: item.submissionLabel ?? 'Submission',
    question: {
      id: question.id,
      text: question.text ?? question.questionText ?? '',
      topic: question.topic ?? '',
      maxMarks: toNumber(question.maxMarks) ?? toNumber(question.assignedMarks) ?? 0,
      modelAnswer: question.modelAnswer ?? question.markingGuide ?? '',
    },
    answerText: item.answerText ?? item.textResponse ?? '',
    score: item.score == null ? null : (toNumber(item.score) ?? null),
    feedback: item.feedback ?? '',
    gradedAt: item.gradedAt ?? null,
  }
}

/**
 * GET /api/examiner/exams/:examId/grading
 * Blind written-answer queue (no candidate names).
 */
export const getGradingQueue = async (examId) => {
  if (USE_MOCK) return mock.getGradingQueue(examId)

  const response = await request(`${EXAMS_BASE}/${examId}/grading`)
  const items = pick(response, 'items')
  const progress = pick(response, 'progress') ?? {}
  const adapted = (Array.isArray(items) ? items : []).map(adaptGradingQueueItem).filter(Boolean)

  return {
    state: response.state ?? 'NOT_READY',
    progress: {
      graded: Number(progress.graded) || adapted.filter((item) => item.score !== null).length,
      total: Number(progress.total) || adapted.length,
    },
    items: adapted,
  }
}

/**
 * PUT /api/examiner/exams/:examId/attempts/:attemptId/answers/:questionId/grade
 * Body: { score, feedback } → updated queue item.
 */
export const saveGrade = async (examId, attemptId, questionId, input) => {
  if (USE_MOCK) return mock.saveGrade(examId, attemptId, questionId, input)

  const response = await request(
    `${EXAMS_BASE}/${examId}/attempts/${attemptId}/answers/${questionId}/grade`,
    { method: 'PUT', body: input },
  )
  const item = pick(response, 'item')
  return adaptGradingQueueItem(item) ?? item
}

/**
 * PATCH /api/examiner/exams/:examId/results/publish
 * Publishes all READY_TO_PUBLISH results.
 */
export const publishResults = async (examId) => {
  if (USE_MOCK) return mock.publishResults(examId)

  const response = await request(`${EXAMS_BASE}/${examId}/results/publish`, { method: 'PATCH' })
  const data = pick(response, 'data')
  const publishedCount =
    (data && typeof data === 'object' && !Array.isArray(data) ? data.publishedCount : undefined) ??
    response?.publishedCount ??
    0

  return {
    state: 'PUBLISHED',
    publishedAt: new Date().toISOString(),
    candidates: publishedCount,
  }
}

/**
 * PATCH /api/examiner/exams/:examId/evaluate
 * Auto-scores choice questions only; written marks come from saveGrade and merge into Result totals.
 */
export const evaluateExam = async (examId) => {
  if (USE_MOCK) return mock.evaluateExam(examId)

  const response = await request(`${EXAMS_BASE}/${examId}/evaluate`, { method: 'PATCH' })
  const data = pick(response, 'data')
  const payload = data && typeof data === 'object' && !Array.isArray(data) ? data : {}
  const results = Array.isArray(payload.results) ? payload.results : []

  return {
    evaluatedAttempts: toNumber(payload.evaluatedAttempts) ?? results.length,
    results: results.map((row) => ({
      attemptId: row.attemptId,
      obtainedMarks: toNumber(row.obtainedMarks) ?? row.obtainedMarks,
      totalMarks: toNumber(row.totalMarks) ?? row.totalMarks,
      resultId: row.resultId,
    })),
  }
}
