import { accessStatus, enrollments, exams, nextId, requireRole, users } from './db'
import {
  announcements,
  assignedFor,
  attempts,
  buildPaper,
  currentScore,
  disputes,
  maxMarks,
  publishedAt,
  questionById,
  realAttempts,
} from './examData'
import { clone, delay, fail, serverNow } from './helpers'

const createdDisputes = []

const questionTypes = {
  MCQ_SINGLE: 'SINGLE_CHOICE',
  MCQ_MULTI: 'MULTIPLE_SELECT',
  WRITTEN: 'WRITTEN',
}

const examFor = (examId, candidateId) => {
  const exam = exams.find((item) => item.id === examId && item.published && enrollments.get(item.id)?.has(candidateId))
  if (!exam) fail(404, 'NOT_FOUND', "We couldn't find that exam in your list.")
  return exam
}

const resultIdFor = (attemptId) => `result_${attemptId}`

function candidateResults(candidateId) {
  return attempts
    .filter((attempt) => attempt.candidateId === candidateId && attempt.status !== 'IN_PROGRESS' && publishedAt.has(attempt.examId))
    .map((attempt) => {
      const exam = exams.find((item) => item.id === attempt.examId)
      const score = currentScore(attempt)
      return {
        id: resultIdFor(attempt.id),
        attemptId: attempt.id,
        totalMarks: maxMarks(attempt),
        obtainedMarks: score.total,
        status: 'PUBLISHED',
        publishedAt: publishedAt.get(attempt.examId),
        attempt: {
          id: attempt.id,
          attemptNumber: 1,
          submittedAt: attempt.submittedAt,
          exam: { id: exam.id, title: exam.title },
        },
        disputes: disputes
          .filter((dispute) => dispute.attemptId === attempt.id)
          .map((dispute) => ({
            id: dispute.id,
            explanation: dispute.explanation,
            status: dispute.status,
            resolution: dispute.resolutionReason ?? null,
            createdAt: dispute.createdAt,
          }))
          .concat(createdDisputes.filter((dispute) => dispute.resultId === resultIdFor(attempt.id))),
      }
    })
    .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
}

function candidateDisputes(candidateId) {
  const results = candidateResults(candidateId)
  const seeded = results.flatMap((result) =>
    result.disputes
      .filter((dispute) => !createdDisputes.some((created) => created.id === dispute.id))
      .map((dispute) => ({
        ...dispute,
        result: {
          id: result.id,
          totalMarks: result.totalMarks,
          obtainedMarks: result.obtainedMarks,
          status: result.status,
          attempt: { exam: result.attempt.exam },
        },
      })),
  )
  return [...seeded, ...createdDisputes.filter((dispute) => dispute.openedById === candidateId)]
}

function findAttempt(attemptId, candidateId) {
  const attempt = attempts.find(
    (item) => item.id === attemptId && item.candidateId === candidateId && !item.sandbox,
  )
  if (!attempt) fail(404, 'NOT_FOUND', 'Exam attempt not found.')
  return attempt
}

function workspaceDto(attempt, exam) {
  const questions = attempt.paper.map((item, index) => {
    const question = questionById(item.questionId)
    if (!question) fail(500, 'INVALID_EXAM_DATA', 'An assigned question is no longer available.')
    return {
      id: item.attemptQuestionId ?? `${attempt.id}_${item.questionId}`,
      position: index + 1,
      assignedMarks: item.marks,
      question: {
        id: question.id,
        text: question.text,
        difficulty: question.difficulty.toUpperCase(),
        type: questionTypes[question.type],
      },
      options: item.optionOrder
        .map((optionId, position) => question.options.find((option) => option.id === optionId))
        .filter(Boolean)
        .map((option, position) => ({ id: option.id, position: position + 1, optionText: option.text })),
      answer: attempt.answers[question.id]
        ? {
            textResponse: attempt.answers[question.id].text ?? null,
            status: attempt.answers[question.id].text || attempt.answers[question.id].selected?.length ? 'ANSWERED' : 'UNANSWERED',
            isMarkedForReview: Boolean(attempt.answerMeta?.[question.id]?.isMarkedForReview),
            selectedOptionIds: attempt.answers[question.id].selected ?? [],
          }
        : null,
    }
  })

  return {
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber ?? 1,
    status: attempt.status,
    startedAt: attempt.startedAt,
    expiresAt: attempt.expiresAt ?? new Date(
      Math.min(
        new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60_000,
        new Date(exam.endAt).getTime(),
      ),
    ).toISOString(),
    serverTime: new Date(serverNow()).toISOString(),
    exam: { id: exam.id, title: exam.title, instructions: exam.instructions, startsAt: exam.startAt, endsAt: exam.endAt },
    questions,
  }
}

