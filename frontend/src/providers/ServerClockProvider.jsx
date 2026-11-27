import { useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getServerTime } from '@/api/time'
import { queryKeys } from '@/lib/queryKeys'
import { ServerClockContext } from '@/hooks/useServerClock'

/**
 * Fetches GET /api/time exactly once and keeps `offset = serverTime - Date.now()`.
 * The request round-trip is split in half so the offset isn't skewed by latency.
 */
export function ServerClockProvider({ children }) {
  const { data: offset = null } = useQuery({
    queryKey: queryKeys.serverTime,
    queryFn: async () => {
      const sentAt = Date.now()
      const serverTime = await getServerTime()
      const receivedAt = Date.now()
      return serverTime - (sentAt + receivedAt) / 2
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 3,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })

  const ready = offset !== null
  const now = useCallback(() => Date.now() + (offset ?? 0), [offset])
  const value = useMemo(() => ({ ready, offset: offset ?? 0, now }), [ready, offset, now])

  return <ServerClockContext.Provider value={value}>{children}</ServerClockContext.Provider>
}
