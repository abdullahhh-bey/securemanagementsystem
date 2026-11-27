import { enrollments, examStatus, exams, nextId, publicUser, requireRole, users } from './db'
import { auditLog, record } from './audit'
import { assignedFor, publishedAt, resultsState } from './examData'
import { clone, delay, fail, serverNow } from './helpers'

const ROLES = ['ADMIN', 'EXAMINER', 'CANDIDATE']

export async function listUsers() {
  requireRole('ADMIN')
  await delay()
  return clone(users.map(publicUser))
}

export async function createUser({ name, email, role, password }) {
  requireRole('ADMIN')
  await delay()
  const details = {}
  if (!name?.trim()) details.name = 'Full name is required.'
  if (!ROLES.includes(role)) details.role = 'Choose a valid role.'
  if (!password || password.length < 8) details.password = 'Use at least 8 characters.'
  if (users.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())) {
    details.email = 'An account with this email already exists.'
  }
  if (Object.keys(details).length > 0) {
    fail(
      details.email ? 409 : 422,
      details.email ? 'EMAIL_TAKEN' : 'VALIDATION_ERROR',
      details.email ?? 'Some of the details are not valid.',
      details,
    )
  }
  const created = {
    id: nextId('u'),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    role,
    password,
    isActive: true,
    createdAt: new Date(serverNow()).toISOString(),
  }
  users.push(created)
  record(requireRole('ADMIN'), 'USER_CREATED', created.name, `${created.role.toLowerCase()} account created`)
  return clone(publicUser(created))
}

export async function updateUser(id, patch) {
  const me = requireRole('ADMIN')
  await delay()
  const target = users.find((u) => u.id === id)
  if (!target) fail(404, 'NOT_FOUND', 'That user no longer exists.')

  if (target.id === me.id) {
    if (patch.role !== undefined && patch.role !== target.role) {
      fail(403, 'SELF_DEMOTION', "You can't change your own role. Ask another administrator.")
    }
    if (patch.isActive === false) {
      fail(403, 'SELF_DEACTIVATION', "You can't deactivate your own account.")
    }
  }
  if (patch.role !== undefined) {
    if (!ROLES.includes(patch.role)) fail(422, 'VALIDATION_ERROR', 'Choose a valid role.', { role: 'Choose a valid role.' })
    target.role = patch.role
  }
  if (patch.isActive !== undefined) target.isActive = Boolean(patch.isActive)
  record(me, 'USER_UPDATED', target.name, patch.isActive === undefined ? `Role changed to ${target.role.toLowerCase()}` : target.isActive ? 'Account activated' : 'Account deactivated')
  return clone(publicUser(target))
}


// --- audit log, exams overview, bulk import, password reset -----------------------------

// GET /api/admin/audit?actorId=&action=&from=ISO&to=ISO   (newest first; `from`/`to` are inclusive)
//   -> { total, entries: [{ id, at, actorId, actorName, actorRole, action, target, detail }],
//        actors: [{ id, name }], actions: string[] }       (`actors`/`actions` list every value, for the filter menus)
export async function listAuditLog({ actorId, action, from, to } = {}) {
  requireRole('ADMIN')
  await delay()
  const fromMs = from ? new Date(from).getTime() : null
  const toMs = to ? new Date(to).getTime() : null
  const entries = auditLog.filter((e) => {
    const t = new Date(e.at).getTime()
    return (!actorId || e.actorId === actorId) && (!action || e.action === action) && (fromMs === null || t >= fromMs) && (toMs === null || t <= toMs)
  })
  return clone({
    total: entries.length,
    entries,
    actors: [...new Map(auditLog.filter((e) => e.actorId).map((e) => [e.actorId, { id: e.actorId, name: e.actorName }])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    actions: [...new Set(auditLog.map((e) => e.action))].sort(),
  })
}

// GET /api/admin/exams  (read-only, every examiner's exams)
//   -> [{ id, title, status, owner: { id, name }, startAt, endAt, candidateCount, questionCount, resultsState }]
export async function listAllExams() {
  requireRole('ADMIN')
  await delay()
  return clone(
    exams
      .map((e) => ({
        id: e.id,
        title: e.title,
        status: examStatus(e),
        owner: { id: e.ownerId, name: users.find((u) => u.id === e.ownerId)?.name ?? 'Unknown' },
        startAt: e.startAt,
        endAt: e.endAt,
        candidateCount: enrollments.get(e.id)?.size ?? 0,
        questionCount: assignedFor(e.id).length,
        resultsState: publishedAt.has(e.id) ? 'PUBLISHED' : resultsState(e, examStatus(e)),
      }))
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)),
  )
}

// POST /api/admin/users/import  { users: [{ name, email, role, password }] } -> { created }
// All-or-nothing: if any row is invalid the server answers 422 with details: [{ row, messages }] and creates nobody.
export async function importUsers(rows) {
  const me = requireRole('ADMIN')
  await delay(400, 800)
  const seen = new Set(users.map((u) => u.email.toLowerCase()))
  const errors = []
  rows.forEach((row, index) => {
    const messages = []
    const email = String(row.email ?? '').trim().toLowerCase()
    if (!String(row.name ?? '').trim()) messages.push('name is required')
    if (!/^\S+@\S+\.\S+$/.test(email)) messages.push('email is not valid')
    else if (seen.has(email)) messages.push('an account with this email already exists')
    if (!ROLES.includes(row.role)) messages.push('role must be ADMIN, EXAMINER or CANDIDATE')
    if (!row.password || String(row.password).length < 8) messages.push('password must be at least 8 characters')
    if (messages.length === 0) seen.add(email)
    else errors.push({ row: index + 1, messages })
  })
  if (errors.length > 0) fail(422, 'VALIDATION_ERROR', 'Some rows are not valid. Nobody was imported.', errors)
  const createdAt = new Date(serverNow()).toISOString()
  for (const row of rows) {
    users.push({ id: nextId('u'), name: row.name.trim(), email: row.email.trim().toLowerCase(), role: row.role, password: row.password, isActive: true, createdAt })
  }
  record(me, 'USERS_IMPORTED', 'Users', `${rows.length} accounts imported from CSV`)
  return { created: rows.length }
}

// POST /api/admin/users/:id/reset-password -> { temporaryPassword, expiresAt }
// The temporary password is returned ONCE and never stored in readable form; the user must change it at next sign-in.
export async function resetPassword(id) {
  const me = requireRole('ADMIN')
  await delay(300, 600)
  const target = users.find((u) => u.id === id)
  if (!target) fail(404, 'NOT_FOUND', 'That user no longer exists.')
  if (target.id === me.id) fail(403, 'SELF_RESET', 'Use the account settings to change your own password.')
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const temporaryPassword = Array.from({ length: 12 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('') + '!'
  target.password = temporaryPassword
  record(me, 'PASSWORD_RESET', target.name, 'Temporary password issued')
  return { temporaryPassword, expiresAt: new Date(serverNow() + 24 * 60 * 60 * 1000).toISOString() }
}