export async function startCandidateAttempt(examId) {
  const me = requireRole('CANDIDATE')
  await delay(250, 500)
  const exam = examFor(examId, me.id)
  if (accessStatus(exam) !== 'AVAILABLE') fail(400, 'EXAM_NOT_AVAILABLE', 'This exam is not currently available.')
  if (assignedFor(examId).length === 0) fail(400, 'EXAM_HAS_NO_QUESTIONS', 'This exam has no assigned questions.')

  let attempt = realAttempts(examId).find((item) => item.candidateId === me.id && item.status === 'IN_PROGRESS')
  if (attempt) {
    const expiresAt = attempt.expiresAt ?? new Date(
      Math.min(
        new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60_000,
        new Date(exam.endAt).getTime(),
      ),
    ).toISOString()
    if (new Date(expiresAt).getTime() > serverNow()) {
      attempt.expiresAt = expiresAt
      return { id: attempt.id, status: attempt.status }
    }
    attempt.status = 'AUTO_SUBMITTED'
    attempt.submittedAt = new Date(serverNow()).toISOString()
  }

  const previousAttempts = realAttempts(examId).filter((item) => item.candidateId === me.id)
  if (previousAttempts.length >= (exam.maxAttempts ?? 1)) {
    fail(400, 'MAX_ATTEMPTS_REACHED', 'You have reached the maximum number of attempts.')
  }

  const paper = buildPaper(examId, me.id, Math.random, {
    shuffleQuestions: exam.settings.shuffleQuestions,
    shuffleOptions: exam.settings.shuffleOptions,
  }).map((item) => ({ ...item, attemptQuestionId: `${nextId('atq')}` }))
  const startedAt = new Date(serverNow()).toISOString()
  attempt = {
    id: nextId('attempt'),
    examId,
    candidateId: me.id,
    sandbox: false,
    attemptNumber: previousAttempts.length + 1,
    status: 'IN_PROGRESS',
    startedAt,
    expiresAt: new Date(
      Math.min(
        serverNow() + exam.durationMinutes * 60_000,
        new Date(exam.endAt).getTime(),
      ),
    ).toISOString(),
    paper,
    answers: {},
    answerMeta: {},
    written: {},
    incidents: [],
    gaps: [],
    compensations: [],
    versions: [],
  }
  attempts.push(attempt)
  return { id: attempt.id, status: attempt.status }
}

export async function getCandidateAttemptWorkspace(attemptId) {
  const me = requireRole('CANDIDATE')
  await delay()
  const attempt = findAttempt(attemptId, me.id)
  const exam = exams.find((item) => item.id === attempt.examId)
  if (!exam) fail(404, 'NOT_FOUND', 'Exam not found.')
  attempt.expiresAt ??= new Date(
    Math.min(
      new Date(attempt.startedAt).getTime() + exam.durationMinutes * 60_000,
      new Date(exam.endAt).getTime(),
    ),
  ).toISOString()
  if (attempt.status === 'IN_PROGRESS' && new Date(attempt.expiresAt).getTime() <= serverNow()) {
    attempt.status = 'AUTO_SUBMITTED'
    attempt.submittedAt = new Date(serverNow()).toISOString()
  }
  return clone(workspaceDto(attempt, exam))
}

export async function saveCandidateAnswer(attemptId, attemptQuestionId, answer) {
  const me = requireRole('CANDIDATE')
  await delay(120, 240)
  const attempt = findAttempt(attemptId, me.id)
  if (attempt.status !== 'IN_PROGRESS') fail(400, 'ATTEMPT_NOT_IN_PROGRESS', 'This attempt is no longer in progress.')
  if (new Date(attempt.expiresAt).getTime() <= serverNow()) {
    attempt.status = 'AUTO_SUBMITTED'
    attempt.submittedAt = new Date(serverNow()).toISOString()
    fail(400, 'ATTEMPT_EXPIRED', 'Time expired. Your attempt was automatically submitted.')
  }

  const item = attempt.paper.find(
    (paperItem) => (paperItem.attemptQuestionId ?? `${attempt.id}_${paperItem.questionId}`) === attemptQuestionId,
  )
  if (!item) fail(404, 'QUESTION_NOT_FOUND', 'Question not found in this attempt.')
  const question = questionById(item.questionId)
  const selectedOptionIds = answer.selectedOptionIds ?? []
  const textResponse = answer.textResponse ?? ''
  if (!Array.isArray(selectedOptionIds) || selectedOptionIds.some((id) => !question.options.some((option) => option.id === id))) {
    fail(400, 'INVALID_OPTIONS', 'One or more selected options are invalid.')
  }
  if (question.type === 'MCQ_SINGLE' && selectedOptionIds.length > 1) {
    fail(400, 'ONLY_ONE_OPTION_ALLOWED', 'Select only one option for this question.')
  }
  if (question.type === 'WRITTEN' && selectedOptionIds.length > 0) {
    fail(400, 'WRITTEN_QUESTION_OPTIONS_NOT_ALLOWED', 'Written questions do not accept options.')
  }
  if (question.type !== 'WRITTEN' && textResponse) {
    fail(400, 'TEXT_NOT_ALLOWED', 'Text responses are only allowed for written questions.')
  }
  if (typeof textResponse !== 'string' || typeof answer.isMarkedForReview !== 'boolean') {
    fail(400, 'INVALID_ANSWER', 'Answer text and review status are invalid.')
  }

  attempt.answers[question.id] =
    question.type === 'WRITTEN' ? { text: textResponse } : { selected: selectedOptionIds }
  attempt.answerMeta ??= {}
  attempt.answerMeta[question.id] = { isMarkedForReview: answer.isMarkedForReview }
  return clone({
    status: selectedOptionIds.length || textResponse.trim() ? 'ANSWERED' : 'UNANSWERED',
    selectedOptionIds,
    textResponse: question.type === 'WRITTEN' ? textResponse : null,
    isMarkedForReview: answer.isMarkedForReview,
  })
}

