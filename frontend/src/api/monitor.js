import { pick, request } from './client'

const EXAMINER_BASE = '/api/examiner'

// The monitor endpoints are read by polling (the UI refetches every few seconds). No websockets are assumed.

function adaptMonitorCandidate(participant) {
  if (!participant || typeof participant !== 'object') {
    return { id: '', name: '', email: '' }
  }
  return {
    id: participant.id,
    name: participant.fullName || participant.name || '',
    email: participant.email ?? '',
  }
}

function monitorStatus(status) {
  if (status === 'AUTO_SUBMITTED') return 'SUBMITTED'
  return status
}

/** Map GET /api/examiner/exams/:examId/monitor attempt → MonitorTab LiveSection row. */
function adaptMonitorAttempt(attempt) {
  const candidateSource = attempt.candidate ?? attempt.participant
  return {
    id: attempt.id,
    candidate: adaptMonitorCandidate(candidateSource),
    status: monitorStatus(attempt.status),
    startedAt: attempt.startedAt,
    answered: Number(attempt.answered) || 0,
    total: Number(attempt.total) || 0,
    progressPercent: Number.isFinite(attempt.progressPercent)
      ? attempt.progressPercent
      : attempt.total
        ? Math.round((attempt.answered / attempt.total) * 100)
        : 0,
    lastSeenAt: attempt.lastSeenAt ?? attempt.lastActivityAt ?? attempt.submittedAt ?? attempt.startedAt,
    connection: attempt.connection ?? 'ENDED',
    incidentCount: Number(attempt.incidentCount) || 0,
    personalDeadline: attempt.personalDeadline ?? attempt.expiresAt ?? null,
    compensationMinutes: Number(attempt.compensationMinutes) || 0,
  }
}

/**
 * GET /api/examiner/exams/:examId/monitor
 * -> { serverTime, summary, attempts } (soft presence from lastActivityAt; not websockets)
 */
export const getMonitor = async (examId) => {
  const response = await request(`${EXAMINER_BASE}/exams/${examId}/monitor`)
  const rawAttempts = pick(response, 'attempts')
  const summary = pick(response, 'summary') ?? {}

  return {
    serverTime: response.serverTime ?? new Date().toISOString(),
    summary: {
      enrolled: Number(summary.enrolled) || 0,
      started: Number(summary.started) || 0,
      notStarted: Number(summary.notStarted) || 0,
      online: Number(summary.online) || 0,
      offline: Number(summary.offline) || 0,
      incidents: Number(summary.incidents) || 0,
    },
    attempts: (Array.isArray(rawAttempts) ? rawAttempts : []).map(adaptMonitorAttempt),
  }
}

function adaptIncidentEvent(event) {
  const meta = event.metadata
  const detail =
    typeof meta === 'string'
      ? meta
      : meta && typeof meta === 'object' && typeof meta.message === 'string'
        ? meta.message
        : event.detail ?? null
  return {
    id: event.id,
    type: event.type,
    label: event.type,
    at: event.occurredAt ?? event.at,
    detail,
  }
}

/**
 * Incidents drawer: GET attempt detail + GET events
 * (no /incidents route — events are AttemptEvent rows).
 */
export const getIncidents = async (examId, attemptId) => {
  const [attemptResponse, eventsResponse] = await Promise.all([
    request(`${EXAMINER_BASE}/exams/${examId}/attempts/${attemptId}`),
    request(`${EXAMINER_BASE}/exams/${examId}/attempts/${attemptId}/events`),
  ])

  const attempt = pick(attemptResponse, 'attempt')
  const events = pick(eventsResponse, 'events')
  const eventList = Array.isArray(events) ? events : []

  return {
    candidate: adaptMonitorCandidate(attempt?.participant),
    note: 'Indicators only, not evidence of misconduct.',
    incidents: eventList.map(adaptIncidentEvent),
  }
}

/** Map examiner announcement row → MonitorTab DTO `{ id, message, sentAt, sentBy }`. */
function adaptAnnouncement(row) {
  if (!row || typeof row !== 'object') {
    return { id: '', message: '', sentAt: null, sentBy: 'Exam team' }
  }
  return {
    id: row.id,
    message: row.message ?? '',
    sentAt: row.sentAt ?? row.publishedAt ?? row.createdAt ?? null,
    sentBy: row.sentBy ?? row.author?.fullName ?? 'Exam team',
  }
}

// GET /api/examiner/exams/:examId/announcements -> [{ id, message, sentAt, sentBy }] (newest first)
export const listAnnouncements = async (examId) => {
  const response = await request(`${EXAMINER_BASE}/exams/${examId}/announcements`)
  const rows = pick(response, 'announcements')
  return (Array.isArray(rows) ? rows : []).map(adaptAnnouncement)
}

