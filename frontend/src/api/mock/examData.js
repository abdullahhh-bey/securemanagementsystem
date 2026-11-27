import { exams, users } from './db'
import { serverNow } from './helpers'

/**
 * Fictional exam content for mock mode: question bank, exam papers, attempts,
 * incidents, disputes... plus the scoring rules. This file stands in for the
 * server's database and business logic.
 */

export const MIN = 60 * 1000
export const HOUR = 60 * MIN
export const DAY = 24 * HOUR
const at = (offsetMs) => new Date(serverNow() + offsetMs).toISOString()

// --- deterministic randomness (so the demo data is stable) -------------------

export function hash(text) {
  let h = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function rng(seed) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function shuffled(list, random) {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export const round2 = (n) => Math.round(n * 100) / 100

// --- question bank -----------------------------------------------------------

/**
 * Question: { id, ownerId, type: MCQ_SINGLE | MCQ_MULTI | WRITTEN, text, topic,
 *   difficulty: easy | medium | hard, defaultMarks,
 *   options: [{ id, text, isCorrect }]            (MCQ only)
 *   penalty (MCQ_SINGLE only; fraction of marks lost for a wrong answer)
 *   modelAnswer (WRITTEN only, optional), createdAt }
 */
export const questions = []

function addQuestion({ id, ownerId = 'u_3', type, topic, difficulty, text, options = [], correct = [], rule, penalty = 0.25, marks, model = '' }) {
  questions.push({
    id,
    ownerId,
    type,
    topic,
    difficulty,
    text,
    defaultMarks: marks,
    options: options.map((optionText, i) => ({ id: `${id}_o${i + 1}`, text: optionText, isCorrect: correct.includes(i) })),
    markingRule: type === 'MCQ_MULTI' ? (rule ?? 'ALL_OR_NOTHING') : null,
    penalty: type === 'MCQ_SINGLE' ? penalty : type === 'MCQ_MULTI' && rule === 'PARTIAL' ? penalty : 0,
    modelAnswer: model,
    createdAt: at(-20 * DAY),
  })
}
const single = (id, topic, difficulty, text, options, correct, marks) =>
  addQuestion({ id, type: 'MCQ_SINGLE', topic, difficulty, text, options, correct: [correct], marks })
const written = (id, topic, difficulty, text, marks, model) => addQuestion({ id, type: 'WRITTEN', topic, difficulty, text, marks, model })

// Networks
single('q_net_osi', 'Networks', 'easy', 'Which layer of the OSI model is responsible for routing packets between networks?', ['Data link', 'Network', 'Transport', 'Session'], 1, 12)
single('q_net_https', 'Networks', 'easy', 'What is the default TCP port for HTTPS?', ['80', '8080', '443', '22'], 2, 12)
single('q_net_arp', 'Networks', 'medium', 'Which protocol resolves an IP address to a MAC address on a local network?', ['DNS', 'ARP', 'DHCP', 'ICMP'], 1, 12)
single('q_net_transport', 'Networks', 'medium', 'Which protocol provides reliable, connection-oriented delivery at the transport layer?', ['TCP', 'UDP', 'IP', 'HTTP', 'ICMP'], 0, 12)
single('q_net_slow', 'Networks', 'hard', 'During TCP slow start, how does the congestion window grow?', ['Linearly each RTT', 'Exponentially each RTT', 'It stays constant', 'It halves each RTT'], 1, 14)
single('q_net_flow', 'Networks', 'medium', 'Which TCP mechanism prevents a fast sender from overwhelming a slow receiver?', ['Congestion window', 'Sliding window (flow control)', 'Slow start', 'Checksum'], 1, 14)
single('q_net_subnet', 'Networks', 'medium', 'How many usable host addresses does a /26 IPv4 subnet provide?', ['62', '64', '30', '126'], 0, 14)
single('q_net_bgp', 'Networks', 'hard', 'Which statement about BGP is true?', ['It is a path-vector protocol', 'It is used between autonomous systems', 'It uses hop count as its only metric', 'It runs over TCP'], 0, 14)
written('q_net_hs', 'Networks', 'medium', 'Explain how the TCP three-way handshake establishes a connection and why it is needed.', 12, 'SYN, SYN-ACK, ACK exchange; synchronises sequence numbers and confirms both sides can send and receive.')
written('q_net_rt', 'Networks', 'hard', 'Compare distance-vector and link-state routing. Give one advantage of each.', 12, 'Distance-vector: simple, low overhead. Link-state: full topology, fast convergence, no count-to-infinity.')

// Data structures
single('q_ds_stack', 'Data Structures', 'easy', 'Which data structure follows last-in, first-out order?', ['Queue', 'Stack', 'Heap', 'Graph'], 1, 15)
single('q_ds_bsearch', 'Data Structures', 'easy', 'What is the time complexity of binary search on a sorted array?', ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], 1, 15)
single('q_ds_hash', 'Data Structures', 'medium', 'What is the worst-case lookup time in a hash table that resolves collisions by chaining?', ['O(1)', 'O(log n)', 'O(n)', 'O(n log n)'], 2, 15)
single('q_ds_stable', 'Data Structures', 'medium', 'Which sorting algorithm is stable?', ['Merge sort', 'Insertion sort', 'Quick sort (typical)', 'Heap sort'], 0, 15)
single('q_ds_avl', 'Data Structures', 'hard', 'What is the minimum number of nodes in an AVL tree of height 4 (a single node has height 0)?', ['9', '12', '15', '20'], 1, 20)
written('q_ds_quick', 'Data Structures', 'medium', "Explain when quicksort hits its worst case and how choosing a random pivot helps.", 20, 'Sorted or reverse-sorted input with a fixed pivot gives O(n^2); a random pivot makes bad splits unlikely, giving expected O(n log n).')

// Operating systems
single('q_os_sjf', 'Operating Systems', 'easy', 'Which scheduling algorithm can starve long-running processes?', ['Round robin', 'Shortest job first', 'First come first served', 'Multilevel feedback with ageing'], 1, 10)
single('q_os_belady', 'Operating Systems', 'medium', "Belady's anomaly can occur with which page replacement policy?", ['LRU', 'Optimal', 'FIFO', 'Clock with reference bits'], 2, 10)
single('q_os_coffman', 'Operating Systems', 'medium', 'Which is a necessary condition for deadlock?', ['Mutual exclusion', 'Hold and wait', 'No preemption', 'Circular wait', 'Demand paging'], 0, 10)
written('q_os_thread', 'Operating Systems', 'medium', 'Distinguish a process from a thread and give one benefit of using threads.', 10, 'Threads share the address space of their process; cheaper creation and communication than processes.')

// Databases
single('q_db_3nf', 'Databases', 'medium', 'Which normal form removes transitive dependencies?', ['1NF', '2NF', '3NF', 'BCNF only'], 2, 20)
single('q_db_having', 'Databases', 'easy', 'Which SQL clause filters groups after aggregation?', ['WHERE', 'HAVING', 'GROUP BY', 'ORDER BY'], 1, 20)
single('q_db_acid', 'Databases', 'easy', 'Which is an ACID property?', ['Atomicity', 'Consistency', 'Isolation', 'Durability', 'Availability'], 0, 20)
single('q_db_serial', 'Databases', 'hard', 'Which isolation level prevents phantom reads?', ['Read uncommitted', 'Read committed', 'Repeatable read (basic)', 'Serializable'], 3, 20)

// Software engineering
single('q_se_func', 'Software Engineering', 'easy', 'Which of these is a non-functional requirement?', ['The system shall send a receipt by email', 'Pages shall load within 2 seconds', 'Users can reset their password', 'Admins can export reports'], 1, 5)
single('q_se_integ', 'Software Engineering', 'medium', 'Which testing level verifies the interaction between modules?', ['Unit testing', 'Integration testing', 'Acceptance testing', 'Smoke testing'], 1, 5)
single('q_se_agile', 'Software Engineering', 'easy', 'In Scrum, who is responsible for ordering the product backlog?', ['Scrum master', 'Product owner', 'Developers', 'Stakeholders'], 1, 5)
single('q_se_solid', 'Software Engineering', 'medium', 'Which is one of the SOLID design principles?', ['Single responsibility', 'Open/closed', 'Dependency inversion', 'Don\u2019t repeat yourself'], 0, 5)
written('q_se_review', 'Software Engineering', 'medium', 'Give two benefits of code review besides finding bugs.', 5, 'Knowledge sharing; consistent style; mentoring.')

// A different examiner's questions (used to check ownership).
addQuestion({ id: 'q_ml_1', ownerId: 'u_4', type: 'MCQ_SINGLE', topic: 'Machine Learning', difficulty: 'easy', text: 'Which of these is a supervised learning task?', options: ['Clustering', 'Classification', 'Dimensionality reduction'], correct: [1], marks: 10 })

export const questionById = (id) => questions.find((q) => q.id === id)

// --- exam papers ---------------------------------------------------------------

/** examId -> [{ questionId, marks, group }]. `group` marks alternative variants: a candidate gets one per group. */
export const examQuestions = new Map([
  ['ex_101', ['q_ds_stack:15', 'q_ds_bsearch:15', 'q_ds_hash:15', 'q_ds_stable:15', 'q_ds_avl:20', 'q_ds_quick:20']],
  ['ex_102', ['q_os_sjf:10', 'q_os_belady:10', 'q_os_coffman:10', 'q_os_thread:10']],
  ['ex_104', ['q_db_3nf:20', 'q_db_having:20', 'q_db_acid:20', 'q_db_serial:20']],
  [
    'ex_105',
    ['q_net_osi:12', 'q_net_https:12', 'q_net_arp:12', 'q_net_transport:12', 'q_net_hs:12', 'q_net_rt:12', 'q_net_slow:14', 'q_net_subnet:14'],
  ],
  ['ex_106', ['q_se_func:5', 'q_se_integ:5', 'q_se_agile:5', 'q_se_solid:5', 'q_se_review:5']],
].map(([examId, items]) => [
  examId,
  items.map((entry) => {
    const [questionId, marks] = entry.split(':')
    return { questionId, marks: Number(marks) }
  }),
]))

export function assignedFor(examId) {
  return examQuestions.get(examId) ?? []
}

/** Marks a single paper is worth: ungrouped questions plus one question per group. */
export function paperMarks(items) {
  const groups = new Map()
  let total = 0
  for (const item of items) {
    if (!item.group) total += item.marks
    else if (!groups.has(item.group)) groups.set(item.group, item.marks)
  }
  for (const marks of groups.values()) total += marks
  return total
}

// --- scoring -------------------------------------------------------------------

export const PASS_PERCENT = 40
export const DIFFICULTY_WEIGHT = { easy: 1, medium: 2, hard: 3 }

/** Marks for one answered question. Returns null for a written answer nobody has graded yet. */
export function markQuestion(question, marks, answer, writtenGrade, negativeMarking) {
  if (question.type === 'WRITTEN') {
    if (!answer?.text?.trim()) return 0
    return writtenGrade ? writtenGrade.score : null
  }
  const selected = answer?.selected ?? []
  if (selected.length === 0) return 0
  const wrongPenalty = negativeMarking ? round2(marks * (question.penalty ?? 0.25)) : 0
  const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id)
  if (question.type === 'MCQ_SINGLE') return selected[0] === correctIds[0] ? marks : -wrongPenalty
  const hits = selected.filter((id) => correctIds.includes(id)).length
  const misses = selected.length - hits
  if (question.markingRule === 'PARTIAL') {
    return round2(Math.max(0, marks * (hits / correctIds.length) - marks * question.penalty * misses))
  }
  return hits === correctIds.length && misses === 0 ? marks : -wrongPenalty
}

