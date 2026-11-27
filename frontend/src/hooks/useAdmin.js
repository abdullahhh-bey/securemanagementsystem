import { useQuery } from '@tanstack/react-query'
import * as adminApi from '@/api/admin'
import { queryKeys } from '@/lib/queryKeys'

export function useAuditLog(filters = {}) {
  return useQuery({ queryKey: queryKeys.auditLog(filters), queryFn: () => adminApi.listAuditLog(filters) })
}

export function useAdminExams() {
  return useQuery({ queryKey: queryKeys.adminExams, queryFn: adminApi.listAllExams })
}
