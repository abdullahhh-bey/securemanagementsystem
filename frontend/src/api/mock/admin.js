import { nextId, publicUser, requireRole, users } from './db'
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
  return clone(publicUser(target))
}
