import { useQuery } from '@tanstack/react-query'
import * as adminApi from '@/api/admin'
import { queryKeys } from '@/lib/queryKeys'
import { userDisplayName } from '@/lib/schema'
import { useAppMutation } from './useAppMutation'

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: adminApi.listUsers })
}

export function useCreateUser(options) {
  return useAppMutation(adminApi.createUser, {
    invalidate: [queryKeys.users],
    successMessage: (user) => `${userDisplayName(user) || 'User'} was added`,
    ...options,
  })
}

export function useUpdateUser(options) {
  return useAppMutation(({ id, ...patch }) => adminApi.updateUser(id, patch), {
    invalidate: [queryKeys.users],
    ...options,
  })
}