export function gradeLetter(percent) {
  if (percent >= 85) return 'A'
  if (percent >= 70) return 'B'
  if (percent >= 55) return 'C'
  if (percent >= PASS_PERCENT) return 'D'
  return 'F'
}

// --- attempts ------------------------------------------------------------------

/**
 * Attempt: { id, examId, candidateId, sandbox, status: IN_PROGRESS | SUBMITTED, startedAt, submittedAt,
 *   paper: [{ questionId, marks, optionOrder }], answers: { [questionId]: { selected, text } },
 *   written: { [questionId]: { score, feedback, gradedAt } },
 *   incidents: [{ id, type, at, detail }], gaps: [{ id, from, to|null }], compensations: [...],
 *   versions: [{ version, createdAt, reason, perQuestion, total }],   <- created when results are published
 *   live: { startedMinAgo, rate, lastSeenSec, offline }               <- drives the mock live monitor only }
 */
export const attempts = []

/** Everything that feeds results, statistics and monitoring ignores sandbox attempts. */
export const realAttempts = (examId) => attempts.filter((a) => a.examId === examId && !a.sandbox)

export function buildPaper(examId, candidateId, random, { shuffleQuestions, shuffleOptions } = {}) {
  const items = assignedFor(examId)
  const chosen = []
  const byGroup = new Map()
  for (const item of items) {
    if (!item.group) chosen.push(item)
    else byGroup.set(item.group, [...(byGroup.get(item.group) ?? []), item])
  }
  for (const variants of byGroup.values()) chosen.push(variants[Math.floor(random() * variants.length)])
  const ordered = shuffleQuestions ? shuffled(chosen, random) : chosen
  return ordered.map((item) => {
    const question = questionById(item.questionId)
    const ids = question.options.map((o) => o.id)
    return { questionId: item.questionId, marks: item.marks, optionOrder: shuffleOptions ? shuffled(ids, random) : ids }
  })
}

