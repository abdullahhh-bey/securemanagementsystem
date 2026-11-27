import { nextId, users } from './db'
import { DAY, HOUR, MIN } from './examData'
import { serverNow } from './helpers'

/**
 * Audit trail. Every meaningful write in the mock server calls `record(...)`.
 * Entry: { id, at, actorId, actorName, actorRole, action, target, detail }
 */
export const auditLog = []

const at = (offsetMs) => new Date(serverNow() + offsetMs).toISOString()

export function record(actor, action, target, detail = '') {
  auditLog.unshift({
    id: nextId('au'),
    at: new Date(serverNow()).toISOString(),
    actorId: actor?.id ?? null,
    actorName: actor?.name ?? 'System',
    actorRole: actor?.role ?? 'SYSTEM',
    action,
    target,
    detail,
  })
}

function seed() {
  const who = (id) => users.find((u) => u.id === id)
  const entry = (offset, actorId, action, target, detail = '') => {
    const actor = who(actorId)
    auditLog.push({
      id: nextId('au'),
      at: at(offset),
      actorId,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      target,
      detail,
    })
  }
  entry(-45 * MIN, 'u_3', 'ANNOUNCEMENT_SENT', 'Data Structures \u2014 Midterm', 'Announcement sent to all candidates')
  entry(-2 * HOUR, 'u_3', 'EXAM_PUBLISHED', 'Operating Systems \u2014 Quiz 3')
  entry(-3 * HOUR, 'u_3', 'GRADE_SAVED', 'Computer Networks \u2014 Midterm', '2 written answers graded')
  entry(-5 * HOUR, 'u_3', 'DISPUTE_REVIEW_STARTED', 'Software Engineering \u2014 Pop Quiz', 'Dispute from Leo Marchetti moved to under review')
  entry(-20 * HOUR, 'u_3', 'DISPUTE_RESOLVED', 'Software Engineering \u2014 Pop Quiz', 'Rejected: no connection gap recorded')
  entry(-DAY - 2 * HOUR, 'u_1', 'USER_CREATED', 'Chiara Bellini', 'Candidate account created')
  entry(-2 * DAY, 'u_3', 'RESULTS_PUBLISHED', 'Software Engineering \u2014 Pop Quiz', '3 candidates, results released')
  entry(-3 * DAY, 'u_1', 'USER_UPDATED', 'Yuki Tanaka', 'Account deactivated')
  entry(-4 * DAY, 'u_3', 'QUESTIONS_IMPORTED', 'Question bank', '8 questions imported from CSV')
  entry(-5 * DAY, 'u_1', 'PASSWORD_RESET', 'Hana Sato', 'Temporary password issued')
  entry(-6 * DAY, 'u_4', 'EXAM_CREATED', 'Machine Learning \u2014 Midterm')
  entry(-9 * DAY, 'u_3', 'EXAM_CREATED', 'Database Systems \u2014 Lab Assessment')
  entry(-14 * DAY, 'u_1', 'USERS_IMPORTED', 'Users', '12 accounts imported from CSV')
  entry(-20 * DAY, 'u_3', 'QUESTION_CREATED', 'Question bank', 'Created "Which layer of the OSI model\u2026"')
  auditLog.sort((a, b) => new Date(b.at) - new Date(a.at))
}
seed()
