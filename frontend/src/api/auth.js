import { normalizeUser } from '@/lib/schema'
import { pick, request } from './client'

/**
 * User (prisma): { id, email, fullName, role: ADMIN|EXAMINER|CANDIDATE, isActive, createdAt, updatedAt }
 * UI may also read `name` as an alias of `fullName` (ensured by normalizeUser).
 */

// POST /api/auth/login   { email, password } -> { user }
export const login = ({ email, password }) =>
  request('/api/auth/login', { method: 'POST', body: { email, password }, skipUnauthorizedHandler: true }).then((r) =>
    normalizeUser(pick(r, 'user')),
  )

// POST /api/auth/logout
export const logout = () => request('/api/auth/logout', { method: 'POST', skipUnauthorizedHandler: true })

// GET /api/auth/me -> { user }
export const me = () =>
  request('/api/auth/me', { skipUnauthorizedHandler: true }).then((r) => normalizeUser(pick(r, 'user')))

