import { exams, nextId, requireRole, users } from './db'
import { record } from './audit'
import { currentScore, disputes, maxMarks, publishedAt, realAttempts, round2, sumMarks } from './examData'
import { ownedExam } from './exams'
import { clone, delay, fail, serverNow } from './helpers'
import { disputeDto, disputeWindow } from './results'

const CATEGORIES = ['GRADING_ERROR', 'AMBIGUOUS_QUESTION', 'TECHNICAL_INCIDENT']
const OUTCOMES = ['UPHELD', 'PARTIALLY_UPHELD', 'REJECTED']

const personName = (id) => users.find((u) => u.id === id)?.name ?? 'Unknown'

function examDisputes(examId) {
  return disputes.filter((d) => d.examId === examId)
}

/**
 * Who would be rescored, and to what, if the dispute were resolved with `outcome`:
 *  - ambiguous question  -> every candidate who has that question on their paper
 *  - grading error       -> only the candidate who raised the dispute
 *  - technical incident  -> no marks change (use compensation instead)
 *  - rejected            -> nobody
 */
function computeChanges(dispute, outcome) {
  if (outcome === 'REJECTED' || !dispute.questionId || dispute.category === 'TECHNICAL_INCIDENT') return []
  const pool = dispute.category === 'AMBIGUOUS_QUESTION' ? realAttempts(dispute.examId).filter((a) => a.status === 'SUBMITTED') : realAttempts(dispute.examId).filter((a) => a.id === dispute.attemptId)
  const changes = []
  for (const attempt of pool) {
    const entry = attempt.paper.find((p) => p.questionId === dispute.questionId)
    if (!entry) continue
    const score = currentScore(attempt)
    const before = score.perQuestion[dispute.questionId] ?? 0
    const after = outcome === 'UPHELD' ? entry.marks : round2(before + (entry.marks - before) / 2)
    if (after <= before) continue
    const afterPerQuestion = { ...score.perQuestion, [dispute.questionId]: after }
    changes.push({
      attemptId: attempt.id,
      candidateId: attempt.candidateId,
      name: personName(attempt.candidateId),
      before: score.total,
      after: Math.max(0, sumMarks(afterPerQuestion)),
      max: maxMarks(attempt),
      questionBefore: before,
      questionAfter: after,
      afterPerQuestion,
    })
  }
  return changes
}

function findDispute(examId, disputeId) {
  ownedExam(examId)
  const found = examDisputes(examId).find((d) => d.id === disputeId)
  if (!found) fail(404, 'NOT_FOUND', 'That dispute was not found.')
  return found
}

