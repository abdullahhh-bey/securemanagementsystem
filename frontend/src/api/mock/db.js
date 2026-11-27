import { fail, getSessionUserId, serverNow } from './helpers'

/**
 * In-memory fictional data for mock mode. Exam times are generated relative to
 * "now" at load time so the demo always has a live, an upcoming and a
 * just-about-to-open exam.
 */

const MIN = 60 * 1000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

const at = (offsetMs) => new Date(serverNow() + offsetMs).toISOString()

const user = (id, name, email, role, password, isActive = true, daysAgo = 30) => ({
  id,
  name,
  email,
  role,
  password,
  isActive,
  createdAt: at(-daysAgo * DAY),
})

export const users = [
  user('u_1', 'Naomi Brandt', 'admin@demo.com', 'ADMIN', 'Admin@123', true, 210),
  user('u_2', 'Elias Novak', 'elias.novak@northfield.test', 'ADMIN', 'Password@123', true, 120),
  user('u_3', 'Dr. Ingrid Solberg', 'examiner@demo.com', 'EXAMINER', 'Examiner@123', true, 180),
  user('u_4', 'Prof. Rafael Mendes', 'rafael.mendes@northfield.test', 'EXAMINER', 'Password@123', true, 95),
  user('u_5', 'Yuki Tanaka', 'yuki.tanaka@northfield.test', 'EXAMINER', 'Password@123', false, 60),
  user('u_6', 'Amara Okafor', 'candidate1@demo.com', 'CANDIDATE', 'Candidate@123', true, 75),
  user('u_7', 'Leo Marchetti', 'candidate2@demo.com', 'CANDIDATE', 'Candidate@123', true, 74),
  user('u_8', 'Priya Raman', 'priya.raman@northfield.test', 'CANDIDATE', 'Password@123', true, 70),
  user('u_9', 'Tomás Herrera', 'tomas.herrera@northfield.test', 'CANDIDATE', 'Password@123', true, 70),
  user('u_10', 'Hana Sato', 'hana.sato@northfield.test', 'CANDIDATE', 'Password@123', true, 44),
  user('u_11', 'Daniel Whitfield', 'daniel.whitfield@northfield.test', 'CANDIDATE', 'Password@123', true, 44),
  user('u_12', 'Zainab Qureshi', 'zainab.qureshi@northfield.test', 'CANDIDATE', 'Password@123', true, 21),
  user('u_13', 'Mei Lin Chen', 'meilin.chen@northfield.test', 'CANDIDATE', 'Password@123', false, 21),
  user('u_14', 'Oskar Lindqvist', 'oskar.lindqvist@northfield.test', 'CANDIDATE', 'Password@123', true, 9),
  user('u_15', 'Chiara Bellini', 'chiara.bellini@northfield.test', 'CANDIDATE', 'Password@123', true, 3),
]

const exam = (id, ownerId, title, instructions, startOffset, endOffset, durationMinutes, totalMarks, published, settings = {}) => ({
  id,
  ownerId,
  title,
  instructions,
  startAt: at(startOffset),
  endAt: at(endOffset),
  durationMinutes,
  totalMarks,
  settings: { shuffleQuestions: true, shuffleOptions: true, negativeMarking: false, ...settings },
  published,
  createdAt: at(-9 * DAY),
  updatedAt: at(-2 * DAY),
})

