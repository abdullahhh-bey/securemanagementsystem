import { USE_MOCK, request } from './client'
import * as mock from './mock/workspace'

/**
 * Exam workspace API, sandbox part. A sandbox attempt is flagged `sandbox: true` on the server and is excluded from
 * monitoring, grading, results, analytics, fairness and every export. The UI must always show the SANDBOX banner.
 */

// POST /api/exams/:id/sandbox/attempts
//   -> { attemptId, sandbox: true, banner, exam: { id, title, instructions, durationMinutes, totalMarks },
//        startedAt, expiresAt, questions: [{ id, number, type, text, marks, options: [{ id, text }] }] }
// 409 NO_QUESTIONS when the exam has no questions yet.
export const startSandboxAttempt = (examId) =>
  USE_MOCK ? mock.startSandbox(examId) : request(`/api/exams/${examId}/sandbox/attempts`, { method: 'POST' })

// POST /api/sandbox/attempts/:attemptId/submit  { answers: { [questionId]: { selected?: string[], text?: string } } }
//   -> { sandbox: true, recorded: false, autoScore, autoMax, pendingWritten,
//        questions: [{ id, number, marks, awarded|null, status: correct | partial | incorrect | skipped | needs-marking }] }
export const submitSandboxAttempt = (attemptId, answers) =>
  USE_MOCK ? mock.submitSandbox(attemptId, answers) : request(`/api/sandbox/attempts/${attemptId}/submit`, { method: 'POST', body: { answers } })
