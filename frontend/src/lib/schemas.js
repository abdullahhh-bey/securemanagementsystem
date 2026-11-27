import { z } from 'zod'
import { ROLES } from './constants'

const requiredText = (label, max = 120) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required.`)
    .max(max, `${label} must be ${max} characters or fewer.`)

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email address.').pipe(z.email('Enter a valid email address.')),
  password: z.string().min(1, 'Enter your password.'),
})

export const createUserSchema = z.object({
  name: requiredText('Full name', 80),
  email: z.string().trim().min(1, 'Email is required.').pipe(z.email('Enter a valid email address.')),
  role: z.enum([ROLES.ADMIN, ROLES.EXAMINER, ROLES.CANDIDATE], { error: 'Choose a role.' }),
  password: z
    .string()
    .min(8, 'Use at least 8 characters.')
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
    title: requiredText('Title', 140),
    instructions: z.string().trim().max(4000, 'Instructions must be 4000 characters or fewer.'),
    startAt: z.string().min(1, 'Choose when the exam opens.'),
    endAt: z.string().min(1, 'Choose when the exam closes.'),
    durationMinutes: wholeNumber('Duration', { max: 600 }),
    totalMarks: wholeNumber('Total marks', { max: 1000 }),
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
