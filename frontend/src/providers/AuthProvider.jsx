import { useCallback, useEffect, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as authApi from '@/api/auth'
import { setUnauthorizedHandler } from '@/api/client'
import { AuthContext } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { queryKeys } from '@/lib/queryKeys'

// Data that must survive a sign-in / sign-out (everything else is user specific).
const KEEP = new Set(['auth', 'time'])

export function AuthProvider({ children }) {
  const queryClient = useQueryClient()
  const toast = useToast()

  const {
    data: user = null,
    isPending,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await authApi.me()
      } catch (error) {
        if (error.status === 401) return null
        throw error
      }
    },
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  })

  const resetUserData = useCallback(() => {
    queryClient.removeQueries({ predicate: (query) => !KEEP.has(query.queryKey[0]) })
  }, [queryClient])

  const login = useCallback(
    async (credentials) => {
      const signedIn = await authApi.login(credentials)
      resetUserData()
      queryClient.setQueryData(queryKeys.me, signedIn)
      return signedIn
    },
    [queryClient, resetUserData],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } finally {
      resetUserData()
      queryClient.setQueryData(queryKeys.me, null)
    }
  }, [queryClient, resetUserData])

  // Any 401 from the API means the session is gone.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (queryClient.getQueryData(queryKeys.me)) {
        resetUserData()
        queryClient.setQueryData(queryKeys.me, null)
        toast.info('Your session has expired', { description: 'Please sign in again to continue.' })
      }
    })
    return () => setUnauthorizedHandler(null)
  }, [queryClient, resetUserData, toast])

  const value = useMemo(
    () => ({
      user,
      status: isPending ? 'loading' : isError ? 'error' : user ? 'authenticated' : 'unauthenticated',
      error,
      retry: refetch,
      login,
      logout,
    }),
    [user, isPending, isError, error, refetch, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