const ANSWER_TEXT = {
  good: [
    'The client sends a SYN, the server answers with SYN-ACK and the client confirms with an ACK. This synchronises both sides\u2019 sequence numbers and proves each direction works before data flows.',
    'Distance-vector shares whole tables with neighbours, which is simple but slow to converge. Link-state floods the topology so every router can compute shortest paths itself, converging faster.',
    'Quicksort degrades to O(n squared) when the pivot is always the smallest or largest item, for example on sorted input. A random pivot makes that very unlikely, so the expected time is O(n log n).',
    'A process owns its own address space; threads inside it share memory, which makes them cheaper to create and lets them communicate quickly.',
    'Reviews spread knowledge across the team and keep the style consistent, which also helps new members learn the codebase.',
  ],
  weak: [
    'The client and server say hello to each other before sending data.',
    'One protocol is faster than the other.',
    'It is slow when the data is big.',
    'Threads are small processes.',
    'It makes the code better.',
  ],
}

function fillAnswers(attempt, ability) {
  const random = rng(hash(attempt.id))
  attempt.answers = {}
  for (const { questionId } of attempt.paper) {
    const question = questionById(questionId)
    const penalty = question.difficulty === 'hard' ? 0.3 : question.difficulty === 'medium' ? 0.15 : 0
    const skip = random() < 0.04 + (question.difficulty === 'hard' ? 0.14 : 0)
    if (skip) continue
    const correct = random() < ability - penalty
    if (question.type === 'WRITTEN') {
      const pool = correct ? ANSWER_TEXT.good : ANSWER_TEXT.weak
      attempt.answers[questionId] = { text: pool[Math.floor(random() * pool.length)] }
      continue
    }
    const correctIds = question.options.filter((o) => o.isCorrect).map((o) => o.id)
    const wrongIds = question.options.filter((o) => !o.isCorrect).map((o) => o.id)
    if (correct) attempt.answers[questionId] = { selected: correctIds }
    else if (question.type === 'MCQ_SINGLE') attempt.answers[questionId] = { selected: [wrongIds[Math.floor(random() * wrongIds.length)]] }
    else attempt.answers[questionId] = { selected: [...correctIds.slice(0, Math.max(1, correctIds.length - 1)), wrongIds[0]].filter(Boolean) }
  }
}

