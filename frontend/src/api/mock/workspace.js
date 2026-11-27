import { nextId, requireRole } from './db'
import { record } from './audit'
import { assignedFor, attempts, buildPaper, markQuestion, questionById, round2 } from './examData'
import { ownedExam } from './exams'
import { clone, delay, fail, serverNow } from './helpers'

export const SANDBOX_BANNER = 'SANDBOX - does not affect real results'

const paperDto = (paper) =>
  paper.map((entry, i) => {
    const q = questionById(entry.questionId)
    return {
      id: q.id,
      number: i + 1,
      type: q.type,
      text: q.text,
      marks: entry.marks,
      options: entry.optionOrder.map((optionId) => ({ id: optionId, text: q.options.find((o) => o.id === optionId).text })),
    }
  })

// POST /api/exams/:id/sandbox/attempts
//   -> { attemptId, sandbox: true, banner, exam: { id, title, instructions, durationMinutes, totalMarks }, startedAt, expiresAt, questions: [...] }
// The attempt is stored with sandbox:true. The server must exclude such attempts from monitoring, grading,
// results, analytics, fairness and every exported report.
export async function startSandbox(examId) {
  const me = requireRole('EXAMINER')
  const exam = ownedExam(examId)
  await delay(300, 600)
  if (assignedFor(examId).length === 0) fail(409, 'NO_QUESTIONS', 'Add questions to this exam before previewing it.')
  const random = Math.random
  const paper = buildPaper(examId, me.id, random, exam.settings)
  const startedAt = new Date(serverNow()).toISOString()
  const attempt = {
    id: nextId('sbx'),
    examId,
    candidateId: me.id,
    sandbox: true,
    status: 'IN_PROGRESS',
    startedAt,
    paper,
    answers: {},
    written: {},
    incidents: [],
    gaps: [],
    compensations: [],
    versions: [],
  }
  attempts.push(attempt)
  record(me, 'SANDBOX_STARTED', exam.title, 'Preview attempt, not counted in results')
  return {
    attemptId: attempt.id,
    sandbox: true,
    banner: SANDBOX_BANNER,
    exam: { id: exam.id, title: exam.title, instructions: exam.instructions, durationMinutes: exam.durationMinutes, totalMarks: exam.totalMarks },
    startedAt,
    expiresAt: new Date(serverNow() + exam.durationMinutes * 60000).toISOString(),
    questions: clone(paperDto(paper)),
  }
}

// POST /api/sandbox/attempts/:attemptId/submit  { answers: { [questionId]: { selected?: string[], text?: string } } }
//   -> { sandbox: true, recorded: false, autoScore, autoMax, pendingWritten, questions: [{ id, number, marks, awarded|null, status }] }
export async function submitSandbox(attemptId, answers) {
  const me = requireRole('EXAMINER')
  await delay(300, 600)
  const attempt = attempts.find((a) => a.id === attemptId && a.sandbox && a.candidateId === me.id)
  if (!attempt) fail(404, 'NOT_FOUND', 'That preview attempt no longer exists.')
  const exam = ownedExam(attempt.examId)
  attempt.answers = answers ?? {}
  attempt.status = 'SUBMITTED'
  attempt.submittedAt = new Date(serverNow()).toISOString()
  let autoScore = 0
  let autoMax = 0
  let pendingWritten = 0
  const result = attempt.paper.map((entry, i) => {
    const q = questionById(entry.questionId)
    const answer = attempt.answers[q.id]
    if (q.type === 'WRITTEN') {
      if (answer?.text?.trim()) pendingWritten += 1
      return { id: q.id, number: i + 1, marks: entry.marks, awarded: answer?.text?.trim() ? null : 0, status: answer?.text?.trim() ? 'needs-marking' : 'skipped' }
    }
    const awarded = markQuestion(q, entry.marks, answer, null, exam.settings.negativeMarking)
    autoScore += awarded
    autoMax += entry.marks
    return { id: q.id, number: i + 1, marks: entry.marks, awarded, status: !answer?.selected?.length ? 'skipped' : awarded >= entry.marks ? 'correct' : awarded > 0 ? 'partial' : 'incorrect' }
  })
  return { sandbox: true, recorded: false, autoScore: round2(Math.max(0, autoScore)), autoMax, pendingWritten, questions: result }
}
