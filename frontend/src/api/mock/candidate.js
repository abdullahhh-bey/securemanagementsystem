import { accessStatus, enrollments, examStatus, exams, requireRole } from './db'
import { clone, delay, fail } from './helpers'
import { formatDateTime } from '@/lib/format'

function dto(e) {
  return {
    id: e.id,
    title: e.title,
    instructions: e.instructions,
    startAt: e.startAt,
    endAt: e.endAt,
    durationMinutes: e.durationMinutes,
    totalMarks: e.totalMarks,
    settings: e.settings,
    status: examStatus(e),
    accessStatus: accessStatus(e),
  }
}

function visibleTo(me) {
  return exams.filter((e) => e.published && enrollments.get(e.id)?.has(me.id))
}

export async function listCandidateExams() {
  const me = requireRole('CANDIDATE')
  await delay()
  return clone(visibleTo(me).map(dto))
}

/** Entering an exam: the server re-checks access and rejects with a message. */
export async function getCandidateExam(id) {
  const me = requireRole('CANDIDATE')
  await delay(250, 500)
  const found = visibleTo(me).find((e) => e.id === id)
  if (!found) fail(404, 'NOT_FOUND', "We couldn't find that exam in your list.")
  const access = accessStatus(found)
  if (access === 'UPCOMING') {
    fail(403, 'EXAM_NOT_OPEN', `This exam hasn't opened yet. It opens on ${formatDateTime(found.startAt)}.`)
  }
  if (access === 'CLOSED') {
    fail(403, 'EXAM_CLOSED', 'This exam window has closed, so you can no longer enter.')
  }
  return clone(dto(found))
}
