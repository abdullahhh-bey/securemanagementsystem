import { useQuery } from '@tanstack/react-query'
import * as resultsApi from '@/api/results'
import { queryKeys } from '@/lib/queryKeys'

export function useResults(examId, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.results(examId), queryFn: () => resultsApi.getResults(examId), enabled })
}

export function useQuestionAnalytics(examId, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.questionAnalytics(examId), queryFn: () => resultsApi.getQuestionAnalytics(examId), enabled })
}

export function useFairness(examId, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.fairness(examId), queryFn: () => resultsApi.getFairness(examId), enabled })
}

export function useExamReportPreview(examId, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.examReport(examId), queryFn: () => resultsApi.getExamReportPreview(examId), enabled })
}