export const exams = [
  exam(
    'ex_101',
    'u_3',
    'Data Structures \u2014 Midterm',
    'Answer all questions. Calculators are not permitted. Once you start, the timer cannot be paused, so make sure you have a stable connection before you enter.',
    -25 * MIN,
    95 * MIN,
    90,
    100,
    true,
    { negativeMarking: true },
  ),
  exam(
    'ex_102',
    'u_3',
    'Operating Systems \u2014 Quiz 3',
    'Covers scheduling, synchronization and deadlocks. Each question has a single correct option. Review your answers before submitting.',
    2 * HOUR + 10 * MIN,
    4 * HOUR + 10 * MIN,
    60,
    40,
    true,
  ),
  exam(
    'ex_107',
    'u_3',
    'Algorithms \u2014 Viva Warm-up',
    'A short warm-up so you can test your setup before the real viva. Marks do not count towards your final grade.',
    150 * 1000,
    40 * MIN,
    20,
    20,
    true,
    { shuffleOptions: false },
  ),
  exam(
    'ex_103',
    'u_3',
    'Discrete Mathematics \u2014 Final',
    'Closed book. You may use the formula sheet that is provided inside the exam. Show your reasoning where the question asks for it.',
    3 * DAY + 2 * HOUR,
    3 * DAY + 6 * HOUR,
    150,
    120,
    true,
    { negativeMarking: true },
  ),
  exam(
    'ex_104',
    'u_3',
    'Database Systems \u2014 Lab Assessment',
    'Practical SQL assessment. Questions are released one at a time and cannot be revisited.',
    5 * DAY,
    5 * DAY + 3 * HOUR,
    120,
    80,
    false,
  ),
  exam(
    'ex_108',
    'u_3',
    'Linear Algebra \u2014 Practice Test',
    'Untimed practice set for revision week. Attempt as many times as you like.',
    -1 * DAY,
    6 * DAY,
    45,
    50,
    false,
    { shuffleQuestions: false, shuffleOptions: false },
  ),
  exam(
    'ex_105',
    'u_3',
    'Computer Networks \u2014 Midterm',
    'Covers layers 1\u20134, addressing and routing fundamentals. Results are released within five working days.',
    -1 * DAY - 3 * HOUR,
    -1 * DAY - HOUR,
    90,
    100,
    true,
  ),
  exam(
    'ex_106',
    'u_3',
    'Software Engineering \u2014 Pop Quiz',
    'Short quiz on requirements engineering and testing strategies.',
    -14 * DAY,
    -14 * DAY + 2 * HOUR,
    30,
    25,
    true,
    { shuffleOptions: false },
  ),
  exam(
    'ex_201',
    'u_4',
    'Machine Learning \u2014 Midterm',
    'Belongs to a different examiner; used to verify ownership rules.',
    4 * DAY,
    4 * DAY + 3 * HOUR,
    90,
    100,
    true,
  ),
]

/** examId -> Map(candidateId -> enrolledAt ISO) */
export const enrollments = new Map([
  ['ex_101', ['u_6', 'u_7', 'u_8', 'u_9', 'u_10']],
  ['ex_102', ['u_6', 'u_7', 'u_11', 'u_12']],
  ['ex_107', ['u_6', 'u_8']],
  ['ex_103', ['u_6', 'u_7', 'u_8', 'u_9', 'u_10', 'u_11', 'u_12', 'u_14']],
  ['ex_104', []],
  ['ex_108', ['u_9', 'u_15']],
  ['ex_105', ['u_6', 'u_7', 'u_9', 'u_10', 'u_13']],
  ['ex_106', ['u_6', 'u_8', 'u_11']],
  ['ex_201', ['u_6', 'u_14']],
].map(([id, ids]) => [id, new Map(ids.map((uid) => [uid, at(-3 * DAY)]))]))

let sequence = 1000
export const nextId = (prefix) => `${prefix}_${++sequence}`

// --- shared helpers --------------------------------------------------------

export const publicUser = ({ password: _password, ...rest }) => rest

export function currentUser() {
  const id = getSessionUserId()
  const found = users.find((u) => u.id === id && u.isActive)
  if (!found) fail(401, 'UNAUTHENTICATED', 'Your session has expired. Please sign in again.')
  return found
}

export function requireRole(role) {
  const me = currentUser()
  if (me.role !== role) fail(403, 'FORBIDDEN', "You don't have permission to access this resource.")
  return me
}

export function examStatus(e, now = serverNow()) {
  if (!e.published) return 'DRAFT'
  if (now < new Date(e.startAt).getTime()) return 'PUBLISHED'
  if (now <= new Date(e.endAt).getTime()) return 'ONGOING'
  return 'COMPLETED'
}

export function accessStatus(e, now = serverNow()) {
  if (now < new Date(e.startAt).getTime()) return 'UPCOMING'
  if (now <= new Date(e.endAt).getTime()) return 'AVAILABLE'
  return 'CLOSED'
}

export function toExamDto(e) {
  const { ownerId, published: _published, ...rest } = e
  return {
    ...rest,
    createdBy: users.find((u) => u.id === ownerId)?.name ?? 'Unknown',
    status: examStatus(e),
    candidateCount: enrollments.get(e.id)?.size ?? 0,
  }
}
