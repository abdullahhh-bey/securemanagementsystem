import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/exams'

/**
 * Exam: { id, title, instructions, startAt, endAt, durationMinutes, totalMarks,
 *         settings: { shuffleQuestions, shuffleOptions, negativeMarking },
 *         status: DRAFT | PUBLISHED | ONGOING | COMPLETED,   <- always from the server
 *         candidateCount, createdBy, createdAt, updatedAt }
 */

// GET /api/exams -> Exam[]
export const listExams = () => (USE_MOCK ? mock.listExams() : request('/api/exams').then((r) => pick(r, 'exams')))

// GET /api/exams/:id -> Exam
export const getExam = (id) => (USE_MOCK ? mock.getExam(id) : request(`/api/exams/${id}`).then((r) => pick(r, 'exam')))

// POST /api/exams -> Exam
export const createExam = (input) =>
  USE_MOCK ? mock.createExam(input) : request('/api/exams', { method: 'POST', body: input }).then((r) => pick(r, 'exam'))

// PATCH /api/exams/:id -> Exam
export const updateExam = (id, input) =>
  USE_MOCK ? mock.updateExam(id, input) : request(`/api/exams/${id}`, { method: 'PATCH', body: input }).then((r) => pick(r, 'exam'))

// DELETE /api/exams/:id
export const deleteExam = (id) => (USE_MOCK ? mock.deleteExam(id) : request(`/api/exams/${id}`, { method: 'DELETE' }))

// POST /api/exams/:id/publish -> Exam
export const publishExam = (id) =>
  USE_MOCK ? mock.publishExam(id) : request(`/api/exams/${id}/publish`, { method: 'POST' }).then((r) => pick(r, 'exam'))

// GET /api/exams/:id/candidates -> { id, name, email, enrolledAt }[]   (enrolled candidates)
export const listExamCandidates = (id) =>
  USE_MOCK ? mock.listExamCandidates(id) : request(`/api/exams/${id}/candidates`).then((r) => pick(r, 'candidates'))

// GET /api/exams/:id/candidates?available=true -> { id, name, email }[]   (active candidates not yet enrolled)
export const listAvailableCandidates = (id) =>
  USE_MOCK
    ? mock.listAvailableCandidates(id)
    : request(`/api/exams/${id}/candidates`, { params: { available: true } }).then((r) => pick(r, 'candidates'))

// POST /api/exams/:id/candidates  { candidateIds: string[] }
export const enrollCandidates = (id, candidateIds) =>
  USE_MOCK
    ? mock.enrollCandidates(id, candidateIds)
    : request(`/api/exams/${id}/candidates`, { method: 'POST', body: { candidateIds } })

// DELETE /api/exams/:id/candidates/:candidateId
export const removeExamCandidate = (id, candidateId) =>
  USE_MOCK ? mock.removeExamCandidate(id, candidateId) : request(`/api/exams/${id}/candidates/${candidateId}`, { method: 'DELETE' })
