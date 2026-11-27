import { normalizeUser } from '@/lib/schema'
import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/auth'

/**
 * User (prisma): { id, email, fullName, role: ADMIN|EXAMINER|CANDIDATE, isActive, createdAt, updatedAt }
 * UI may also read `name` as an alias of `fullName` (ensured by normalizeUser).
 */

function asAuthUser(user) {
  return normalizeUser(user)
}

// POST /api/auth/login   { email, password } -> { user }
export const login = ({ email, password }) =>
  USE_MOCK
    ? mock.login({ email, password }).then(asAuthUser)
    : request('/api/auth/login', { method: 'POST', body: { email, password }, skipUnauthorizedHandler: true }).then((r) =>
        asAuthUser(pick(r, 'user')),
      )

// POST /api/auth/logout
export const logout = () => (USE_MOCK ? mock.logout() : request('/api/auth/logout', { method: 'POST', skipUnauthorizedHandler: true }))

// GET /api/auth/me -> { user }
export const me = () =>
  USE_MOCK
    ? mock.me().then(asAuthUser)
    : request('/api/auth/me', { skipUnauthorizedHandler: true }).then((r) => asAuthUser(pick(r, 'user')))

// POST /api/auth/forgot-password  { email } -> { ok: true }
export const forgotPassword = ({ email }) =>
  USE_MOCK
    ? mock.forgotPassword({ email })
    : request('/api/auth/forgot-password', {
        method: 'POST',
        body: { email },
        skipUnauthorizedHandler: true,
      })

// POST /api/auth/change-password  { currentPassword, newPassword } -> { ok: true }
export const changePassword = ({ currentPassword, newPassword }) =>
  USE_MOCK
    ? mock.changePassword({ currentPassword, newPassword })
    : request('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } })
