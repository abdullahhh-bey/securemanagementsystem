import { USE_MOCK, request } from './client'
import * as mock from './mock/disputes'

/**
 * Dispute: { id, examId, examTitle, attemptId, candidate: { id, name, email },
 *            category: GRADING_ERROR | AMBIGUOUS_QUESTION | TECHNICAL_INCIDENT,
 *            question: { id, number, text } | null, explanation,
 *            status: OPEN | UNDER_REVIEW | RESOLVED, outcome: UPHELD | PARTIALLY_UPHELD | REJECTED | null,
 *            resolutionReason, createdAt, updatedAt, resolvedAt|null, resolvedBy|null }
 * Status only moves forward: OPEN -> UNDER_REVIEW -> RESOLVED (409 INVALID_TRANSITION otherwise).
 */

// GET /api/exams/:id/disputes
//   -> { window: { opensAt, closesAt, isOpen } | null, counts: { open, underReview, resolved }, items: Dispute[] }
export const listDisputes = (examId) => (USE_MOCK ? mock.listDisputes(examId) : request(`/api/exams/${examId}/disputes`))

// POST /api/exams/:id/disputes/:disputeId/review -> Dispute          (OPEN -> UNDER_REVIEW)
export const startDisputeReview = (examId, disputeId) =>
  USE_MOCK ? mock.startDisputeReview(examId, disputeId) : request(`/api/exams/${examId}/disputes/${disputeId}/review`, { method: 'POST' })

// GET /api/exams/:id/disputes/:disputeId/impact?outcome=UPHELD|PARTIALLY_UPHELD|REJECTED
//   -> { outcome, scope: ALL_CANDIDATES | DISPUTING_CANDIDATE | NONE, changedCount, summary: "14 candidates will change",
//        changes: [{ attemptId, candidateId, name, before, after, max, questionBefore, questionAfter }] }
// Read-only: shows what resolving would do without changing anything.
export const previewDisputeImpact = (examId, disputeId, outcome) =>
  USE_MOCK
    ? mock.previewDisputeImpact(examId, disputeId, outcome)
    : request(`/api/exams/${examId}/disputes/${disputeId}/impact`, { params: { outcome } })

// POST /api/exams/:id/disputes/:disputeId/resolve  { outcome, reason (>= 15 chars, required) } -> { dispute, changedCount }
// Rescoring never overwrites: each affected attempt gets a NEW score version (v2, v3...). v1 stays as published.
export const resolveDispute = (examId, disputeId, input) =>
  USE_MOCK ? mock.resolveDispute(examId, disputeId, input) : request(`/api/exams/${examId}/disputes/${disputeId}/resolve`, { method: 'POST', body: input })

// GET /api/exams/:id/attempts/:attemptId/score-history
//   -> { candidate: { id, name }, versions: [{ version, createdAt, reason, total, max, delta, isCurrent }] }   (oldest first)
export const getScoreHistory = (examId, attemptId) =>
  USE_MOCK ? mock.getScoreHistory(examId, attemptId) : request(`/api/exams/${examId}/attempts/${attemptId}/score-history`)

// POST /api/candidate/exams/:id/disputes  { category, questionId?, explanation (>= 20 chars) } -> Dispute
// Only while the dispute window is open (403 DISPUTE_WINDOW_CLOSED afterwards). questionId is required unless category is TECHNICAL_INCIDENT.
export const createDispute = (examId, input) =>
  USE_MOCK ? mock.createDispute(examId, input) : request(`/api/candidate/exams/${examId}/disputes`, { method: 'POST', body: input })
