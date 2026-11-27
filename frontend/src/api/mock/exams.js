import { currentUser, enrollments, examStatus, exams, nextId, requireRole, toExamDto, users } from './db'
import { clone, delay, fail, serverNow } from './helpers'
import { record } from './audit'

export function ownedExam(id) {
  const me = requireRole('EXAMINER')
  const found = exams.find((e) => e.id === id)
  if (!found) fail(404, 'NOT_FOUND', 'This exam no longer exists.')
  if (found.ownerId !== me.id) fail(403, 'FORBIDDEN', 'This exam belongs to another examiner.')
  return found
}

function windowFields(input) {
  return {
    startAt: input.startsAt ?? input.startAt,
    endAt: input.endsAt ?? input.endAt,
  }
}

function settingsFromInput(input) {
  return {
    shuffleQuestions: Boolean(input.randomizeQuestions ?? input.settings?.shuffleQuestions),
    shuffleOptions: Boolean(input.randomizeOptions ?? input.settings?.shuffleOptions),
    negativeMarking: Boolean(input.negativeMarking ?? input.settings?.negativeMarking),
  }
}

function validate(input) {
  const details = {}
  if (!input.title?.trim()) details.title = 'Title is required.'
  const { startAt, endAt } = windowFields(input)
  const start = new Date(startAt).getTime()
  const end = new Date(endAt).getTime()
  if (Number.isNaN(start)) details.startAt = 'Start time is not valid.'
  if (Number.isNaN(end)) details.endAt = 'End time is not valid.'
  if (!details.startAt && !details.endAt) {
    if (end <= start) details.endAt = 'The end time must be after the start time.'
    else if (input.durationMinutes > Math.floor((end - start) / 60000)) {
      details.durationMinutes = "Duration can't exceed the exam window."
    }
  }
  if (!(input.durationMinutes > 0)) details.durationMinutes = 'Duration must be at least 1 minute.'
  if (!(input.totalMarks > 0)) details.totalMarks = 'Total marks must be at least 1.'
  if (Object.keys(details).length > 0) {
    fail(422, 'VALIDATION_ERROR', 'Some of the exam details are not valid.', details)
  }
}

export async function listExams() {
  const me = requireRole('EXAMINER')
  await delay()
  return clone(
    exams
      .filter((e) => e.ownerId === me.id)
      .map(toExamDto)
      .sort((a, b) => new Date(b.startAt) - new Date(a.startAt)),
  )
}

export async function getExam(id) {
  await delay(150, 350)
  return clone(toExamDto(ownedExam(id)))
}

export async function createExam(input) {
  const me = requireRole('EXAMINER')
  await delay()
  validate(input)
  const now = new Date(serverNow()).toISOString()
  const { startAt, endAt } = windowFields(input)
  const created = {
    id: nextId('ex'),
    ownerId: me.id,
    title: input.title.trim(),
    description: input.description?.trim() ?? '',
    instructions: input.instructions?.trim() ?? '',
    startAt,
    endAt,
    durationMinutes: input.durationMinutes,
    maxAttempts: input.maxAttempts ?? 1,
    totalMarks: input.totalMarks,
    settings: settingsFromInput(input),
    published: false,
    createdAt: now,
    updatedAt: now,
  }
  exams.push(created)
  enrollments.set(created.id, new Map())
  record(me, 'EXAM_CREATED', created.title)
  return clone(toExamDto(created))
}

export async function updateExam(id, input) {
  const target = ownedExam(id)
  await delay()
  if (examStatus(target) !== 'DRAFT') {
    fail(409, 'EXAM_LOCKED', 'Published exams can no longer be edited.')
  }
  const merged = { ...target, ...input, startAt: input.startsAt ?? input.startAt ?? target.startAt, endAt: input.endsAt ?? input.endAt ?? target.endAt }
  validate(merged)
  const { startAt, endAt } = windowFields(merged)
  Object.assign(target, {
    title: input.title.trim(),
    description: input.description?.trim() ?? target.description ?? '',
    instructions: input.instructions?.trim() ?? '',
    startAt,
    endAt,
    durationMinutes: input.durationMinutes,
    maxAttempts: input.maxAttempts ?? target.maxAttempts ?? 1,
    totalMarks: input.totalMarks,
    settings: { ...target.settings, ...settingsFromInput(input) },
    updatedAt: new Date(serverNow()).toISOString(),
  })
  return clone(toExamDto(target))
}

export async function deleteExam(id) {
  const target = ownedExam(id)
  await delay()
  if (examStatus(target) !== 'DRAFT') {
    fail(409, 'EXAM_LOCKED', 'Only draft exams can be deleted.')
  }
  exams.splice(exams.indexOf(target), 1)
  enrollments.delete(id)
  return null
}

export async function publishExam(id) {
  const target = ownedExam(id)
  await delay(350, 700)
  if (examStatus(target) !== 'DRAFT') fail(409, 'ALREADY_PUBLISHED', 'This exam has already been published.')
  if (new Date(target.startAt).getTime() <= serverNow()) {
    fail(422, 'START_IN_PAST', 'The start time has already passed. Update the schedule before publishing.', {
      startAt: 'Choose a start time in the future.',
    })
  }
  target.published = true
  record(currentUser(), 'EXAM_PUBLISHED', target.title)
  target.updatedAt = new Date(serverNow()).toISOString()
  return clone(toExamDto(target))
}

// --- candidates ------------------------------------------------------------

const candidateDto = (u, enrolledAt) => ({ id: u.id, name: u.name, email: u.email, ...(enrolledAt ? { enrolledAt } : {}) })

export async function listExamCandidates(id) {
  ownedExam(id)
  await delay()
  const map = enrollments.get(id) ?? new Map()
  return clone(
    [...map.entries()]
      .map(([uid, enrolledAt]) => candidateDto(users.find((u) => u.id === uid), enrolledAt))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}

/** Active CANDIDATE accounts that are not yet enrolled in this exam. */
export async function listAvailableCandidates(id) {
  ownedExam(id)
  await delay()
  const map = enrollments.get(id) ?? new Map()
  return clone(
    users
      .filter((u) => u.role === 'CANDIDATE' && u.isActive && !map.has(u.id))
      .map((u) => candidateDto(u))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )
}

export async function enrollCandidates(id, candidateIds) {
  const target = ownedExam(id)
  await delay()
  if (examStatus(target) === 'COMPLETED') fail(409, 'EXAM_LOCKED', 'This exam has finished; enrollment is closed.')
  const map = enrollments.get(id) ?? new Map()
  const now = new Date(serverNow()).toISOString()
  for (const uid of candidateIds) {
    const u = users.find((x) => x.id === uid)
    if (!u || u.role !== 'CANDIDATE') fail(422, 'INVALID_CANDIDATE', 'One of the selected people is not a candidate.')
    if (!map.has(uid)) map.set(uid, now)
  }
  enrollments.set(id, map)
  return { enrolled: candidateIds.length }
}

export async function removeExamCandidate(id, candidateId) {
  const target = ownedExam(id)
  await delay()
  const status = examStatus(target)
  if (status === 'ONGOING' || status === 'COMPLETED') {
    fail(409, 'EXAM_LOCKED', "Candidates can't be removed once the exam has started.")
  }
  enrollments.get(id)?.delete(candidateId)
  return null
}
