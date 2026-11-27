import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as gradingApi from '@/api/grading'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export function useGradingQueue(examId) {
  return useQuery({ queryKey: queryKeys.grading(examId), queryFn: () => gradingApi.getGradingQueue(examId) })
}

export function useResultsReview(examId, { enabled = true } = {}) {
  return useQuery({ queryKey: queryKeys.resultsReview(examId), queryFn: () => gradingApi.getResultsReview(examId), enabled })
}

/**
 * Saves one written-answer grade. The saved item is written straight into the queue cache so
 * "Save and next" feels instant; the queue and the review are then refreshed in the background.
 * Errors are not toasted: the grading form shows them next to the score field.
 */
export function useSaveGrade(examId, options) {
  const queryClient = useQueryClient()
  return useAppMutation(
    ({ item, score, feedback }) => gradingApi.saveGrade(examId, item.attemptId, item.question.id, { score, feedback }),
    {
      silentError: true,
      ...options,
      onSuccess: (saved, variables) => {
        queryClient.setQueryData(queryKeys.grading(examId), (current) => {
          if (!current) return current
          const items = current.items.map((item) => (item.key === saved.key ? saved : item))
          return { ...current, items, progress: { ...current.progress, graded: items.filter((i) => i.score !== null).length } }
        })
        queryClient.invalidateQueries({ queryKey: queryKeys.grading(examId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.resultsReview(examId) })
        queryClient.invalidateQueries({ queryKey: queryKeys.results(examId) })
        options?.onSuccess?.(saved, variables)
      },
    },
  )
}

export function usePublishResults(examId, options) {
  return useAppMutation(() => gradingApi.publishResults(examId), {
    // examContent covers grading, results review, results and analytics together.
    invalidate: [queryKeys.examContent(examId), queryKeys.exam(examId)],
    successMessage: (data) => `Results published to ${data?.candidates ?? 0} candidate${data?.candidates === 1 ? '' : 's'}`,
    ...options,
  })
}
