import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/candidate'
import * as studentMock from './mock/student'

function normalizeExam(exam) {
  const questions = exam.questions ?? []
  return {
    ...exam,
    startAt: exam.startAt ?? exam.startsAt,
    endAt: exam.endAt ?? exam.endsAt,
    totalMarks:
      exam.totalMarks ??
      questions.reduce((sum, question) => sum + Number(question.assignedMarks ?? 0), 0),
    questionCount: exam.questionCount ?? exam._count?.questions ?? questions.length,
    settings: exam.settings ?? {
      shuffleQuestions: exam.randomizeQuestions ?? false,
      shuffleOptions: exam.randomizeOptions ?? false,
      negativeMarking: false,
    },
  }
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
    : request('/api/candidate/exams').then((r) => pick(r, 'exams').map(normalizeExam))

// GET /api/candidate/exams/:id -> CandidateExam   (403 with a message when access is refused)
export const getCandidateExam = (id) =>
  USE_MOCK
    ? mock.getCandidateExam(id)
    : request(`/api/candidate/exams/${id}`).then((r) => normalizeExam(pick(r, 'exam')))

// POST /api/candidate/exams/:examId/attempts -> { attempt }
export const startCandidateAttempt = (examId) =>
  USE_MOCK
    ? studentMock.startCandidateAttempt(examId)
    : request(`/api/candidate/exams/${examId}/attempts`, { method: 'POST' }).then((r) => pick(r, 'attempt'))

// GET /api/candidate/attempts/:attemptId/workspace -> { attemptId, status, expiresAt, exam, questions }
export const getCandidateAttemptWorkspace = (attemptId) =>
  USE_MOCK
    ? studentMock.getCandidateAttemptWorkspace(attemptId)
    : request(`/api/candidate/attempts/${attemptId}/workspace`).then((r) => pick(r, 'workspace'))

// PUT /api/candidate/attempts/:attemptId/questions/:attemptQuestionId/answer
export const saveCandidateAnswer = (attemptId, attemptQuestionId, answer) =>
  USE_MOCK
    ? studentMock.saveCandidateAnswer(attemptId, attemptQuestionId, answer)
    : request(`/api/candidate/attempts/${attemptId}/questions/${attemptQuestionId}/answer`, { method: 'PUT', body: answer })

// POST /api/candidate/attempts/:attemptId/submit
export const submitCandidateAttempt = (attemptId) =>
  USE_MOCK
    ? studentMock.submitCandidateAttempt(attemptId)
    : request(`/api/candidate/attempts/${attemptId}/submit`, { method: 'POST' })

export const listCandidateResults = () =>
  USE_MOCK
    ? studentMock.listCandidateResults()
    : request('/api/candidate/results').then((r) => pick(r, 'results'))

export const listCandidateDisputes = () =>
  USE_MOCK
    ? studentMock.listCandidateDisputes()
    : request('/api/candidate/disputes').then((r) => pick(r, 'disputes'))

export const createCandidateDispute = (resultId, explanation) =>
  USE_MOCK
    ? studentMock.createCandidateDispute(resultId, { explanation })
    : request(`/api/candidate/results/${resultId}/disputes`, { method: 'POST', body: { explanation } }).then((r) => pick(r, 'dispute'))

export const listCandidateAnnouncements = () =>
  USE_MOCK
    ? studentMock.listCandidateAnnouncements()
    : request('/api/candidate/announcements').then((r) => pick(r, 'announcements'))
