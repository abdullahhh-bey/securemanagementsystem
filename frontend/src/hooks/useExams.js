import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as examsApi from '@/api/exams'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export function useExams() {
  return useQuery({ queryKey: queryKeys.exams, queryFn: examsApi.listExams })
}

export function useExam(id) {
  return useQuery({ queryKey: queryKeys.exam(id), queryFn: () => examsApi.getExam(id), enabled: Boolean(id) })
}

export function useExamCandidates(id) {
  return useQuery({ queryKey: queryKeys.examCandidates(id), queryFn: () => examsApi.listExamCandidates(id) })
}

export function useAvailableCandidates(id, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.examAvailableCandidates(id),
    queryFn: () => examsApi.listAvailableCandidates(id),
    enabled,
  })
}

export function useCreateExam(options) {
  return useAppMutation(examsApi.createExam, { invalidate: [queryKeys.exams], ...options })
}

export function useUpdateExam(id, options) {
  return useAppMutation((input) => examsApi.updateExam(id, input), { invalidate: [queryKeys.exams], ...options })
}

export function useDeleteExam({ onSuccess, ...options } = {}) {
  const queryClient = useQueryClient()
  return useAppMutation((id) => examsApi.deleteExam(id), {
    successMessage: 'Draft exam deleted',
    ...options,
    onSuccess: (data, id) => {
      // Drop the deleted exam's caches without refetching them (that would 404).
      queryClient.removeQueries({ queryKey: queryKeys.exam(id) })
      queryClient.invalidateQueries({ queryKey: queryKeys.exams, exact: true })
      onSuccess?.(data, id)
    },
  })
}

export function usePublishExam(id, options) {
  return useAppMutation(() => examsApi.publishExam(id), {
    invalidate: [queryKeys.exams],
    successMessage: 'Exam published',
    ...options,
  })
}

export function useEnrollCandidates(id, options) {
  return useAppMutation((candidateIds) => examsApi.enrollCandidates(id, candidateIds), {
    invalidate: [queryKeys.exams],
    successMessage: (_, ids) => `${ids.length} candidate${ids.length === 1 ? '' : 's'} enrolled`,
    ...options,
  })
}

export function useRemoveCandidate(id, options) {
  return useAppMutation((candidateId) => examsApi.removeExamCandidate(id, candidateId), {
    invalidate: [queryKeys.exams],
    successMessage: 'Candidate removed',
    ...options,
  })
}
