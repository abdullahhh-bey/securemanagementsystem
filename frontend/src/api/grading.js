import { USE_MOCK, request } from './client'
import * as mock from './mock/grading'

// GET /api/exams/:id/grading
//   -> { state: NOT_READY | UNGRADED | GRADED | PUBLISHED, progress: { graded, total },
//        items: [{ key, attemptId, submissionLabel, question: { id, text, topic, maxMarks, modelAnswer }, answerText,
//                  score|null, feedback, gradedAt|null }] }
// Blind marking: the payload contains no candidate names.
export const getGradingQueue = (examId) => (USE_MOCK ? mock.getGradingQueue(examId) : request(`/api/exams/${examId}/grading`))

// PUT /api/exams/:id/attempts/:attemptId/answers/:questionId/grade  { score: number 0..maxMarks, feedback?: string } -> queue item
// 422 with details.score when out of range; 409 RESULTS_PUBLISHED once results are out.
export const saveGrade = (examId, attemptId, questionId, input) =>
  USE_MOCK
    ? mock.saveGrade(examId, attemptId, questionId, input)
    : request(`/api/exams/${examId}/attempts/${attemptId}/answers/${questionId}/grade`, { method: 'PUT', body: input })

// GET /api/exams/:id/results/review
//   -> { state, canPublish, blockers: string[], publishedAt|null, counts: { candidates, graded, ungraded, totalMarks }, rows: ResultRow[] }
// ResultRow: { attemptId, candidate: { id, name, email }, total, max, percent, grade, passed, pending, version|null,
//              submittedAt, incidentCount, compensationMinutes }
export const getResultsReview = (examId) => (USE_MOCK ? mock.getResultsReview(examId) : request(`/api/exams/${examId}/results/review`))

// POST /api/exams/:id/results/publish -> { state: "PUBLISHED", publishedAt, candidates }
// 409 NOT_GRADED while written answers are ungraded. Creates score version 1 for each attempt.
export const publishResults = (examId) =>
  USE_MOCK ? mock.publishResults(examId) : request(`/api/exams/${examId}/results/publish`, { method: 'POST' })
