import { format, isSameDay } from 'date-fns'

// All dates arrive from the API as ISO-8601 strings (UTC) and are rendered in
// the user's local timezone using one consistent format.

const DATE_TIME = 'd MMM yyyy, h:mm a'
const TIME = 'h:mm a'

function toDate(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatDateTime(value) {
  const date = toDate(value)
  return date ? format(date, DATE_TIME) : '-'
}

export function formatDate(value) {
  const date = toDate(value)
  return date ? format(date, 'd MMM yyyy') : '-'
}

/** "27 Nov 2026, 2:00 PM - 4:00 PM" when same day, otherwise both full. */
export function formatWindow(startAt, endAt) {
  const start = toDate(startAt)
  const end = toDate(endAt)
  if (!start || !end) return '-'
  if (isSameDay(start, end)) {
    return `${format(start, DATE_TIME)} \u2013 ${format(end, TIME)}`
  }
  return `${format(start, DATE_TIME)} \u2013 ${format(end, DATE_TIME)}`
}

export function formatDuration(minutes) {
  if (!Number.isFinite(minutes)) return '-'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

/** Human readable remaining time: "2d 3h", "2h 10m", "4m 12s", "8s". */
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${m}m`
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`
  return `${s}s`
}

export function localTimeZoneLabel() {
  try {
    const parts = new Intl.DateTimeFormat(undefined, { timeZoneName: 'short' }).formatToParts(new Date())
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? ''
  } catch {
    return ''
  }
}

// --- datetime-local <-> ISO helpers (form inputs are in local time) ---------

const LOCAL_INPUT = "yyyy-MM-dd'T'HH:mm"

export function isoToLocalInput(iso) {
  const date = toDate(iso)
  return date ? format(date, LOCAL_INPUT) : ''
}

export function localInputToIso(value) {
  const date = toDate(value)
  return date ? date.toISOString() : ''
}
