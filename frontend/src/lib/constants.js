import {
  BadgeCheck,
  CircleDashed,
  CircleCheck,
  CirclePlay,
  Clock,
  DoorOpen,
  GraduationCap,
  LockKeyhole,
  PencilLine,
  Send,
  ShieldCheck,
  UserCheck,
  TriangleAlert,
  UserX,
} from 'lucide-react'

export const ROLES = {
  ADMIN: 'ADMIN',
  EXAMINER: 'EXAMINER',
  CANDIDATE: 'CANDIDATE',
}

export const ROLE_META = {
  ADMIN: { label: 'Admin', icon: ShieldCheck, home: '/admin' },
  EXAMINER: { label: 'Examiner', icon: PencilLine, home: '/examiner' },
  CANDIDATE: { label: 'Candidate', icon: GraduationCap, home: '/candidate' },
}

export const ROLE_OPTIONS = Object.entries(ROLE_META).map(([value, meta]) => ({ value, label: meta.label }))

export function roleHome(role) {
  return ROLE_META[role]?.home ?? '/login'
}

/**
 * Presentation metadata for every status the UI can show. Statuses always
 * come from the server; this only maps them to a label, an icon and a tone.
 */
export const EXAM_STATUS_META = {
  DRAFT: { label: 'Draft', icon: CircleDashed, tone: 'neutral' },
  PUBLISHED: { label: 'Published', icon: Send, tone: 'info' },
  ONGOING: { label: 'Live now', icon: CirclePlay, tone: 'success' },
  COMPLETED: { label: 'Completed', icon: CircleCheck, tone: 'neutral' },
}

export const ACCESS_STATUS_META = {
  AVAILABLE: { label: 'Enter exam', icon: DoorOpen, tone: 'success' },
  UPCOMING: { label: 'Not open yet', icon: Clock, tone: 'info' },
  CLOSED: { label: 'Closed', icon: LockKeyhole, tone: 'neutral' },
}

export const ACCOUNT_STATUS_META = {
  ACTIVE: { label: 'Active', icon: UserCheck, tone: 'success' },
  INACTIVE: { label: 'Inactive', icon: UserX, tone: 'neutral' },
}

export const CHECK_STATUS_META = {
  READY: { label: 'Ready', icon: BadgeCheck, tone: 'success' },
  ATTENTION: { label: 'Needs attention', icon: TriangleAlert, tone: 'warning' },
}

export const SETTING_DEFS = [
  { key: 'shuffleQuestions', label: 'Shuffle questions', description: 'Each candidate sees the questions in a different order.' },
  { key: 'shuffleOptions', label: 'Shuffle options', description: 'Answer options are reordered for every candidate.' },
  { key: 'negativeMarking', label: 'Negative marking', description: 'Wrong answers deduct marks.' },
]

export const LIFECYCLE_STEPS = ['DRAFT', 'PUBLISHED', 'ONGOING', 'COMPLETED']
