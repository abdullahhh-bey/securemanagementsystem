import { USE_MOCK, pick, request } from './client'
import * as mock from './mock/admin'

// GET /api/admin/users -> User[]
export const listUsers = () => (USE_MOCK ? mock.listUsers() : request('/api/admin/users').then((r) => pick(r, 'users')))

// POST /api/admin/users  { name, email, role, password } -> User
export const createUser = (input) =>
  USE_MOCK ? mock.createUser(input) : request('/api/admin/users', { method: 'POST', body: input }).then((r) => pick(r, 'user'))

// PATCH /api/admin/users/:id  { role?, isActive? } -> User
export const updateUser = (id, patch) =>
  USE_MOCK
    ? mock.updateUser(id, patch)
    : request(`/api/admin/users/${id}`, { method: 'PATCH', body: patch }).then((r) => pick(r, 'user'))
