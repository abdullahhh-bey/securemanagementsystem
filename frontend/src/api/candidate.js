import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/candidate'

/**
 * Candidate exam: Exam fields plus
 *   accessStatus: AVAILABLE | UPCOMING | CLOSED   <- decided by the server
 *   resultsPublished: boolean                      <- true once the examiner has published results (see api/results.js)
 */

// GET /api/candidate/exams -> CandidateExam[]
export const listCandidateExams = () =>
  USE_MOCK ? mock.listCandidateExams() : request('/api/candidate/exams').then((r) => pick(r, 'exams'))

// GET /api/candidate/exams/:id -> CandidateExam   (403 with a message when access is refused)
export const getCandidateExam = (id) =>
  USE_MOCK ? mock.getCandidateExam(id) : request(`/api/candidate/exams/${id}`).then((r) => pick(r, 'exam'))