// POST /api/examiner/exams/:examId/announcements { message (1-500) } -> announcement.
// 409 when the exam is not PUBLISHED/ONGOING.
export const sendAnnouncement = async (examId, message) => {
  const response = await request(`${EXAMINER_BASE}/exams/${examId}/announcements`, {
    method: 'POST',
    body: { message },
  })
  return adaptAnnouncement(pick(response, 'announcement'))
}

function adaptDisruptionGap(gap) {
  if (!gap || typeof gap !== 'object') {
    return { id: '', from: null, to: null, ongoing: false, seconds: 0 }
  }
  return {
    id: gap.id,
    from: gap.from ?? gap.disconnectedAt ?? null,
    to: gap.to ?? gap.restoredAt ?? null,
    ongoing: Boolean(gap.ongoing ?? gap.to == null),
    seconds: Number(gap.seconds) || 0,
  }
}

function adaptDisruptionAttempt(entry) {
  if (!entry || typeof entry !== 'object') return null
  const candidateSource = entry.candidate ?? entry.participant ?? {}
  const gaps = (Array.isArray(entry.gaps) ? entry.gaps : []).map(adaptDisruptionGap)
  const totalGapSeconds =
    Number.isFinite(entry.totalGapSeconds) ? entry.totalGapSeconds : gaps.reduce((sum, gap) => sum + gap.seconds, 0)
  const longestGapSeconds =
    Number.isFinite(entry.longestGapSeconds)
      ? entry.longestGapSeconds
      : gaps.length
        ? Math.max(...gaps.map((gap) => gap.seconds))
        : 0
  const cap = entry.cap ?? {}
  return {
    attemptId: entry.attemptId ?? entry.id,
    candidate: adaptMonitorCandidate(candidateSource),
    status: entry.status,
    gaps,
    totalGapSeconds,
    longestGapSeconds,
    cap: {
      capMinutes: Number(cap.capMinutes) || 0,
      usedMinutes: Number(cap.usedMinutes) || 0,
      remainingMinutes: Number(cap.remainingMinutes) || 0,
    },
    originalDeadline: entry.originalDeadline ?? null,
    personalDeadline: entry.personalDeadline ?? entry.expiresAt ?? null,
    compensationMinutes: Number(entry.compensationMinutes) || 0,
    compensations: Array.isArray(entry.compensations) ? entry.compensations : [],
  }
}

// GET /api/examiner/exams/:examId/disruptions
//   -> { policy, attempts: [{ attemptId, candidate, status, gaps, totalGapSeconds, ... }] }
// Gaps are derived from NETWORK_DISCONNECTED / NETWORK_RESTORED AttemptEvent pairs.
export const listDisruptions = async (examId) => {
  const response = await request(`${EXAMINER_BASE}/exams/${examId}/disruptions`)
  const attempts = pick(response, 'attempts')
  return {
    policy: response.policy ?? '',
    attempts: (Array.isArray(attempts) ? attempts : []).map(adaptDisruptionAttempt).filter(Boolean),
  }
}

function adaptCompensationRow(row) {
  if (!row || typeof row !== 'object') return null
  return {
    id: row.id,
    attemptId: row.attemptId,
    candidate: adaptMonitorCandidate(row.candidate ?? row.participant ?? {}),
    minutes: Number(row.minutes) || 0,
    reason: row.reason ?? '',
    grantedBy: row.grantedBy ?? row.actorName ?? 'Examiner',
    at: row.at ?? row.createdAt ?? null,
  }
}

// GET /api/examiner/exams/:examId/compensations
// -> [{ id, attemptId, candidate, minutes, reason, grantedBy, at }] (newest first)
export const listCompensations = async (examId) => {
  const response = await request(`${EXAMINER_BASE}/exams/${examId}/compensations`)
  const rows = pick(response, 'compensations')
  return (Array.isArray(rows) ? rows : []).map(adaptCompensationRow).filter(Boolean)
}

// POST /api/examiner/exams/:examId/attempts/:attemptId/compensation
// { minutes: integer >= 1 and <= remaining cap, reason: string >= 15 chars }
// -> updated disruption entry for that attempt (personal deadline + cap totals).
export const grantCompensation = async (examId, attemptId, input) => {
  const response = await request(
    `${EXAMINER_BASE}/exams/${examId}/attempts/${attemptId}/compensation`,
    { method: 'POST', body: input },
  )
  const attempt = pick(response, 'attempt')
  return adaptDisruptionAttempt(attempt) ?? attempt
}
