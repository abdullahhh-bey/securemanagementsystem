import { z } from 'zod'
import { ROLES } from './constants'

const requiredText = (label, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`)

const passwordRules = z
  .string()
  .min(8, 'Use at least 8 characters.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/\d/, 'Include at least one number.')

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Enter your password.'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').pipe(z.email('Enter a valid email address.')),
})

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword: passwordRules,
    confirmPassword: z.string().min(1, 'Confirm your new password.'),
  })
  .superRefine((value, ctx) => {
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({ code: 'custom', path: ['confirmPassword'], message: 'Passwords do not match.' })
    }
    if (value.currentPassword && value.newPassword === value.currentPassword) {
      ctx.addIssue({ code: 'custom', path: ['newPassword'], message: 'Choose a different password.' })
    }
  })

/** Admin create-user: EXAMINER/CANDIDATE only; password min 12 to match POST /api/admin/users. */
export const createUserSchema = z.object({
  name: requiredText('Full name', 160),
  email: z.string().trim().min(1, 'Email is required.').pipe(z.email('Enter a valid email address.')),
  role: z.enum([ROLES.EXAMINER, ROLES.CANDIDATE], { error: 'Choose a role.' }),
  password: z
    .string()
    .min(12, 'Use at least 12 characters.')
    .regex(/[A-Za-z]/, 'Include at least one letter.')
    .regex(/\d/, 'Include at least one number.'),
})

export const editRoleSchema = z.object({
  role: z.enum([ROLES.ADMIN, ROLES.EXAMINER, ROLES.CANDIDATE], { error: 'Choose a role.' }),
})

const wholeNumber = (label, { min = 1, max } = {}) => {
  let schema = z
    .number({ error: `${label} must be a number.` })
    .int(`${label} must be a whole number.`)
    .min(min, `${label} must be at least ${min}.`)
  if (max) schema = schema.max(max, `${label} must be ${max} or less.`)
  return schema
}

export const examSchema = z
  .object({
    title: requiredText('Title', 200),
    description: z.string().trim().max(2000).optional().or(z.literal('')),
    instructions: z.string().trim().max(4000, 'Instructions must be 4000 characters or fewer.'),
    startAt: z.string().min(1, 'Choose when the exam opens.'),
    endAt: z.string().min(1, 'Choose when the exam closes.'),
    durationMinutes: wholeNumber('Duration', { max: 600 }),
    totalMarks: wholeNumber('Total marks', { max: 1000 }),
    maxAttempts: wholeNumber('Max attempts', { min: 1, max: 10 }).optional(),
    settings: z.object({
      shuffleQuestions: z.boolean(),
      shuffleOptions: z.boolean(),
      negativeMarking: z.boolean(),
    }),
  })
  .superRefine((value, ctx) => {
    const start = new Date(value.startAt).getTime()
    const end = new Date(value.endAt).getTime()
    if (Number.isNaN(start) || Number.isNaN(end)) return
    if (end <= start) {
      ctx.addIssue({ code: 'custom', path: ['endAt'], message: 'The end time must be after the start time.' })
      return
    }
    const windowMinutes = Math.floor((end - start) / 60000)
    if (Number.isFinite(value.durationMinutes) && value.durationMinutes > windowMinutes) {
      ctx.addIssue({
        code: 'custom',
        path: ['durationMinutes'],
        message: `Duration can't exceed the exam window (${windowMinutes} min).`,
      })
    }
  })

const questionOptionSchema = z.object({
  text: z.string().trim().min(1, 'Option text is required.'),
  isCorrect: z.boolean(),
})

const positiveMarks = z.coerce
  .number({ error: 'Marks must be a number.' })
  .refine((n) => n > 0, 'Marks must be more than zero.')

const isSingle = (type) => type === 'MCQ_SINGLE' || type === 'SINGLE_CHOICE'

export const questionSchema = z
  .object({
    type: z.enum(['SINGLE_CHOICE', 'WRITTEN'], {
      error: 'Choose a question type.',
    }),
    text: requiredText('Question', 4000),
    topic: z.string().trim().max(80, 'Topic must be 80 characters or fewer.').optional().or(z.literal('')),
    difficulty: z.enum(['EASY', 'MEDIUM', 'HARD', 'easy', 'medium', 'hard'], { error: 'Choose a difficulty.' }),
    defaultMarks: positiveMarks,
    options: z.array(questionOptionSchema),
    penalty: z.coerce.number().min(0, 'Penalty cannot be less than 0.').max(1, 'Penalty cannot be greater than 1.'),
    modelAnswer: z.string().trim().max(8000),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'WRITTEN') return
    const filled = value.options.filter((o) => o.text.trim())
    if (filled.length < 2) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Add at least two answer options.' })
      return
    }
    const correct = filled.filter((o) => o.isCorrect).length
    if (correct === 0) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'Mark at least one option as correct.' })
      return
    }
    if (isSingle(value.type) && correct > 1) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'A single-answer question can have only one correct option.' })
    }
  })
