import { useCallback, useRef } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import * as candidateApi from '@/api/candidate'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'
import { useToast } from './useToast'

export function useCandidateResults() {
  return useQuery({ queryKey: queryKeys.candidateResults, queryFn: candidateApi.listCandidateResults })
}

export function useCandidateDisputes() {
  return useQuery({ queryKey: queryKeys.candidateDisputes, queryFn: candidateApi.listCandidateDisputes })
}

export function useCandidateAnnouncements() {
  return useQuery({ queryKey: queryKeys.candidateAnnouncements, queryFn: candidateApi.listCandidateAnnouncements })
}

export function useCandidateAttemptWorkspace(attemptId) {
  return useQuery({
    queryKey: queryKeys.candidateAttempt(attemptId),
    queryFn: () => candidateApi.getCandidateAttemptWorkspace(attemptId),
    enabled: Boolean(attemptId),
    retry: false,
  })
}

export function useStartCandidateAttempt(options) {
  return useAppMutation(candidateApi.startCandidateAttempt, {
    invalidate: [queryKeys.candidateExams],
    ...options,
  })
}

export function useSaveCandidateAnswer(attemptId) {
  const toast = useToast()
  const pendingByQuestion = useRef(new Map())
  const mutation = useMutation({
    mutationFn: ({ attemptQuestionId, answer }) =>
      candidateApi.saveCandidateAnswer(attemptId, attemptQuestionId, answer),
    onError: (error) => toast.error(error.message || 'Your answer could not be saved.'),
  })
  const saveAnswer = mutation.mutateAsync
  const queueSave = useCallback(
    (variables) => {
      const { attemptQuestionId } = variables
      const previous = pendingByQuestion.current.get(attemptQuestionId)
      const write = () => saveAnswer(variables)
      const current = previous ? previous.then(write, write) : write()
      pendingByQuestion.current.set(attemptQuestionId, current)
      const clear = () => {
        if (pendingByQuestion.current.get(attemptQuestionId) === current) {
          pendingByQuestion.current.delete(attemptQuestionId)
        }
      }
      current.then(clear, clear)
      return current
    },
    [saveAnswer],
  )
  return { ...mutation, saveAnswer: queueSave }
}

export function useSubmitCandidateAttempt(options) {
  return useAppMutation(candidateApi.submitCandidateAttempt, {
    invalidate: [queryKeys.candidateExams, queryKeys.candidateResults, queryKeys.candidateDisputes],
    successMessage: 'Your exam has been submitted',
    ...options,
  })
}

export function useCreateCandidateDispute(options) {
  return useAppMutation(
    ({ resultId, explanation }) => candidateApi.createCandidateDispute(resultId, explanation),
    {
      invalidate: [queryKeys.candidateDisputes, queryKeys.candidateResults],
      successMessage: 'Your dispute has been submitted',
      ...options,
    },
  )
}
