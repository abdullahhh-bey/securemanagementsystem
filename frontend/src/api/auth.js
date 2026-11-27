import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/auth'

// POST /api/auth/login   { email, password } -> { user }
export const login = ({ email, password }) =>
  USE_MOCK
    ? mock.login({ email, password })
    : request('/api/auth/login', { method: 'POST', body: { email, password }, skipUnauthorizedHandler: true }).then((r) => pick(r, 'user'))

// POST /api/auth/logout
export const logout = () => (USE_MOCK ? mock.logout() : request('/api/auth/logout', { method: 'POST', skipUnauthorizedHandler: true }))

// GET /api/auth/me -> { user }
export const me = () =>
  USE_MOCK ? mock.me() : request('/api/auth/me', { skipUnauthorizedHandler: true }).then((r) => pick(r, 'user'))
