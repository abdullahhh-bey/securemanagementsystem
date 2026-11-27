import { normalizeUser } from '@/lib/schema'
import { pick, request } from './client'

/** Backend `userListQuery` allows at most 100 per page. */
const ADMIN_USERS_PAGE_SIZE = 100

/**
 * GET /api/admin/users -> User[]
 * Backend returns `{ data, pagination }`. Pages expect a full array, so real mode
 * walks every page (pageSize = max) and concatenates before returning.
 */
export async function listUsers() {
  const users = []
  let page = 1
  let totalPages

  do {
    const response = await request('/api/admin/users', {
      params: { page, pageSize: ADMIN_USERS_PAGE_SIZE },
    })
    const batch = Array.isArray(response?.data) ? response.data : []
    for (const user of batch) users.push(normalizeUser(user))

    totalPages = Math.max(1, Number(response?.pagination?.totalPages) || 1)
    if (batch.length === 0) break
    page += 1
  } while (page <= totalPages)

  return users
}

/**
 * POST /api/admin/users
 * UI input: { name, email, role, password }
 * Backend body:  { fullName, email, role, password }
 * Backend success: { data: user } → normalized User (name + fullName)
 */
export async function createUser(input) {
  const response = await request('/api/admin/users', {
    method: 'POST',
    body: {
      fullName: input.name,
      email: input.email,
      role: input.role,
      password: input.password,
    },
  })
  return normalizeUser(response?.data)
}

/**
 * UI patch: { role?, isActive? }
 * Real mode maps to:
 *   PATCH /api/admin/users/:id/role   { role }
 *   PATCH /api/admin/users/:id/status { isActive }
 * When both are present they are called sequentially. Each success body is `{ data: user }`.
 */
export async function updateUser(id, patch = {}) {
  let user = null

  if (patch.role !== undefined) {
    const response = await request(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: { role: patch.role },
    })
    user = response?.data
  }

  if (patch.isActive !== undefined) {
    const response = await request(`/api/admin/users/${id}/status`, {
      method: 'PATCH',
      body: { isActive: patch.isActive },
    })
    user = response?.data
  }

  return normalizeUser(user)
}


/**
 * GET /api/admin/audit?actorId=&action=&from=ISO&to=ISO
 * -> { total, entries: [{ id, at, actorId, actorName, actorRole, action, target, detail }],
 *      actors: [{ id, name }], actions: string[] }
 */
export async function listAuditLog(filters = {}) {
  const params = {
    ...(filters.actorId ? { actorId: filters.actorId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
    ...(filters.from ? { from: filters.from } : {}),
    ...(filters.to ? { to: filters.to } : {}),
  }

  const response = await request('/api/admin/audit', { params })

  return {
    total: Number(response?.total) || 0,
    entries: Array.isArray(response?.entries) ? response.entries : [],
    actors: Array.isArray(response?.actors) ? response.actors : [],
    actions: Array.isArray(response?.actions) ? response.actions : [],
  }
}

// GET /api/admin/exams  (read-only, every examiner's exams)
//   -> [{ id, title, status, owner: { id, name }, startAt, endAt, candidateCount, questionCount,
//         resultsState: NOT_READY | UNGRADED | GRADED | PUBLISHED }]
export const listAllExams = () => request('/api/admin/exams').then((r) => pick(r, 'exams'))
