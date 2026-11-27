import { useCallback, useEffect, useRef } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as candidateApi from '@/api/candidate'
import { AttemptEventType } from '@/lib/schema'
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

export function useCandidatePreferences() {
  return useQuery({
    queryKey: queryKeys.candidatePreferences,
    queryFn: candidateApi.getCandidatePreferences,
  })
}

export function useSaveCandidatePreferences(options) {
  return useAppMutation(candidateApi.updateCandidatePreferences, {
    invalidate: [queryKeys.candidatePreferences],
    successMessage: 'Display preferences saved',
    ...options,
  })
}

export function useCandidateAttemptWorkspace(attemptId) {
  return useQuery({
    queryKey: queryKeys.candidateAttempt(attemptId),
    queryFn: () => candidateApi.getCandidateAttemptWorkspace(attemptId),
    enabled: Boolean(attemptId),
    retry: false,
  })
}

export function useCandidateScratchpad(attemptId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.candidateScratchpad(attemptId),
    queryFn: () => candidateApi.getCandidateScratchpad(attemptId),
    enabled: Boolean(attemptId) && enabled,
    retry: false,
  })
}

export function useSaveCandidateScratchpad(attemptId) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (content) => candidateApi.saveCandidateScratchpad(attemptId, content),
    onSuccess: (scratchpad) => {
      queryClient.setQueryData(queryKeys.candidateScratchpad(attemptId), scratchpad)
    },
  })
}

export function useStartCandidateAttempt(options) {
  return useAppMutation(candidateApi.startCandidateAttempt, {
    invalidate: [queryKeys.candidateExams],
    ...options,
  })
}

export function useSaveCandidateAnswer(attemptId, { reportEvent } = {}) {
  const toast = useToast()
  const pendingByQuestion = useRef(new Map())
  const reportEventRef = useRef(reportEvent)
  useEffect(() => {
    reportEventRef.current = reportEvent
  }, [reportEvent])
  const mutation = useMutation({
    mutationFn: ({ attemptQuestionId, answer }) =>
      candidateApi.saveCandidateAnswer(attemptId, attemptQuestionId, answer),
    onSuccess: (_data, variables) => {
      reportEventRef.current?.(AttemptEventType.ANSWER_SAVE_SUCCEEDED, {
        attemptQuestionId: variables.attemptQuestionId,
      })
    },
    onError: (error, variables) => {
      toast.error(error.message || 'Your answer could not be saved.')
      reportEventRef.current?.(AttemptEventType.ANSWER_SAVE_FAILED, {
        attemptQuestionId: variables?.attemptQuestionId,
        message: error?.message,
      })
    },
  })
  const saveAnswer = mutation.mutateAsync
  const queuedSave = useCallback(
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
  return { ...mutation, saveAnswer: queuedSave }
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
