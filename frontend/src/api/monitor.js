import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/monitor'

// The monitor endpoints are read by polling (the UI refetches every few seconds). No websockets are assumed.

// GET /api/exams/:id/monitor
//   -> { serverTime, summary: { enrolled, started, notStarted, online, offline, incidents },
//        attempts: [{ id, candidate: { id, name, email }, status: IN_PROGRESS | SUBMITTED, startedAt, answered, total,
//                     progressPercent, lastSeenAt, connection: ONLINE | UNSTABLE | OFFLINE | ENDED, incidentCount,
//                     originalDeadline, personalDeadline, compensationMinutes }] }
export const getMonitor = (examId) => (USE_MOCK ? mock.getMonitor(examId) : request(`/api/exams/${examId}/monitor`))

// GET /api/exams/:id/attempts/:attemptId/incidents
//   -> { candidate, note: "Indicators only, not evidence of misconduct.", incidents: [{ id, type, label, at, detail }] }
// type: TAB_HIDDEN | FULLSCREEN_EXIT | PASTE_DETECTED | CONNECTION_LOST | CONNECTION_UNSTABLE
export const getIncidents = (examId, attemptId) =>
  USE_MOCK ? mock.getIncidents(examId, attemptId) : request(`/api/exams/${examId}/attempts/${attemptId}/incidents`)

// GET /api/exams/:id/announcements -> [{ id, message, sentAt, sentBy }]  (newest first)
export const listAnnouncements = (examId) =>
  USE_MOCK ? mock.listAnnouncements(examId) : request(`/api/exams/${examId}/announcements`).then((r) => pick(r, 'announcements'))

// POST /api/exams/:id/announcements  { message (1-500 chars) } -> announcement.  409 EXAM_NOT_ACTIVE outside published/live.
export const sendAnnouncement = (examId, message) =>
  USE_MOCK ? mock.sendAnnouncement(examId, message) : request(`/api/exams/${examId}/announcements`, { method: 'POST', body: { message } })

// GET /api/exams/:id/disruptions
//   -> { policy, attempts: [{ attemptId, candidate, status,
//        gaps: [{ id, from, to|null, ongoing, seconds }], totalGapSeconds, longestGapSeconds,
//        cap: { capMinutes, usedMinutes, remainingMinutes }, originalDeadline, personalDeadline, compensationMinutes,
//        compensations: [{ id, minutes, reason, grantedBy, at }] }] }
// A connection gap is a period when the candidate's client could not reach the server.
export const listDisruptions = (examId) => (USE_MOCK ? mock.listDisruptions(examId) : request(`/api/exams/${examId}/disruptions`))

// GET /api/exams/:id/compensations -> audit trail: [{ id, attemptId, candidate, minutes, reason, grantedBy, at }]  (newest first)
export const listCompensations = (examId) =>
  USE_MOCK ? mock.listCompensations(examId) : request(`/api/exams/${examId}/compensations`).then((r) => pick(r, 'compensations'))

// POST /api/exams/:id/attempts/:attemptId/compensation  { minutes: integer >= 1 and <= remaining cap, reason: string >= 15 chars }
//   -> the updated disruption entry for that attempt.
// The server never moves the exam deadline silently: the candidate's PERSONAL deadline moves and the grant is written to the audit log.
export const grantCompensation = (examId, attemptId, input) =>
  USE_MOCK
    ? mock.grantCompensation(examId, attemptId, input)
    : request(`/api/exams/${examId}/attempts/${attemptId}/compensation`, { method: 'POST', body: input })
