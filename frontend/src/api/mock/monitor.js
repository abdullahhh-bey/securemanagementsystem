import { enrollments, examStatus, nextId, requireRole, users } from './db'
import { record } from './audit'
import { announcements, hash, MAX_COMPENSATION_MINUTES, MIN, realAttempts } from './examData'
import { ownedExam } from './exams'
import { clone, delay, fail, serverNow } from './helpers'

const INCIDENT_LABEL = {
  TAB_HIDDEN: 'Left the exam tab',
  FULLSCREEN_EXIT: 'Left full-screen mode',
  PASTE_DETECTED: 'Pasted text into an answer',
  CONNECTION_LOST: 'Connection lost',
  CONNECTION_UNSTABLE: 'Unstable connection',
}

const iso = (ms) => new Date(ms).toISOString()
const person = (id) => {
  const u = users.find((x) => x.id === id)
  return { id: u.id, name: u.name, email: u.email }
}

/** Personal deadline = the shorter of "started + duration" and the window end, plus recorded compensation. */
function deadlines(attempt, exam) {
  const original = Math.min(new Date(attempt.startedAt).getTime() + exam.durationMinutes * MIN, new Date(exam.endAt).getTime())
  const compensation = attempt.compensations.reduce((sum, c) => sum + c.minutes, 0)
  return { originalDeadline: iso(original), personalDeadline: iso(original + compensation * MIN), compensationMinutes: compensation }
}

function liveView(attempt, exam) {
  const now = serverNow()
  const total = attempt.paper.length
  const openGap = attempt.gaps.find((g) => g.to === null)
  if (attempt.status === 'SUBMITTED') {
    return { answered: Object.keys(attempt.answers).length, total, lastSeenAt: attempt.submittedAt, connection: 'ENDED' }
  }
  const elapsedMin = (now - new Date(attempt.startedAt).getTime()) / MIN
  const answered = Math.min(total, Math.floor(elapsedMin * (attempt.live?.rate ?? 0.25)))
  let lastSeen
  let connection
  if (openGap) {
    lastSeen = new Date(openGap.from).getTime()
    connection = 'OFFLINE'
  } else {
    const jitter = hash(`${attempt.id}:${Math.floor(now / 4000)}`) % 11
    lastSeen = now - (2 + jitter) * 1000
    connection = attempt.incidents.some((i) => i.type === 'CONNECTION_UNSTABLE') ? 'UNSTABLE' : 'ONLINE'
  }
  void exam
  return { answered, total, lastSeenAt: iso(lastSeen), connection }
}

const incidentDto = (i) => ({ id: i.id, type: i.type, label: INCIDENT_LABEL[i.type] ?? i.type, at: i.at, detail: i.detail })

// GET /api/exams/:id/monitor   (poll every few seconds)
//   -> { serverTime, summary: { enrolled, started, notStarted, online, offline, incidents },
//        attempts: [{ id, candidate: { id, name, email }, status: IN_PROGRESS | SUBMITTED, startedAt, answered, total,
//                     progressPercent, lastSeenAt, connection: ONLINE | UNSTABLE | OFFLINE | ENDED, incidentCount,
//                     personalDeadline, compensationMinutes }] }
// Sandbox attempts are never included.
export async function getMonitor(examId) {
  const exam = ownedExam(examId)
  await delay(120, 260)
  const list = realAttempts(examId).map((attempt) => {
    const view = liveView(attempt, exam)
    return {
      id: attempt.id,
      candidate: person(attempt.candidateId),
      status: attempt.status,
      startedAt: attempt.startedAt,
      answered: view.answered,
      total: view.total,
      progressPercent: view.total ? Math.round((view.answered / view.total) * 100) : 0,
      lastSeenAt: view.lastSeenAt,
      connection: view.connection,
      incidentCount: attempt.incidents.length,
      ...deadlines(attempt, exam),
    }
  })
  const active = list.filter((a) => a.status === 'IN_PROGRESS')
  const enrolled = enrollments.get(examId)?.size ?? 0
  return clone({
    serverTime: iso(serverNow()),
    summary: {
      enrolled,
      started: list.length,
      notStarted: Math.max(0, enrolled - list.length),
      online: active.filter((a) => a.connection === 'ONLINE').length,
      offline: active.filter((a) => a.connection === 'OFFLINE').length,
      incidents: list.reduce((sum, a) => sum + a.incidentCount, 0),
    },
    attempts: list.sort((a, b) => a.candidate.name.localeCompare(b.candidate.name)),
  })
}

// GET /api/exams/:id/attempts/:attemptId/incidents
//   -> { candidate, note: "Indicators only, not evidence of misconduct.", incidents: [{ id, type, label, at, detail }] }
export async function getIncidents(examId, attemptId) {
  ownedExam(examId)
  await delay(150, 300)
  const attempt = realAttempts(examId).find((a) => a.id === attemptId)
  if (!attempt) fail(404, 'NOT_FOUND', 'That attempt was not found.')
  return clone({
    candidate: person(attempt.candidateId),
    note: 'Indicators only, not evidence of misconduct.',
    incidents: [...attempt.incidents].sort((a, b) => new Date(b.at) - new Date(a.at)).map(incidentDto),
  })
}

