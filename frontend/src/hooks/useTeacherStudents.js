import { useQuery } from '@tanstack/react-query'
import { listTeacherStudents } from '@/api/mock/teacher'
import { queryKeys } from '@/lib/queryKeys'

export function useTeacherStudents() {
  return useQuery({
    queryKey: queryKeys.teacherStudents,
    queryFn: listTeacherStudents,
  })
}
