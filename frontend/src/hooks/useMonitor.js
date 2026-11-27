import { useQuery } from '@tanstack/react-query'
import * as monitorApi from '@/api/monitor'
import { queryKeys } from '@/lib/queryKeys'
import { useAppMutation } from './useAppMutation'

export const MONITOR_POLL_MS = 5000

/**
 * Live attempts. Polls while `live` is true and polling is not paused. TanStack Query
 * already skips interval refetches while the browser tab is hidden.
 */
export function useMonitor(examId, { enabled = true, polling = true, intervalMs = MONITOR_POLL_MS } = {}) {
  return useQuery({
    queryKey: queryKeys.monitor(examId),
    queryFn: () => monitorApi.getMonitor(examId),
    enabled,
    refetchInterval: polling ? intervalMs : false,
  })
}

export function useIncidents(examId, attemptId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.incidents(examId, attemptId),
    queryFn: () => monitorApi.getIncidents(examId, attemptId),
    enabled: enabled && Boolean(attemptId),
  })
}

export function useAnnouncements(examId) {
  return useQuery({ queryKey: queryKeys.announcements(examId), queryFn: () => monitorApi.listAnnouncements(examId) })
}

export function useSendAnnouncement(examId, options) {
  return useAppMutation((message) => monitorApi.sendAnnouncement(examId, message), {
    invalidate: [queryKeys.announcements(examId)],
    successMessage: 'Announcement sent to candidates',
    ...options,
  })
}

export function useDisruptions(examId) {
  return useQuery({ queryKey: queryKeys.disruptions(examId), queryFn: () => monitorApi.listDisruptions(examId) })
}

export function useCompensations(examId) {
  return useQuery({ queryKey: queryKeys.compensations(examId), queryFn: () => monitorApi.listCompensations(examId) })
}

export function useGrantCompensation(examId, options) {
  return useAppMutation(({ attemptId, minutes, reason }) => monitorApi.grantCompensation(examId, attemptId, { minutes, reason }), {
    invalidate: [queryKeys.disruptions(examId), queryKeys.compensations(examId), queryKeys.monitor(examId)],
    successMessage: (_, { minutes }) => `${minutes} extra minute${minutes === 1 ? '' : 's'} recorded in the audit trail`,
    silentError: true,
    ...options,
  })
}
