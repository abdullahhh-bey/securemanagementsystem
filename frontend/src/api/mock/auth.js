import { currentUser, publicUser, users } from './db'
import { clone, delay, fail, getSessionUserId, setSession } from './helpers'

export async function login({ email, password }) {
  await delay()
  const found = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
  if (!found || found.password !== password) {
    fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password.')
  }
  if (!found.isActive) {
    fail(403, 'ACCOUNT_DISABLED', 'This account has been deactivated.')
  }
  setSession(found.id)
  return clone(publicUser(found))
}

export async function logout() {
  await delay(100, 220)
  setSession(null)
  return null
}

export async function me() {
  await delay(120, 260)
  if (!getSessionUserId()) fail(401, 'UNAUTHENTICATED', 'You are not signed in.')
  return clone(publicUser(currentUser()))
}

/**
 * Always returns success for valid email shape so callers cannot probe accounts.
 * In mock mode a temporary password is written when the account exists.
 */
export async function forgotPassword({ email }) {
  await delay(400, 700)
  const found = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
  if (found?.isActive) {
    found.password = 'Temp@12345'
    found.mustChangePassword = true
  }
  return { ok: true }
}

export async function changePassword({ currentPassword, newPassword }) {
  await delay(250, 450)
  const meUser = currentUser()
  if (meUser.password !== currentPassword) {
    fail(422, 'VALIDATION_ERROR', 'Current password is incorrect.', { currentPassword: 'Current password is incorrect.' })
  }
  if (!newPassword || String(newPassword).length < 8) {
    fail(422, 'VALIDATION_ERROR', 'New password is too short.', { newPassword: 'Use at least 8 characters.' })
  }
  meUser.password = newPassword
  meUser.mustChangePassword = false
  return { ok: true }
}
