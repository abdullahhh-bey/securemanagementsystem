import { useCallback, useEffect, useRef } from 'react'
import * as candidateApi from '@/api/candidate'
import { AttemptEventType, normalizeAttemptEventType } from '@/lib/schema'

/**
 * Quietly report attempt lifecycle signals while the workspace is IN_PROGRESS.
 * Failures are swallowed so monitoring never blocks answering.
 */
export function useAttemptEventReporting(attemptId, { enabled = true } = {}) {
  const lastByType = useRef(new Map())
  const enabledRef = useRef(false)

  useEffect(() => {
    enabledRef.current = enabled && Boolean(attemptId)
  }, [attemptId, enabled])

  const report = useCallback(
    (rawType, metadata) => {
      if (!enabledRef.current || !attemptId) return Promise.resolve(null)

      const type = normalizeAttemptEventType(rawType) ?? AttemptEventType[rawType] ?? rawType
      if (!Object.values(AttemptEventType).includes(type)) return Promise.resolve(null)

      const now = Date.now()
      const previous = lastByType.current.get(type) ?? 0
      // Soft debounce identical consecutive types (visibility/blur/save spam).
      if (now - previous < 1500) {
        return Promise.resolve(null)
      }
      lastByType.current.set(type, now)

      return candidateApi.reportAttemptEvent(attemptId, { type, metadata }).catch(() => null)
    },
    [attemptId],
  )

  useEffect(() => {
    if (!enabled || !attemptId) return undefined

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        void report(AttemptEventType.TAB_HIDDEN, { source: 'visibilitychange' })
      } else {
        void report(AttemptEventType.ATTEMPT_RESUMED, { source: 'visibilitychange' })
      }
    }

    const onBlur = () => {
      if (document.visibilityState === 'hidden') return
      void report(AttemptEventType.WINDOW_BLURRED, { source: 'blur' })
    }

    const onOffline = () => {
      void report(AttemptEventType.NETWORK_DISCONNECTED, { source: 'offline' })
    }

    const onOnline = () => {
      void report(AttemptEventType.NETWORK_RESTORED, { source: 'online' })
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('blur', onBlur)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [attemptId, enabled, report])

  return report
}
