/**
 * Mirrors `backend/prisma/schema.prisma`.
 * Map at the API boundary; keep UI DTOs thin and schema-named where possible.
 */

export const UserRole = Object.freeze({
  ADMIN: 'ADMIN',
  EXAMINER: 'EXAMINER',
  CANDIDATE: 'CANDIDATE',
})

export const QuestionDifficulty = Object.freeze({
  EASY: 'EASY',
  MEDIUM: 'MEDIUM',
  HARD: 'HARD',
})

export const QuestionType = Object.freeze({
  SINGLE_CHOICE: 'SINGLE_CHOICE',
  MULTIPLE_SELECT: 'MULTIPLE_SELECT',
  WRITTEN: 'WRITTEN',
})

export const ExamStatus = Object.freeze({
  DRAFT: 'DRAFT',
  PUBLISHED: 'PUBLISHED',
  ONGOING: 'ONGOING',
  COMPLETED: 'COMPLETED',
})

export const EnrollmentStatus = Object.freeze({
  ENROLLED: 'ENROLLED',
  WITHDRAWN: 'WITHDRAWN',
})

export const AttemptMode = Object.freeze({
  OFFICIAL: 'OFFICIAL',
  SANDBOX: 'SANDBOX',
})

export const AttemptStatus = Object.freeze({
  IN_PROGRESS: 'IN_PROGRESS',
  SUBMITTED: 'SUBMITTED',
  AUTO_SUBMITTED: 'AUTO_SUBMITTED',
  EXPIRED: 'EXPIRED',
  ABANDONED: 'ABANDONED',
})

export const AnswerStatus = Object.freeze({
  UNANSWERED: 'UNANSWERED',
  ANSWERED: 'ANSWERED',
})

export const GradingMethod = Object.freeze({
  AUTO: 'AUTO',
  MANUAL: 'MANUAL',
})

export const ResultStatus = Object.freeze({
  PENDING_REVIEW: 'PENDING_REVIEW',
  READY_TO_PUBLISH: 'READY_TO_PUBLISH',
  PUBLISHED: 'PUBLISHED',
  WITHHELD: 'WITHHELD',
})

export const AttemptEventType = Object.freeze({
  NETWORK_DISCONNECTED: 'NETWORK_DISCONNECTED',
  NETWORK_RESTORED: 'NETWORK_RESTORED',
  ANSWER_SAVE_FAILED: 'ANSWER_SAVE_FAILED',
  ANSWER_SAVE_SUCCEEDED: 'ANSWER_SAVE_SUCCEEDED',
  TAB_HIDDEN: 'TAB_HIDDEN',
  WINDOW_BLURRED: 'WINDOW_BLURRED',
  ATTEMPT_RESUMED: 'ATTEMPT_RESUMED',
})

export const EventReviewStatus = Object.freeze({
  UNREVIEWED: 'UNREVIEWED',
  REVIEWED: 'REVIEWED',
  ACTION_REQUIRED: 'ACTION_REQUIRED',
})

export const DisputeStatus = Object.freeze({
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED: 'RESOLVED',
  REJECTED: 'REJECTED',
})

export const ImportType = Object.freeze({
  CANDIDATES: 'CANDIDATES',
  QUESTIONS: 'QUESTIONS',
})

export const ImportJobStatus = Object.freeze({
  QUEUED: 'QUEUED',
  PROCESSING: 'PROCESSING',
  COMPLETED: 'COMPLETED',
  PARTIALLY_FAILED: 'PARTIALLY_FAILED',
  FAILED: 'FAILED',
})

/** Legacy UI → schema QuestionType */
const QUESTION_TYPE_FROM_LEGACY = Object.freeze({
  MCQ_SINGLE: QuestionType.SINGLE_CHOICE,
  MCQ_MULTI: QuestionType.MULTIPLE_SELECT,
  WRITTEN: QuestionType.WRITTEN,
  SINGLE_CHOICE: QuestionType.SINGLE_CHOICE,
  MULTIPLE_SELECT: QuestionType.MULTIPLE_SELECT,
})

/** Schema → legacy keys still used inside mock scoring */
export const QUESTION_TYPE_TO_LEGACY = Object.freeze({
  SINGLE_CHOICE: 'MCQ_SINGLE',
  MULTIPLE_SELECT: 'MCQ_MULTI',
  WRITTEN: 'WRITTEN',
})

const DIFFICULTY_FROM_LEGACY = Object.freeze({
  easy: QuestionDifficulty.EASY,
  medium: QuestionDifficulty.MEDIUM,
  hard: QuestionDifficulty.HARD,
  EASY: QuestionDifficulty.EASY,
  MEDIUM: QuestionDifficulty.MEDIUM,
  HARD: QuestionDifficulty.HARD,
})

const EVENT_FROM_LEGACY = Object.freeze({
  CONNECTION_LOST: AttemptEventType.NETWORK_DISCONNECTED,
  CONNECTION_UNSTABLE: AttemptEventType.NETWORK_DISCONNECTED,
  FULLSCREEN_EXIT: AttemptEventType.WINDOW_BLURRED,
  PASTE_DETECTED: AttemptEventType.ANSWER_SAVE_FAILED,
  TAB_HIDDEN: AttemptEventType.TAB_HIDDEN,
  NETWORK_DISCONNECTED: AttemptEventType.NETWORK_DISCONNECTED,
  NETWORK_RESTORED: AttemptEventType.NETWORK_RESTORED,
  ANSWER_SAVE_FAILED: AttemptEventType.ANSWER_SAVE_FAILED,
  ANSWER_SAVE_SUCCEEDED: AttemptEventType.ANSWER_SAVE_SUCCEEDED,
  WINDOW_BLURRED: AttemptEventType.WINDOW_BLURRED,
  ATTEMPT_RESUMED: AttemptEventType.ATTEMPT_RESUMED,
})

