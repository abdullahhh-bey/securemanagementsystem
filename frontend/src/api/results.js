import { USE_MOCK, request } from './client'
import * as mock from './mock/results'

// GET /api/exams/:id/results
//   -> { state: NOT_READY | UNGRADED | GRADED | PUBLISHED, publishedAt|null, provisional, pendingAnswers,
//        summary: { count, average, highest, lowest, passRate, passPercent },       (percentages)
//        distribution: [{ range: "0-9", count }],                                    (10 bins of percent)
//        rows: [{ attemptId, candidate: { id, name, email }, total, max, percent, grade, passed, pending, version|null,
//                 submittedAt, incidentCount, compensationMinutes }] }
// Sandbox attempts are never counted.
export const getResults = (examId) => (USE_MOCK ? mock.getResults(examId) : request(`/api/exams/${examId}/results`))

// GET /api/exams/:id/analytics/questions
//   -> { questions: [{ questionId, label: "Q3", text, type, declaredDifficulty, observedDifficulty: easy | medium | hard,
//                      attempts, skipped, skippedRate, wrongRate, correctRate }] }          (rates are percentages 0-100)
// observedDifficulty: correctRate >= 70 -> easy, >= 40 -> medium, otherwise hard.
export const getQuestionAnalytics = (examId) =>
  USE_MOCK ? mock.getQuestionAnalytics(examId) : request(`/api/exams/${examId}/analytics/questions`)

// GET /api/exams/:id/analytics/fairness
//   -> { method, note, variantGroups: string[], mean, variance, spread, tolerance, withinTolerance,
//        papers: [{ attemptId, candidate, difficultyScore (1.00-3.00), easy, medium, hard, questions }] }
export const getFairness = (examId) => (USE_MOCK ? mock.getFairness(examId) : request(`/api/exams/${examId}/analytics/fairness`))

// GET /api/exams/:id/results/export?format=csv|pdf -> file.  Resolves to { blob, filename }.  409 RESULTS_NOT_READY before the exam ends.
export const exportResults = (examId, format) =>
  USE_MOCK ? mock.exportResults(examId, format) : request(`/api/exams/${examId}/results/export`, { params: { format }, blob: true })

// GET /api/exams/:id/report
//   -> { verificationId, verifyUrl, generatedAt, state, exam: { id, title, startAt, endAt, totalMarks }, summary, rows }
// The preview panel shows `verificationId` and a QR code encoding `verifyUrl`.
export const getExamReportPreview = (examId) => (USE_MOCK ? mock.getExamReportPreview(examId) : request(`/api/exams/${examId}/report`))

// GET /api/exams/:id/report.pdf -> { blob, filename }
export const downloadExamReport = (examId) =>
  USE_MOCK ? mock.downloadExamReport(examId) : request(`/api/exams/${examId}/report.pdf`, { blob: true })

// --- candidate ----------------------------------------------------------------------

// GET /api/candidate/exams/:id/result
//   -> { exam: { id, title, startAt, endAt, totalMarks }, publishedAt, verificationId, verifyUrl,
//        score: { total, max, percent, grade, passed, version, revised },
//        questions: [{ id, number, type, text, marks, max, status: correct | partial | incorrect | skipped, feedback }],
//        compensationMinutes, disputeWindow: { opensAt, closesAt, isOpen } | null, disputes: [Dispute] }
// 403 RESULTS_NOT_PUBLISHED until the examiner publishes.
export const getCandidateResult = (examId) =>
  USE_MOCK ? mock.getCandidateResult(examId) : request(`/api/candidate/exams/${examId}/result`)

// GET /api/candidate/exams/:id/report
//   -> { verificationId, verifyUrl, generatedAt, exam, candidate, score: { total, max, percent, grade, passed, version } }
export const getCandidateReportPreview = (examId) =>
  USE_MOCK ? mock.getCandidateReportPreview(examId) : request(`/api/candidate/exams/${examId}/report`)

// GET /api/candidate/exams/:id/report.pdf -> { blob, filename }
export const downloadCandidateReport = (examId) =>
  USE_MOCK ? mock.downloadCandidateReport(examId) : request(`/api/candidate/exams/${examId}/report.pdf`, { blob: true })
