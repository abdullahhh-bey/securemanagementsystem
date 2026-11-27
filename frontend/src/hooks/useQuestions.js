import { useQuery } from '@tanstack/react-query'
import * as questionsApi from '@/api/questions'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export function useQuestions() {
  return useQuery({ queryKey: queryKeys.questions, queryFn: questionsApi.listQuestions })
}

export function useExamQuestions(examId) {
  return useQuery({
    queryKey: queryKeys.examQuestions(examId),
    queryFn: () => questionsApi.listExamQuestions(examId),
    enabled: Boolean(examId),
  })
}

export function useCreateQuestion(options) {
  return useAppMutation(questionsApi.createQuestion, { invalidate: [queryKeys.questions], ...options })
}

export function useUpdateQuestion(options) {
  return useAppMutation(({ id, ...input }) => questionsApi.updateQuestion(id, input), {
    invalidate: [queryKeys.questions],
    ...options,
  })
}

export function useDeleteQuestion(options) {
  return useAppMutation(questionsApi.deleteQuestion, { invalidate: [queryKeys.questions], ...options })
}

export function useImportQuestions(options) {
  return useAppMutation(questionsApi.importQuestions, {
    invalidate: [queryKeys.questions],
    successMessage: (data) => `${data.created} question${data.created === 1 ? '' : 's'} imported`,
    ...options,
  })
}

export function useSetExamQuestions(examId, options) {
  const examIdKey = String(examId)
  return useAppMutation((items) => questionsApi.setExamQuestions(examId, items), {
    invalidate: [queryKeys.examQuestions(examId), queryKeys.examContent(examId), ['x', examIdKey, 'shuffle']],
    ...options,
  })
}