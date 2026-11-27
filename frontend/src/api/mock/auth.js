import { currentUser, publicUser, users } from './db'
import { clone, delay, fail, getSessionUserId, setSession } from './helpers'

export async function login({ email, password }) {
  await delay()
  const found = users.find((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())
  if (!found || found.password !== password) {
    fail(401, 'INVALID_CREDENTIALS', 'Incorrect email or password. Please check them and try again.')
  }
  if (!found.isActive) {
    fail(403, 'ACCOUNT_DISABLED', 'This account has been deactivated. Contact an administrator.')
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
