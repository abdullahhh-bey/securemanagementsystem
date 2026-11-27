import { useQuery } from '@tanstack/react-query'
import { listCandidates } from '@/api/exams'
import { queryKeys } from '@/lib/queryKeys'

export function useTeacherStudents() {
  return useQuery({
    queryKey: queryKeys.teacherStudents,
    queryFn: listCandidates,
  })
}
