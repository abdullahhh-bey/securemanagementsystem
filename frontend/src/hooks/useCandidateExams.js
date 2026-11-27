import { useQuery } from '@tanstack/react-query'
import * as candidateApi from '@/api/candidate'
import { queryKeys } from '@/lib/queryKeys'

export function useCandidateExams() {
  return useQuery({ queryKey: queryKeys.candidateExams, queryFn: candidateApi.listCandidateExams })
}

export function useCandidateExam(id) {
  return useQuery({ queryKey: queryKeys.candidateExam(id), queryFn: () => candidateApi.getCandidateExam(id), retry: false })
}
