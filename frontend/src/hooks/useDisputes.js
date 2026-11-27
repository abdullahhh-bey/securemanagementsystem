import { useQuery } from '@tanstack/react-query'
import * as disputesApi from '@/api/disputes'
import * as resultsApi from '@/api/results'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export function useDisputes(examId) {
  return useQuery({
    queryKey: queryKeys.disputes(examId),
    queryFn: () => disputesApi.listDisputes(examId),
    enabled: Boolean(examId),
  })
}

export function useDisputeImpact(examId, disputeId, outcome, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.disputeImpact(examId, disputeId, outcome),
    queryFn: () => disputesApi.previewDisputeImpact(examId, disputeId, outcome),
    enabled: Boolean(examId && disputeId && outcome && enabled),
  })
}

export function useScoreHistory(examId, attemptId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.scoreHistory(examId, attemptId),
    queryFn: () => disputesApi.getScoreHistory(examId, attemptId),
    enabled: Boolean(examId && attemptId && enabled),
  })
}

export function useStartDisputeReview(examId, options) {
  return useAppMutation((disputeId) => disputesApi.startDisputeReview(examId, disputeId), {
    invalidate: [queryKeys.disputes(examId), queryKeys.examContent(examId)],
    successMessage: 'Dispute moved to under review',
    ...options,
  })
}

export function useResolveDispute(examId, options) {
  return useAppMutation(({ disputeId, outcome, reason }) => disputesApi.resolveDispute(examId, disputeId, { outcome, reason }), {
    invalidate: [queryKeys.disputes(examId), queryKeys.examContent(examId)],
    successMessage: (data) =>
      data.changedCount > 0
        ? `Dispute resolved — ${data.changedCount} score${data.changedCount === 1 ? '' : 's'} revised`
        : 'Dispute resolved',
    ...options,
  })
}

export function useCreateDispute(examId, options) {
  return useAppMutation((input) => disputesApi.createDispute(examId, input), {
    invalidate: [queryKeys.candidateResult(examId)],
    successMessage: 'Your dispute was submitted',
    ...options,
  })
}

export function useCandidateResult(examId) {
  return useQuery({
    queryKey: queryKeys.candidateResult(examId),
    queryFn: () => resultsApi.getCandidateResult(examId),
    enabled: Boolean(examId),
    retry: (count, error) => error?.code !== 'RESULTS_NOT_PUBLISHED' && count < 2,
  })
}

export function useCandidateReportPreview(examId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.candidateReport(examId),
    queryFn: () => resultsApi.getCandidateReportPreview(examId),
    enabled: Boolean(examId) && enabled,
  })
}