function seedSubmitted(examId, candidateId, ability, variantPick) {
  const exam = exams.find((e) => e.id === examId)
  const id = `at_${examId.slice(3)}_${candidateId}`
  const random = rng(hash(id))
  const attempt = {
    id,
    examId,
    candidateId,
    sandbox: false,
    status: 'SUBMITTED',
    startedAt: new Date(new Date(exam.startAt).getTime() + 3 * MIN + Math.floor(random() * 4) * MIN).toISOString(),
    paper: [],
    answers: {},
    written: {},
    incidents: [],
    gaps: [],
    compensations: [],
    versions: [],
  }
  attempt.submittedAt = new Date(new Date(attempt.startedAt).getTime() + (exam.durationMinutes - 6 - Math.floor(random() * 14)) * MIN).toISOString()
  const base = buildPaper(examId, candidateId, random, { shuffleQuestions: exam.settings.shuffleQuestions, shuffleOptions: exam.settings.shuffleOptions })
  if (variantPick) {
    // Pin the variant each candidate received so the fairness panel has a story to tell.
    const items = assignedFor(examId)
    const keep = base.filter((p) => !items.find((i) => i.questionId === p.questionId)?.group)
    for (const questionId of variantPick) {
      const item = items.find((i) => i.questionId === questionId)
      const question = questionById(questionId)
      keep.push({ questionId, marks: item.marks, optionOrder: question.options.map((o) => o.id) })
    }
    attempt.paper = shuffled(keep, random)
  } else {
    attempt.paper = base
  }
  fillAnswers(attempt, ability)
  attempts.push(attempt)
  return attempt
}

