import { users, requireRole } from './db'
import { clone, delay } from './helpers'

export async function listTeacherStudents() {
  requireRole('EXAMINER')
  await delay()
  return clone(
    users
      .filter((user) => user.role === 'CANDIDATE' && user.isActive)
      .map(({ id, name, fullName, email }) => ({ id, name, fullName, email })),
  )
}
