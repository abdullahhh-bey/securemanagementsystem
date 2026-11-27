import { useQuery } from '@tanstack/react-query'
import * as gradingApi from '@/api/grading'
import * as resultsApi from '@/api/results'
import { queryKeys } from '@/lib/queryKeys'

export function useResults(examId, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.results(examId), queryFn: () => resultsApi.getResults(examId), enabled })
}

export function useQuestionAnalytics(examId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.questionAnalytics(examId),
    queryFn: () => gradingApi.getQuestionAnalytics(examId),
    enabled: Boolean(examId) && enabled,
  })
}
