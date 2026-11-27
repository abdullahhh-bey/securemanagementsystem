import { createContext, useContext, useEffect, useRef, useState } from 'react'

export const ServerClockContext = createContext(null)

/**
 * { ready, offset, now() }
 * `offset` = serverTime - Date.now(), fetched once from GET /api/time.
 * Use `now()` for anything time-related; never read the device clock directly.
 */
export function useServerClock() {
  const value = useContext(ServerClockContext)
  if (!value) throw new Error('useServerClock must be used inside <ServerClockProvider>')
  return value
}

/** Server-synchronised "now" in epoch ms, re-rendering every `intervalMs`. `null` until the offset is known. */
export function useServerNow(intervalMs = 1000) {
  const { ready, now } = useServerClock()
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!ready) return undefined
    const id = setInterval(() => setTick((tick) => tick + 1), intervalMs)
    return () => clearInterval(id)
  }, [ready, intervalMs])

  return ready ? now() : null
}

/**
 * Live countdown to an ISO timestamp, measured on the server clock.
 * `msLeft` is `null` until the clock is ready. While the countdown sits at
 * zero, `onElapsed` is called (every 3s) so the caller can re-ask the server -
 * the server, not the countdown, decides when access actually opens.
 */
export function useCountdown(targetIso, onElapsed) {
  const nowMs = useServerNow(1000)
  const target = new Date(targetIso).getTime()
  const msLeft = nowMs === null ? null : Math.max(0, target - nowMs)
  const elapsed = msLeft === 0

  const callback = useRef(onElapsed)
  useEffect(() => {
    callback.current = onElapsed
  })

  useEffect(() => {
    if (!elapsed) return undefined
    callback.current?.()
    const id = setInterval(() => callback.current?.(), 3000)
    return () => clearInterval(id)
  }, [elapsed])

  return { msLeft, elapsed }
}