let incidentSeq = 0
const incident = (type, offsetMs, detail = '') => ({ id: `inc_${++incidentSeq}`, type, at: at(offsetMs), detail })

export function seedAttempts() {
  // Computer Networks midterm: finished, written answers still waiting for a marker.
  const a6 = seedSubmitted('ex_105', 'u_6', 0.85, ['q_net_slow', 'q_net_subnet'])
  seedSubmitted('ex_105', 'u_7', 0.7, ['q_net_flow', 'q_net_bgp'])
  const a9 = seedSubmitted('ex_105', 'u_9', 0.55, ['q_net_slow', 'q_net_subnet'])
  seedSubmitted('ex_105', 'u_10', 0.75, ['q_net_flow', 'q_net_bgp'])
  const a13 = seedSubmitted('ex_105', 'u_13', 0.4, ['q_net_slow', 'q_net_bgp'])
  a6.written.q_net_hs = { score: 10, feedback: 'Clear and complete. Mention why sequence numbers must be synchronised.', gradedAt: at(-3 * HOUR) }
  a6.written.q_net_rt = { score: 9, feedback: 'Good comparison; one advantage is enough but you gave both.', gradedAt: at(-3 * HOUR) }
  a9.incidents.push(incident('TAB_HIDDEN', -DAY - 2 * HOUR - 20 * MIN, 'Exam tab hidden for 14 seconds'))
  a9.gaps.push({ id: 'gap_a', from: at(-DAY - 2 * HOUR - 30 * MIN), to: at(-DAY - 2 * HOUR - 26 * MIN) })
  a13.incidents.push(incident('CONNECTION_LOST', -DAY - 2 * HOUR - 10 * MIN, 'Connection lost for 7 minutes'), incident('PASTE_DETECTED', -DAY - 2 * HOUR - 40 * MIN, 'Text pasted into a written answer'))
  a13.gaps.push(
    { id: 'gap_b', from: at(-DAY - 2 * HOUR - 50 * MIN), to: at(-DAY - 2 * HOUR - 48 * MIN - 30000) },
    { id: 'gap_c', from: at(-DAY - 2 * HOUR - 17 * MIN), to: at(-DAY - 2 * HOUR - 10 * MIN) },
  )

  // Software Engineering quiz: fully marked and published.
  for (const [uid, ability] of [['u_6', 0.8], ['u_8', 0.6], ['u_11', 0.5]]) {
    const attempt = seedSubmitted('ex_106', uid, ability, null)
    const random = rng(hash(`${attempt.id}:w`))
    attempt.written.q_se_review = { score: Math.round(random() * 3 + 2), feedback: uid === 'u_8' ? 'Two benefits were requested; only one was clear.' : 'Good answer.', gradedAt: at(-3 * DAY) }
    attempt.versions.push(snapshot(attempt, 1, 'Original marking', at(-2 * DAY)))
  }

  // Data Structures midterm: live right now.
  const live = [
    ['u_6', 23, 0.27, 6, false],
    ['u_7', 22, 0.21, 12, false],
    ['u_8', 18, 0.31, 25, false],
    ['u_9', 12, 0.2, 230, true],
  ]
  const exam = exams.find((e) => e.id === 'ex_101')
  for (const [candidateId, startedMinAgo, rate, lastSeenSec, offline] of live) {
    const id = `at_101_${candidateId}`
    const random = rng(hash(id))
    const attempt = {
      id,
      examId: 'ex_101',
      candidateId,
      sandbox: false,
      status: 'IN_PROGRESS',
      startedAt: at(-startedMinAgo * MIN),
      paper: buildPaper('ex_101', candidateId, random, exam.settings),
      answers: {},
      written: {},
      incidents: [],
      gaps: offline ? [{ id: 'gap_live', from: at(-lastSeenSec * 1000), to: null }] : [],
      compensations: [],
      versions: [],
      live: { startedMinAgo, rate, lastSeenSec, offline },
    }
    attempts.push(attempt)
  }
  const byId = (id) => attempts.find((a) => a.id === id)
  byId('at_101_u_7').incidents.push(incident('TAB_HIDDEN', -9 * MIN, 'Exam tab hidden for 21 seconds'), incident('FULLSCREEN_EXIT', -6 * MIN, 'Left full-screen mode'))
  byId('at_101_u_9').incidents.push(incident('CONNECTION_LOST', -230 * 1000, 'Connection lost, still offline'), incident('PASTE_DETECTED', -8 * MIN, 'Text pasted into a written answer'))
  byId('at_101_u_8').incidents.push(incident('CONNECTION_UNSTABLE', -3 * MIN, 'Three short drops within a minute'))
}

