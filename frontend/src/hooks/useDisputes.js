import { useQuery } from '@tanstack/react-query'
import * as disputesApi from '@/api/disputes'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export function useDisputes(examId) {
  return useQuery({
    queryKey: queryKeys.disputes(examId),
    queryFn: () => disputesApi.listDisputes(examId),
    enabled: Boolean(examId),
  })
}

export function useStartDisputeReview(examId, options) {
  return useAppMutation((disputeId) => disputesApi.startDisputeReview(disputeId), {
    invalidate: [queryKeys.disputes(examId), queryKeys.examContent(examId)],
    successMessage: 'Dispute moved to under review',
    ...options,
  })
}

export function useResolveDispute(examId, options) {
  return useAppMutation(({ disputeId, status, resolution }) => disputesApi.updateDispute(disputeId, { status, resolution }), {
    invalidate: [queryKeys.disputes(examId), queryKeys.examContent(examId)],
    successMessage: 'Dispute updated',
    ...options,
  })
}
