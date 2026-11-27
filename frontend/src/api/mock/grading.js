import { examStatus, requireRole } from './db'
import { record } from './audit'
import { assignedFor, currentScore, publishedAt, questionById, realAttempts, resultsState } from './examData'
import { ownedExam } from './exams'
import { clone, delay, fail, serverNow } from './helpers'
import { resultRows } from './results'

const submitted = (examId) => realAttempts(examId).filter((a) => a.status === 'SUBMITTED')

function queueItems(examId) {
  const attempts = submitted(examId)
  const items = []
  for (const q of assignedFor(examId).map((i) => questionById(i.questionId)).filter((q) => q.type === 'WRITTEN')) {
    attempts.forEach((attempt, index) => {
      const entry = attempt.paper.find((p) => p.questionId === q.id)
      const answer = attempt.answers[q.id]
      if (!entry || !answer?.text?.trim()) return // not on this paper, or left blank (auto 0)
      const grade = attempt.written[q.id]
      items.push({
        key: `${attempt.id}:${q.id}`,
        attemptId: attempt.id,
        submissionLabel: `Submission ${index + 1}`, // names are hidden while marking
        question: { id: q.id, text: q.text, topic: q.topic, maxMarks: entry.marks, modelAnswer: q.modelAnswer },
        answerText: answer.text,
        score: grade ? grade.score : null,
        feedback: grade?.feedback ?? '',
        gradedAt: grade?.gradedAt ?? null,
      })
    })
  }
  return items
}

// GET /api/exams/:id/grading
//   -> { state: NOT_READY | UNGRADED | GRADED | PUBLISHED, progress: { graded, total },
//        items: [{ key, attemptId, submissionLabel, question: { id, text, topic, maxMarks, modelAnswer }, answerText, score|null, feedback, gradedAt|null }] }
// Candidate names are deliberately not part of this payload (blind marking).
export async function getGradingQueue(examId) {
  const exam = ownedExam(examId)
  await delay()
  const items = queueItems(examId)
  return clone({
    state: resultsState(exam, examStatus(exam)),
    progress: { graded: items.filter((i) => i.score !== null).length, total: items.length },
    items,
  })
}

// PUT /api/exams/:id/attempts/:attemptId/answers/:questionId/grade  { score, feedback } -> the updated queue item
export async function saveGrade(examId, attemptId, questionId, { score, feedback }) {
  const me = requireRole('EXAMINER')
  const exam = ownedExam(examId)
  await delay(200, 420)
  if (publishedAt.has(examId)) {
    fail(409, 'RESULTS_PUBLISHED', 'Results are already published. Changes now go through a dispute resolution, which creates a new score version.')
  }
  const attempt = submitted(examId).find((a) => a.id === attemptId)
  const entry = attempt?.paper.find((p) => p.questionId === questionId)
  if (!entry || questionById(questionId).type !== 'WRITTEN') fail(404, 'NOT_FOUND', 'That answer was not found.')
  const value = Number(score)
  if (score === '' || score === null || score === undefined || Number.isNaN(value)) {
    fail(422, 'VALIDATION_ERROR', 'Enter a score.', { score: 'Enter a score.' })
  }
  if (value < 0 || value > entry.marks) {
    fail(422, 'VALIDATION_ERROR', `The score must be between 0 and ${entry.marks}.`, { score: `The score must be between 0 and ${entry.marks}.` })
  }
  attempt.written[questionId] = { score: value, feedback: String(feedback ?? '').trim(), gradedAt: new Date(serverNow()).toISOString() }
  record(me, 'GRADE_SAVED', exam.title, `Written answer scored ${value}/${entry.marks}`)
  return clone(queueItems(examId).find((i) => i.key === `${attemptId}:${questionId}`))
}

// GET /api/exams/:id/results/review
//   -> { state, canPublish, blockers: string[], counts: { candidates, graded, ungraded, totalMarks }, rows: ResultRow[] }
// Same rows as GET /results; `blockers` explains why publishing is disabled (e.g. "3 written answers are still ungraded").
export async function getResultsReview(examId) {
  const exam = ownedExam(examId)
  await delay()
  const state = resultsState(exam, examStatus(exam))
  const items = queueItems(examId)
  const ungraded = items.filter((i) => i.score === null).length
  const rows = state === 'NOT_READY' ? [] : resultRows(exam)
  const blockers = []
  if (state === 'NOT_READY') blockers.push('The exam has not finished yet.')
  if (ungraded > 0) blockers.push(`${ungraded} written answer${ungraded === 1 ? ' is' : 's are'} still ungraded.`)
  if (state !== 'NOT_READY' && rows.length === 0) blockers.push('Nobody submitted an attempt.')
  return clone({
    state,
    canPublish: state === 'GRADED' && rows.length > 0,
    blockers: state === 'PUBLISHED' ? [] : blockers,
    publishedAt: publishedAt.get(examId) ?? null,
    counts: { candidates: rows.length, graded: items.length - ungraded, ungraded, totalMarks: exam.totalMarks },
    rows,
  })
}

// POST /api/exams/:id/results/publish -> { state: "PUBLISHED", publishedAt, candidates }
// Creates score version 1 for every attempt. Candidates can now see their result and raise disputes.
export async function publishResults(examId) {
  const me = requireRole('EXAMINER')
  const exam = ownedExam(examId)
  await delay(500, 900)
  const state = resultsState(exam, examStatus(exam))
  if (state === 'PUBLISHED') fail(409, 'ALREADY_PUBLISHED', 'Results have already been published.')
  if (state !== 'GRADED') fail(409, 'NOT_GRADED', 'Grade every written answer before publishing.')
  const when = new Date(serverNow()).toISOString()
  const attempts = submitted(examId)
  for (const attempt of attempts) attempt.versions.push(snapshot(attempt, 1, 'Original marking', when))
  publishedAt.set(examId, when)
  record(me, 'RESULTS_PUBLISHED', exam.title, `${attempts.length} candidates, results released`)
  return { state: 'PUBLISHED', publishedAt: when, candidates: attempts.length }
}

// PATCH /api/examiner/exams/:examId/evaluate — choice questions only; written grades are preserved.
export async function evaluateExam(examId) {
  const me = requireRole('EXAMINER')
  const exam = ownedExam(examId)
  await delay(300, 600)

  const attempts = submitted(examId)
  if (attempts.length === 0) {
    fail(400, 'NO_ATTEMPTS', 'No submitted attempts are available for evaluation.')
  }

  const results = attempts.map((attempt) => ({
    attemptId: attempt.id,
    obtainedMarks: currentScore(attempt).total,
    totalMarks: exam.totalMarks,
    resultId: `result_${attempt.id}`,
  }))

  record(me, 'EXAM_EVALUATED', exam.title, `${results.length} attempts evaluated`)
  return { evaluatedAttempts: results.length, results: clone(results) }
}
