import { useEffect, useState } from 'react'

/** Re-renders every `intervalMs` and returns the device time in ms. Used only to age "x s ago" labels. */
export function useTick(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return now
}

/**
 * Estimated server "now". The monitor payload carries `serverTime`; between polls we add the time that
 * has passed on this device since the payload arrived, so "last seen" labels keep counting up.
 */
export function estimateServerNow(serverTime, receivedAt, tick) {
  const base = serverTime ? new Date(serverTime).getTime() : receivedAt
  return base + Math.max(0, tick - receivedAt)
}

/** "12 s ago", "3 min ago", "2 h ago", "4 d ago". */
export function formatAgo(fromIso, nowMs) {
  const from = new Date(fromIso).getTime()
  if (Number.isNaN(from)) return '-'
  const seconds = Math.max(0, Math.round((nowMs - from) / 1000))
  if (seconds < 5) return 'just now'
  if (seconds < 60) return `${seconds} s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  return `${Math.floor(hours / 24)} d ago`
}

/** "45 s", "2 min 5 s", "1 h 3 min". */
export function formatSpan(totalSeconds) {
  const seconds = Math.max(0, Math.round(totalSeconds))
  if (seconds < 60) return `${seconds} s`
  const minutes = Math.floor(seconds / 60)
  const rest = seconds % 60
  if (minutes < 60) return rest ? `${minutes} min ${rest} s` : `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remMin = minutes % 60
  return remMin ? `${hours} h ${remMin} min` : `${hours} h`
}