// --- score snapshots -------------------------------------------------------------

export function questionMarks(attempt, exam) {
  const perQuestion = {}
  let pending = 0
  for (const { questionId, marks } of attempt.paper) {
    const value = markQuestion(questionById(questionId), marks, attempt.answers[questionId], attempt.written[questionId], exam.settings.negativeMarking)
    if (value === null) pending += 1
    else perQuestion[questionId] = value
  }
  return { perQuestion, pending }
}

export const sumMarks = (perQuestion) => round2(Object.values(perQuestion).reduce((a, b) => a + b, 0))
export const maxMarks = (attempt) => attempt.paper.reduce((sum, p) => sum + p.marks, 0)

function snapshot(attempt, version, reason, createdAt) {
  const exam = exams.find((e) => e.id === attempt.examId)
  const { perQuestion } = questionMarks(attempt, exam)
  return { version, createdAt, reason, perQuestion, total: Math.max(0, sumMarks(perQuestion)) }
}
export { snapshot }

/** Latest published score version, or a live (provisional) calculation before publishing. */
export function currentScore(attempt) {
  const exam = exams.find((e) => e.id === attempt.examId)
  const latest = attempt.versions.at(-1)
  if (latest) return { perQuestion: latest.perQuestion, total: latest.total, version: latest.version, pending: 0, provisional: false }
  const { perQuestion, pending } = questionMarks(attempt, exam)
  return { perQuestion, total: Math.max(0, sumMarks(perQuestion)), version: null, pending, provisional: true }
}

// --- results state, disputes, audit seeds -------------------------------------

/** examId -> ISO time results were published. */
export const publishedAt = new Map([['ex_106', at(-2 * DAY)]])
export const DISPUTE_WINDOW_DAYS = 7
export const MAX_COMPENSATION_MINUTES = 30

export function resultsState(exam, examStatusValue) {
  if (examStatusValue !== 'COMPLETED') return 'NOT_READY'
  if (publishedAt.has(exam.id)) return 'PUBLISHED'
  const submitted = realAttempts(exam.id).filter((a) => a.status === 'SUBMITTED')
  const pending = submitted.some((a) => questionMarks(a, exam).pending > 0)
  return pending ? 'UNGRADED' : 'GRADED'
}

export const disputes = []
export function seedDisputes() {
  disputes.push(
    { id: 'dsp_1', examId: 'ex_106', attemptId: 'at_106_u_11', candidateId: 'u_11', category: 'AMBIGUOUS_QUESTION', questionId: 'q_se_agile', explanation: 'The question does not say whether it means the Scrum guide or common practice. Option C could also be argued.', status: 'OPEN', outcome: null, resolutionReason: '', createdAt: at(-30 * HOUR), updatedAt: at(-30 * HOUR), resolvedAt: null, resolvedById: null },
    { id: 'dsp_2', examId: 'ex_106', attemptId: 'at_106_u_8', candidateId: 'u_8', category: 'GRADING_ERROR', questionId: 'q_se_review', explanation: 'I listed three benefits (knowledge sharing, consistency and mentoring) but the feedback says only one was clear.', status: 'UNDER_REVIEW', outcome: null, resolutionReason: '', createdAt: at(-26 * HOUR), updatedAt: at(-5 * HOUR), resolvedAt: null, resolvedById: null },
    { id: 'dsp_3', examId: 'ex_106', attemptId: 'at_106_u_6', candidateId: 'u_6', category: 'TECHNICAL_INCIDENT', questionId: null, explanation: 'My connection dropped for a minute near the end of the quiz.', status: 'RESOLVED', outcome: 'REJECTED', resolutionReason: 'No gap was recorded for your attempt and every answer you gave was saved before submission.', createdAt: at(-40 * HOUR), updatedAt: at(-20 * HOUR), resolvedAt: at(-20 * HOUR), resolvedById: 'u_3' },
  )
}

export const announcements = [
  { id: 'ann_1', examId: 'ex_101', message: 'Welcome. Calculators are not permitted. Raise your hand in the room if you need help.', sentAt: at(-26 * MIN), sentBy: 'Dr. Ingrid Solberg' },
]

export const compensationLog = []

export const userName = (id) => users.find((u) => u.id === id)?.name ?? 'Unknown'

seedAttempts()
seedDisputes()
