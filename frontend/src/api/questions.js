import { USE_MOCK, pick, request } from './client'
import { mapQuestionToApi, normalizeQuestion } from '@/lib/schema'
import * as mock from './mock/questions'

/**
 * Aligns with prisma Question + QuestionVersion.
 * Requests are mapped to schema field names; responses are normalized for the UI.
 */

const one = async (promise) => normalizeQuestion(await promise)
const many = async (promise) => (await promise).map(normalizeQuestion)

// GET /api/questions -> Question[]
export const listQuestions = () =>
  USE_MOCK ? many(mock.listQuestions()) : many(request('/api/questions').then((r) => pick(r, 'questions')))

// POST /api/questions -> Question
export const createQuestion = (input) => {
  const body = mapQuestionToApi(input)
  return USE_MOCK
    ? one(mock.createQuestion(body))
    : one(request('/api/questions', { method: 'POST', body }).then((r) => pick(r, 'question')))
}

// PATCH /api/questions/:id -> Question
export const updateQuestion = (id, input) => {
  const body = mapQuestionToApi(input)
  return USE_MOCK
    ? one(mock.updateQuestion(id, body))
    : one(request(`/api/questions/${id}`, { method: 'PATCH', body }).then((r) => pick(r, 'question')))
}

// DELETE /api/questions/:id
export const deleteQuestion = (id) => (USE_MOCK ? mock.deleteQuestion(id) : request(`/api/questions/${id}`, { method: 'DELETE' }))

// POST /api/questions/import  { questions: QuestionInput[] } -> { created }
export const importQuestions = (rows) => {
  const questions = rows.map(mapQuestionToApi)
  return USE_MOCK
    ? mock.importQuestions(questions)
    : request('/api/questions/import', { method: 'POST', body: { questions } })
}

// GET /api/exams/:id/questions
export const listExamQuestions = async (examId) => {
  const data = USE_MOCK ? await mock.listExamQuestions(examId) : await request(`/api/exams/${examId}/questions`)
  return {
    ...data,
    items: (data.items ?? []).map((item) => ({
      ...item,
      question: normalizeQuestion(item.question),
    })),
  }
}

// PUT /api/exams/:id/questions
export const setExamQuestions = (examId, items) =>
  USE_MOCK ? mock.setExamQuestions(examId, items) : request(`/api/exams/${examId}/questions`, { method: 'PUT', body: { items } })

// GET /api/exams/:id/shuffle-preview?seed=
export const getShufflePreview = (examId, seed) =>
  USE_MOCK ? mock.getShufflePreview(examId, seed) : request(`/api/exams/${examId}/shuffle-preview`, { params: { seed } })
