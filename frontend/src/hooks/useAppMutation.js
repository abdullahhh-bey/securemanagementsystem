import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from './useToast'

/**
 * Thin wrapper over useMutation that every write in the app goes through:
 *  - invalidates the given query keys on success
 *  - shows a success toast (string or (data, variables) => string)
 *  - shows a toast with the server's message on failure (unless `silentError`)
 * `isPending` should be used to disable the submit control.
 */
export function useAppMutation(mutationFn, { successMessage, invalidate = [], onSuccess, onError, silentError = false } = {}) {
  const queryClient = useQueryClient()
  const toast = useToast()

  return useMutation({
    mutationFn,
    onSuccess: async (data, variables) => {
      await Promise.all(invalidate.map((queryKey) => queryClient.invalidateQueries({ queryKey })))
      if (successMessage) {
        toast.success(typeof successMessage === 'function' ? successMessage(data, variables) : successMessage)
      }
      onSuccess?.(data, variables)
    },
    onError: (error, variables) => {
      if (!silentError) toast.error(error.message || 'Something went wrong. Please try again.')
      onError?.(error, variables)
    },
  })
}
