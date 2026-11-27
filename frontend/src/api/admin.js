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


// GET /api/admin/audit?actorId=&action=&from=ISO&to=ISO     (read-only; newest first; from/to inclusive)
//   -> { total, entries: [{ id, at, actorId, actorName, actorRole, action, target, detail }],
//        actors: [{ id, name }], actions: string[] }          (actors/actions list every value, for the filter menus)
export const listAuditLog = (filters = {}) =>
  USE_MOCK ? mock.listAuditLog(filters) : request('/api/admin/audit', { params: filters })

// GET /api/admin/exams  (read-only, every examiner's exams)
//   -> [{ id, title, status, owner: { id, name }, startAt, endAt, candidateCount, questionCount,
//         resultsState: NOT_READY | UNGRADED | GRADED | PUBLISHED }]
export const listAllExams = () => (USE_MOCK ? mock.listAllExams() : request('/api/admin/exams').then((r) => pick(r, 'exams')))

// POST /api/admin/users/import  { users: [{ name, email, role, password }] } -> { created }
// All-or-nothing: 422 with `details: [{ row, messages: string[] }]` and nobody is created. The UI sends only rows it validated.
export const importUsers = (rows) =>
  USE_MOCK ? mock.importUsers(rows) : request('/api/admin/users/import', { method: 'POST', body: { users: rows } })

// POST /api/admin/users/:id/reset-password -> { temporaryPassword, expiresAt }
// The temporary password is returned ONCE; it is not retrievable afterwards. The user must change it at next sign-in.
export const resetPassword = (id) =>
  USE_MOCK ? mock.resetPassword(id) : request(`/api/admin/users/${id}/reset-password`, { method: 'POST' })
