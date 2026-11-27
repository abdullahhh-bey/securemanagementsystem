import { ApiError, pick, request } from './client'

function normalizeDispute(dispute) {
  if (!dispute || typeof dispute !== 'object' || !dispute.id) return null
  const result = dispute.result ?? {}
  const attempt = result.attempt ?? {}
  const exam = attempt.exam ?? {}
  const candidate = attempt.participant ?? dispute.openedBy ?? {}

  return {
    id: dispute.id,
    resultId: result.id ?? dispute.resultId,
    attemptId: attempt.id,
    examId: exam.id,
    examTitle: exam.title ?? 'Exam',
    candidate: {
      id: candidate.id,
      name: candidate.fullName ?? candidate.name ?? 'Candidate',
      email: candidate.email ?? '',
    },
    explanation: dispute.explanation ?? '',
    status: dispute.status,
    resolution: dispute.resolution ?? null,
    createdAt: dispute.createdAt,
    updatedAt: dispute.updatedAt,
    resolvedAt: dispute.resolvedAt ?? null,
  }
}

export async function listDisputes(examId) {
  const response = await request('/api/examiner/disputes')
  const rows = pick(response, 'data')
  if (!Array.isArray(rows)) {
    throw new ApiError({
      code: 'BAD_RESPONSE',
      message: 'The server returned an invalid dispute list.',
      status: 502,
    })
  }
  return rows.map(normalizeDispute).filter((dispute) => dispute && (!examId || dispute.examId === examId))
}

export async function startDisputeReview(disputeId) {
  const response = await request(`/api/examiner/disputes/${disputeId}`, {
    method: 'PATCH',
    body: { status: 'UNDER_REVIEW' },
  })
  return normalizeDispute(pick(response, 'data'))
}

export async function updateDispute(disputeId, { status, resolution }) {
  const response = await request(`/api/examiner/disputes/${disputeId}`, {
    method: 'PATCH',
    body: { status, resolution: resolution.trim() },
  })
  return normalizeDispute(pick(response, 'data'))
}