export function normalizeDifficulty(value) {
  if (value == null || value === '') return null
  return DIFFICULTY_FROM_LEGACY[String(value).trim()] ?? DIFFICULTY_FROM_LEGACY[String(value).trim().toUpperCase()] ?? null
}

export function normalizeQuestionType(value) {
  if (!value) return null
  const raw = String(value).trim()
  return QUESTION_TYPE_FROM_LEGACY[raw] ?? QUESTION_TYPE_FROM_LEGACY[raw.toUpperCase()] ?? null
}

export function normalizeAttemptEventType(value) {
  if (!value) return null
  const raw = String(value).trim()
  return EVENT_FROM_LEGACY[raw] ?? EVENT_FROM_LEGACY[raw.toUpperCase()] ?? null
}

export function userDisplayName(user) {
  if (!user) return ''
  return user.fullName || user.name || ''
}

export function examWindow(exam) {
  if (!exam) return { startsAt: null, endsAt: null }
  return {
    startsAt: exam.startsAt ?? exam.startAt ?? null,
    endsAt: exam.endsAt ?? exam.endAt ?? null,
  }
}

/** Normalize a User DTO from API/mock to schema-shaped public user. */
export function normalizeUser(user) {
  if (!user) return null
  const fullName = user.fullName || user.name || ''
  return {
    ...user,
    fullName,
    name: fullName,
    isActive: user.isActive !== false,
  }
}

/** Normalize an Exam DTO so pages can use schema field names. */
export function normalizeExam(exam) {
  if (!exam) return null
  const { startsAt, endsAt } = examWindow(exam)
  const randomizeQuestions = exam.randomizeQuestions ?? exam.settings?.shuffleQuestions ?? false
  const randomizeOptions = exam.randomizeOptions ?? exam.settings?.shuffleOptions ?? false
  return {
    ...exam,
    startsAt,
    endsAt,
    startAt: startsAt,
    endAt: endsAt,
    randomizeQuestions,
    randomizeOptions,
    maxAttempts: exam.maxAttempts ?? 1,
    description: exam.description ?? '',
    settings: {
      shuffleQuestions: randomizeQuestions,
      shuffleOptions: randomizeOptions,
      negativeMarking: exam.settings?.negativeMarking ?? false,
    },
  }
}

/** Form / UI exam → API body aligned with prisma Exam (+ optional UI extensions). */
export function mapExamToApi(input) {
  const startsAt = input.startsAt ?? input.startAt
  const endsAt = input.endsAt ?? input.endAt
  const randomizeQuestions = input.randomizeQuestions ?? input.settings?.shuffleQuestions ?? false
  const randomizeOptions = input.randomizeOptions ?? input.settings?.shuffleOptions ?? false
  return {
    title: input.title,
    description: input.description ?? '',
    instructions: input.instructions ?? '',
    startsAt,
    endsAt,
    durationMinutes: input.durationMinutes,
    maxAttempts: input.maxAttempts ?? 1,
    randomizeQuestions,
    randomizeOptions,
    // UI extension retained for mock auto-marking until backend models it
    negativeMarking: input.settings?.negativeMarking ?? input.negativeMarking ?? false,
    totalMarks: input.totalMarks,
  }
}

/** Question form → API body aligned with QuestionVersion fields. */
export function mapQuestionToApi(input) {
  const type = normalizeQuestionType(input.type)
  const difficulty = normalizeDifficulty(input.difficulty)
  return {
    type,
    questionText: input.questionText ?? input.text,
    text: input.questionText ?? input.text,
    difficulty,
    defaultMarks: Number(input.defaultMarks),
    markingGuide: input.markingGuide ?? input.modelAnswer ?? '',
    modelAnswer: input.modelAnswer ?? input.markingGuide ?? '',
    categoryId: input.categoryId ?? null,
    topic: input.topic ?? '',
    markingRule: input.markingRule ?? null,
    penalty: input.penalty ?? 0,
    options: (input.options ?? []).map((o, i) => ({
      position: o.position ?? i + 1,
      optionText: o.optionText ?? o.text,
      text: o.optionText ?? o.text,
      isCorrect: Boolean(o.isCorrect),
    })),
  }
}

/** Normalize question DTO for UI (supports both schema and legacy shapes). */
export function normalizeQuestion(question) {
  if (!question) return null
  const type = normalizeQuestionType(question.type) ?? question.type
  const difficulty = normalizeDifficulty(question.difficulty) ?? question.difficulty
  return {
    ...question,
    type,
    difficulty,
    text: question.questionText ?? question.text,
    questionText: question.questionText ?? question.text,
    options: (question.options ?? []).map((o, i) => ({
      ...o,
      text: o.optionText ?? o.text,
      optionText: o.optionText ?? o.text,
      position: o.position ?? i + 1,
    })),
    modelAnswer: question.modelAnswer ?? question.markingGuide ?? '',
  }
}
