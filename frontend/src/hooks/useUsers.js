import { useQuery } from '@tanstack/react-query'
import * as adminApi from '@/api/admin'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export function useUsers() {
  return useQuery({ queryKey: queryKeys.users, queryFn: adminApi.listUsers })
}

export function useCreateUser(options) {
  return useAppMutation(adminApi.createUser, {
    invalidate: [queryKeys.users],
    successMessage: (user) => `${user.name} was added`,
    ...options,
  })
}

export function useUpdateUser(options) {
  return useAppMutation(({ id, ...patch }) => adminApi.updateUser(id, patch), {
    invalidate: [queryKeys.users],
    ...options,
  })
}
