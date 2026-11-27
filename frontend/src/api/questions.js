import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/questions'

/**
 * Question: { id, type: MCQ_SINGLE | MCQ_MULTI | WRITTEN, text, topic, difficulty: easy | medium | hard, defaultMarks,
 *             options: [{ id, text, isCorrect }]                       (MCQ only)
 *             markingRule: ALL_OR_NOTHING | PARTIAL, penalty           (MCQ_MULTI only; penalty = fraction of the marks lost per wrong option)
 *             modelAnswer                                              (WRITTEN only, optional)
 *             usedInExams, createdAt }
 * QuestionInput: the same without id/usedInExams/createdAt; options are { text, isCorrect }.
 * Validation failures answer 422 with `details: { field: message }`.
 */

// GET /api/questions -> Question[]    (the signed-in examiner's question bank)
export const listQuestions = () => (USE_MOCK ? mock.listQuestions() : request('/api/questions').then((r) => pick(r, 'questions')))

// POST /api/questions -> Question
export const createQuestion = (input) =>
  USE_MOCK ? mock.createQuestion(input) : request('/api/questions', { method: 'POST', body: input }).then((r) => pick(r, 'question'))

// PATCH /api/questions/:id -> Question
export const updateQuestion = (id, input) =>
  USE_MOCK ? mock.updateQuestion(id, input) : request(`/api/questions/${id}`, { method: 'PATCH', body: input }).then((r) => pick(r, 'question'))

// DELETE /api/questions/:id        (409 QUESTION_IN_USE while assigned to an exam)
export const deleteQuestion = (id) => (USE_MOCK ? mock.deleteQuestion(id) : request(`/api/questions/${id}`, { method: 'DELETE' }))

// POST /api/questions/import  { questions: QuestionInput[] } -> { created }
// All-or-nothing on the server. On invalid rows it answers 422 with `details: [{ row, messages: string[] }]`.
// The UI validates first and only sends the valid rows.
export const importQuestions = (rows) =>
  USE_MOCK ? mock.importQuestions(rows) : request('/api/questions/import', { method: 'POST', body: { questions: rows } })

// GET /api/exams/:id/questions
//   -> { items: [{ questionId, marks, group, question: Question }], paperMarks, examTotalMarks, warnings: string[], editable }
// `group` ("A", "B"...) makes questions alternatives of each other: each candidate gets one question per group.
// `paperMarks` is what ONE paper is worth (ungrouped marks + one question's marks per group) and should equal `examTotalMarks`.
export const listExamQuestions = (examId) =>
  USE_MOCK ? mock.listExamQuestions(examId) : request(`/api/exams/${examId}/questions`)

// PUT /api/exams/:id/questions  { items: [{ questionId, marks, group|null }] }   (replaces the list; draft exams only, else 409 EXAM_LOCKED)
export const setExamQuestions = (examId, items) =>
  USE_MOCK ? mock.setExamQuestions(examId, items) : request(`/api/exams/${examId}/questions`, { method: 'PUT', body: { items } })

// GET /api/exams/:id/shuffle-preview?seed=123
//   -> { seed, shuffleQuestions, shuffleOptions, papers: [{ label, questions: [{ id, number, text, type, marks, options: [{ id, text }] }] }] }
export const getShufflePreview = (examId, seed) =>
  USE_MOCK ? mock.getShufflePreview(examId, seed) : request(`/api/exams/${examId}/shuffle-preview`, { params: { seed } })
