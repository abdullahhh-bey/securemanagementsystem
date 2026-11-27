import { useQuery } from '@tanstack/react-query'
import * as adminApi from '@/api/admin'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export function useAuditLog(filters = {}) {
  return useQuery({ queryKey: queryKeys.auditLog(filters), queryFn: () => adminApi.listAuditLog(filters) })
}

export function useAdminExams() {
  return useQuery({ queryKey: queryKeys.adminExams, queryFn: adminApi.listAllExams })
}

export function useImportUsers(options) {
  return useAppMutation(adminApi.importUsers, {
    invalidate: [queryKeys.users, ['admin', 'audit']],
    successMessage: (data) => `${data.created} account${data.created === 1 ? '' : 's'} imported`,
    ...options,
  })
}

export function useResetPassword(options) {
  return useAppMutation(adminApi.resetPassword, {
    invalidate: [['admin', 'audit']],
    silentError: false,
    ...options,
  })
}