export async function submitCandidateAttempt(attemptId) {
  const me = requireRole('CANDIDATE')
  await delay(200, 400)
  const attempt = findAttempt(attemptId, me.id)
  if (attempt.status !== 'IN_PROGRESS') fail(400, 'ATTEMPT_ALREADY_SUBMITTED', 'This attempt has already been submitted or finalized.')
  const totalQuestions = attempt.paper.length
  const answeredQuestions = attempt.paper.filter((item) => {
    const answer = attempt.answers[item.questionId]
    return Boolean(answer?.text?.trim() || answer?.selected?.length)
  }).length
  const autoSubmitted = new Date(attempt.expiresAt).getTime() <= serverNow()
  attempt.status = autoSubmitted ? 'AUTO_SUBMITTED' : 'SUBMITTED'
  attempt.submittedAt = new Date(serverNow()).toISOString()
  return {
    attempt: { id: attempt.id, status: attempt.status, submittedAt: attempt.submittedAt },
    summary: { totalQuestions, answeredQuestions, unansweredQuestions: totalQuestions - answeredQuestions },
  }
}

export async function listCandidateResults() {
  const me = requireRole('CANDIDATE')
  await delay()
  return clone(candidateResults(me.id))
}

export async function listCandidateDisputes() {
  const me = requireRole('CANDIDATE')
  await delay()
  return clone(candidateDisputes(me.id))
}

export async function createCandidateDispute(resultId, { explanation }) {
  const me = requireRole('CANDIDATE')
  await delay(250, 400)
  const result = candidateResults(me.id).find((item) => item.id === resultId)
  if (!result) fail(404, 'NOT_FOUND', 'Published result not found.')
  if (candidateDisputes(me.id).some((item) => item.result.id === resultId)) {
    fail(409, 'DUPLICATE_DISPUTE', 'You have already submitted a dispute for this result.')
  }
  if (typeof explanation !== 'string' || explanation.trim().length < 20) {
    fail(400, 'VALIDATION_ERROR', 'Explain your concern in at least 20 characters.', { explanation: 'Enter at least 20 characters.' })
  }
  const dispute = {
    id: nextId('dispute'),
    resultId,
    openedById: me.id,
    explanation: explanation.trim(),
    status: 'OPEN',
    resolution: null,
    resolvedById: null,
    resolvedAt: null,
    createdAt: new Date(serverNow()).toISOString(),
    updatedAt: new Date(serverNow()).toISOString(),
    result: {
      id: result.id,
      totalMarks: result.totalMarks,
      obtainedMarks: result.obtainedMarks,
      status: result.status,
      attempt: { exam: result.attempt.exam },
    },
  }
  createdDisputes.push(dispute)
  return clone(dispute)
}

export async function listCandidateAnnouncements() {
  const me = requireRole('CANDIDATE')
  await delay()
  const assignedExamIds = new Set(
    [...enrollments.entries()]
      .filter(([, candidates]) => candidates.has(me.id))
      .map(([examId]) => examId),
  )
  return clone(
    announcements
      .filter((announcement) => assignedExamIds.has(announcement.examId))
      .map((announcement) => {
        const exam = exams.find((item) => item.id === announcement.examId)
        const authorId = announcement.authorId ?? 'u_3'
        const author = users.find((item) => item.id === authorId)
        return {
          id: announcement.id,
          examId: announcement.examId,
          title: announcement.title ?? 'Exam announcement',
          message: announcement.message,
          publishedAt: announcement.publishedAt ?? announcement.sentAt,
          createdAt: announcement.createdAt ?? announcement.sentAt,
          exam: { id: exam.id, title: exam.title },
          author: { id: authorId, fullName: author?.fullName ?? announcement.sentBy ?? 'Exam team' },
        }
      })
      .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt)),
  )
}