// GET /api/exams/:id/disputes
//   -> { window: { opensAt, closesAt, isOpen } | null, counts: { open, underReview, resolved }, items: [Dispute] }
// Dispute: { id, examId, attemptId, candidate, category: GRADING_ERROR | AMBIGUOUS_QUESTION | TECHNICAL_INCIDENT,
//            question: { id, number, text } | null, explanation, status: OPEN | UNDER_REVIEW | RESOLVED,
//            outcome: UPHELD | PARTIALLY_UPHELD | REJECTED | null, resolutionReason, createdAt, updatedAt, resolvedAt, resolvedBy }
export async function listDisputes(examId) {
  ownedExam(examId)
  await delay()
  const items = examDisputes(examId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  return clone({
    window: disputeWindow(examId),
    counts: {
      open: items.filter((d) => d.status === 'OPEN').length,
      underReview: items.filter((d) => d.status === 'UNDER_REVIEW').length,
      resolved: items.filter((d) => d.status === 'RESOLVED').length,
    },
    items: items.map(disputeDto),
  })
}

// POST /api/exams/:id/disputes/:disputeId/review -> Dispute          (OPEN -> UNDER_REVIEW)
export async function startDisputeReview(examId, disputeId) {
  const me = requireRole('EXAMINER')
  const dispute = findDispute(examId, disputeId)
  await delay()
  if (dispute.status !== 'OPEN') fail(409, 'INVALID_TRANSITION', 'Only open disputes can be moved to review.')
  dispute.status = 'UNDER_REVIEW'
  dispute.updatedAt = new Date(serverNow()).toISOString()
  record(me, 'DISPUTE_REVIEW_STARTED', ownedExam(examId).title, `Dispute from ${personName(dispute.candidateId)} moved to under review`)
  return clone(disputeDto(dispute))
}

// GET /api/exams/:id/disputes/:disputeId/impact?outcome=UPHELD|PARTIALLY_UPHELD|REJECTED
//   -> { outcome, scope: ALL_CANDIDATES | DISPUTING_CANDIDATE | NONE, changedCount, summary: "14 candidates will change",
//        changes: [{ attemptId, candidateId, name, before, after, max }] }
export async function previewDisputeImpact(examId, disputeId, outcome) {
  const dispute = findDispute(examId, disputeId)
  await delay(150, 300)
  if (!OUTCOMES.includes(outcome)) fail(422, 'VALIDATION_ERROR', 'Choose an outcome.')
  const changes = computeChanges(dispute, outcome)
  const scope = changes.length === 0 ? 'NONE' : dispute.category === 'AMBIGUOUS_QUESTION' ? 'ALL_CANDIDATES' : 'DISPUTING_CANDIDATE'
  return clone({
    outcome,
    scope,
    changedCount: changes.length,
    summary: changes.length === 0 ? 'No scores will change' : `${changes.length} candidate${changes.length === 1 ? '' : 's'} will change`,
    changes: changes.map(({ afterPerQuestion: _unused, ...rest }) => rest),
  })
}

// POST /api/exams/:id/disputes/:disputeId/resolve  { outcome, reason } -> { dispute, changedCount }
// Never overwrites: every affected attempt gets a NEW score version (v2, v3 ...) that references this dispute.
export async function resolveDispute(examId, disputeId, { outcome, reason }) {
  const me = requireRole('EXAMINER')
  const exam = ownedExam(examId)
  const dispute = findDispute(examId, disputeId)
  await delay(400, 800)
  if (!OUTCOMES.includes(outcome)) fail(422, 'VALIDATION_ERROR', 'Choose an outcome.', { outcome: 'Choose an outcome.' })
  if (String(reason ?? '').trim().length < 15) {
    fail(422, 'VALIDATION_ERROR', 'Explain your decision in at least 15 characters. The candidate will see it.', { reason: 'Explain your decision in at least 15 characters. The candidate will see it.' })
  }
  if (dispute.status !== 'UNDER_REVIEW') fail(409, 'INVALID_TRANSITION', 'Move the dispute to review before resolving it.')
  const changes = computeChanges(dispute, outcome)
  const when = new Date(serverNow()).toISOString()
  for (const change of changes) {
    const attempt = realAttempts(examId).find((a) => a.id === change.attemptId)
    const latest = attempt.versions.at(-1)
    attempt.versions.push({
      version: (latest?.version ?? 0) + 1,
      createdAt: when,
      reason: `Dispute ${dispute.id} ${outcome === 'UPHELD' ? 'upheld' : 'partially upheld'}: ${reason.trim()}`,
      perQuestion: change.afterPerQuestion,
      total: change.after,
    })
  }
  Object.assign(dispute, { status: 'RESOLVED', outcome, resolutionReason: reason.trim(), resolvedAt: when, updatedAt: when, resolvedById: me.id })
  record(me, 'DISPUTE_RESOLVED', exam.title, `${outcome.replace('_', ' ').toLowerCase()}: ${changes.length} score${changes.length === 1 ? '' : 's'} revised`)
  return clone({ dispute: disputeDto(dispute), changedCount: changes.length })
}

// GET /api/exams/:id/attempts/:attemptId/score-history
//   -> { candidate, versions: [{ version, createdAt, reason, total, max, delta, isCurrent }] }     (oldest first; v1 is never altered)
export async function getScoreHistory(examId, attemptId) {
  ownedExam(examId)
  await delay(150, 300)
  const attempt = realAttempts(examId).find((a) => a.id === attemptId)
  if (!attempt || !publishedAt.has(examId)) fail(404, 'NOT_FOUND', 'No published score history exists for that attempt yet.')
  const max = maxMarks(attempt)
  return clone({
    candidate: { id: attempt.candidateId, name: personName(attempt.candidateId) },
    versions: attempt.versions.map((v, i, all) => ({
      version: v.version,
      createdAt: v.createdAt,
      reason: v.reason,
      total: v.total,
      max,
      delta: i === 0 ? 0 : round2(v.total - all[i - 1].total),
      isCurrent: i === all.length - 1,
    })),
  })
}

// POST /api/candidate/exams/:id/disputes  { category, questionId?, explanation } -> Dispute
// Only while the dispute window is open (7 days after results are published).
export async function createDispute(examId, { category, questionId, explanation }) {
  const me = requireRole('CANDIDATE')
  await delay(300, 600)
  const exam = exams.find((e) => e.id === examId)
  const attempt = realAttempts(examId).find((a) => a.candidateId === me.id && a.status === 'SUBMITTED')
  if (!exam || !attempt || !publishedAt.has(examId)) fail(404, 'NOT_FOUND', "We couldn't find a published result for that exam.")
  if (!disputeWindow(examId)?.isOpen) fail(403, 'DISPUTE_WINDOW_CLOSED', 'The dispute window for this exam has closed.')
  const details = {}
  if (!CATEGORIES.includes(category)) details.category = 'Choose what your dispute is about.'
  if (category !== 'TECHNICAL_INCIDENT' && !questionId) details.questionId = 'Choose the question this is about.'
  if (questionId && !attempt.paper.some((p) => p.questionId === questionId)) details.questionId = 'That question is not on your paper.'
  if (String(explanation ?? '').trim().length < 20) details.explanation = 'Explain the problem in at least 20 characters so the examiner can act on it.'
  if (Object.keys(details).length > 0) fail(422, 'VALIDATION_ERROR', 'Your dispute could not be submitted.', details)
  if (disputes.some((d) => d.examId === examId && d.candidateId === me.id && d.category === category && (d.questionId ?? null) === (questionId ?? null) && d.status !== 'RESOLVED')) {
    fail(409, 'DUPLICATE_DISPUTE', 'You already have an open dispute for this.')
  }
  const now = new Date(serverNow()).toISOString()
  const created = { id: nextId('dsp'), examId, attemptId: attempt.id, candidateId: me.id, category, questionId: questionId ?? null, explanation: explanation.trim(), status: 'OPEN', outcome: null, resolutionReason: '', createdAt: now, updatedAt: now, resolvedAt: null, resolvedById: null }
  disputes.push(created)
  record(me, 'DISPUTE_RAISED', exam.title, category.replace('_', ' ').toLowerCase())
  return clone(disputeDto(created))
}