// GET /api/exams/:id/announcements -> [{ id, message, sentAt, sentBy }]   (newest first)
export async function listAnnouncements(examId) {
  ownedExam(examId)
  await delay()
  return clone(announcements.filter((a) => a.examId === examId).sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt)))
}

// POST /api/exams/:id/announcements  { message } -> announcement
export async function sendAnnouncement(examId, message) {
  const me = requireRole('EXAMINER')
  const exam = ownedExam(examId)
  await delay()
  const text = String(message ?? '').trim()
  if (!text) fail(422, 'VALIDATION_ERROR', 'Write a message first.', { message: 'Write a message first.' })
  if (text.length > 500) fail(422, 'VALIDATION_ERROR', 'Keep announcements under 500 characters.', { message: 'Keep announcements under 500 characters.' })
  const status = examStatus(exam)
  if (status !== 'ONGOING' && status !== 'PUBLISHED') fail(409, 'EXAM_NOT_ACTIVE', 'Announcements can be sent once the exam is published and until it ends.')
  const created = { id: nextId('ann'), examId, message: text, sentAt: iso(serverNow()), sentBy: me.name }
  announcements.push(created)
  record(me, 'ANNOUNCEMENT_SENT', exam.title, text.slice(0, 80))
  return clone(created)
}

// --- disruptions & compensation -------------------------------------------------

function disruptionDto(attempt, exam) {
  const now = serverNow()
  const gaps = attempt.gaps.map((g) => {
    const end = g.to ? new Date(g.to).getTime() : now
    return { id: g.id, from: g.from, to: g.to, ongoing: g.to === null, seconds: Math.max(0, Math.round((end - new Date(g.from).getTime()) / 1000)) }
  })
  const cap = Math.min(MAX_COMPENSATION_MINUTES, Math.round(exam.durationMinutes * 0.25))
  const used = attempt.compensations.reduce((sum, c) => sum + c.minutes, 0)
  return {
    attemptId: attempt.id,
    candidate: person(attempt.candidateId),
    status: attempt.status,
    gaps,
    totalGapSeconds: gaps.reduce((s, g) => s + g.seconds, 0),
    longestGapSeconds: Math.max(0, ...gaps.map((g) => g.seconds)),
    cap: { capMinutes: cap, usedMinutes: used, remainingMinutes: Math.max(0, cap - used) },
    ...deadlines(attempt, exam),
    compensations: attempt.compensations.map((c) => ({ ...c })),
  }
}

// GET /api/exams/:id/disruptions
//   -> { policy: string, attempts: [{ attemptId, candidate, status, gaps: [{ id, from, to, ongoing, seconds }], totalGapSeconds,
//        longestGapSeconds, cap: { capMinutes, usedMinutes, remainingMinutes }, originalDeadline, personalDeadline,
//        compensationMinutes, compensations: [{ id, minutes, reason, grantedBy, at }] }] }
export async function listDisruptions(examId) {
  const exam = ownedExam(examId)
  await delay()
  return clone({
    policy: 'The exam deadline is never extended silently. Every compensation is recorded with a reason, shown to the candidate and written to the audit log.',
    attempts: realAttempts(examId)
      .map((a) => disruptionDto(a, exam))
      .sort((a, b) => b.totalGapSeconds - a.totalGapSeconds),
  })
}

// GET /api/exams/:id/compensations -> audit trail of every compensation for this exam, newest first
//   [{ id, attemptId, candidate, minutes, reason, grantedBy, at }]
export async function listCompensations(examId) {
  ownedExam(examId)
  await delay()
  const rows = realAttempts(examId).flatMap((a) => a.compensations.map((c) => ({ ...c, attemptId: a.id, candidate: person(a.candidateId) })))
  return clone(rows.sort((a, b) => new Date(b.at) - new Date(a.at)))
}

// POST /api/exams/:id/attempts/:attemptId/compensation  { minutes, reason } -> disruption entry for that attempt
export async function grantCompensation(examId, attemptId, { minutes, reason }) {
  const me = requireRole('EXAMINER')
  const exam = ownedExam(examId)
  await delay(300, 600)
  const attempt = realAttempts(examId).find((a) => a.id === attemptId)
  if (!attempt) fail(404, 'NOT_FOUND', 'That attempt was not found.')
  const current = disruptionDto(attempt, exam)
  const details = {}
  const amount = Number(minutes)
  if (!Number.isInteger(amount) || amount < 1) details.minutes = 'Enter a whole number of minutes, at least 1.'
  else if (amount > current.cap.remainingMinutes) {
    details.minutes = `The cap is ${current.cap.capMinutes} minutes per candidate and ${current.cap.remainingMinutes} remain.`
  }
  if (String(reason ?? '').trim().length < 15) details.reason = 'Write a reason of at least 15 characters. It is stored in the audit trail.'
  if (Object.keys(details).length > 0) fail(422, 'VALIDATION_ERROR', 'The compensation could not be recorded.', details)
  const entry = { id: nextId('cmp'), minutes: amount, reason: reason.trim(), grantedBy: me.name, at: iso(serverNow()) }
  attempt.compensations.push(entry)
  record(me, 'COMPENSATION_GRANTED', exam.title, `${amount} min for ${person(attempt.candidateId).name}: ${entry.reason}`)
  return clone(disruptionDto(attempt, exam))
}
