import {
  BadgeCheck,
  Ban,
  CircleDashed,
  CircleCheck,
  CircleDot,
  CirclePlay,
  ClipboardCheck,
  ClipboardPaste,
  Clock,
  DoorOpen,
  Gavel,
  GraduationCap,
  Hourglass,
  LockKeyhole,
  Maximize,
  MonitorOff,
  PencilLine,
  Scale,
  Send,
  ShieldCheck,
  Signal,
  SignalLow,
  SignalZero,
  Unplug,
  UserCheck,
  TriangleAlert,
  UserX,
  EyeOff,
  Wifi,
  WifiOff,
  FileCheck2,
  Flag,
  Search,
  CircleHelp,
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

// --- questions, results, monitoring, disputes -------------------------------------

export const DIFFICULTY_META = {
  easy: { label: 'Easy', icon: Signal, tone: 'success' },
  medium: { label: 'Medium', icon: SignalLow, tone: 'warning' },
  hard: { label: 'Hard', icon: SignalZero, tone: 'danger' },
}
export const DIFFICULTY_OPTIONS = Object.entries(DIFFICULTY_META).map(([value, meta]) => ({ value, label: meta.label }))

export const QUESTION_TYPE_META = {
  MCQ_SINGLE: { label: 'Single answer', short: 'Single' },
  MCQ_MULTI: { label: 'Multiple select', short: 'Multi' },
  WRITTEN: { label: 'Written response', short: 'Written' },
}
export const QUESTION_TYPE_OPTIONS = Object.entries(QUESTION_TYPE_META).map(([value, meta]) => ({ value, label: meta.label }))

export const MARKING_RULES = {
  ALL_OR_NOTHING: 'All or nothing',
  PARTIAL: 'Partial credit with penalty',
}

/** Where an exam's results stand. Always decided by the server. */
export const RESULTS_STATE_META = {
  NOT_READY: { label: 'Not ready', icon: Hourglass, tone: 'neutral' },
  UNGRADED: { label: 'Ungraded', icon: PencilLine, tone: 'warning' },
  GRADED: { label: 'Graded', icon: ClipboardCheck, tone: 'info' },
  PUBLISHED: { label: 'Published', icon: FileCheck2, tone: 'success' },
}

export const CONNECTION_META = {
  ONLINE: { label: 'Online', icon: Wifi, tone: 'success' },
  UNSTABLE: { label: 'Unstable', icon: Unplug, tone: 'warning' },
  OFFLINE: { label: 'Offline', icon: WifiOff, tone: 'danger' },
  ENDED: { label: 'Submitted', icon: CircleCheck, tone: 'neutral' },
}

export const INCIDENT_META = {
  TAB_HIDDEN: { label: 'Left the exam tab', icon: EyeOff },
  FULLSCREEN_EXIT: { label: 'Left full-screen mode', icon: Maximize },
  PASTE_DETECTED: { label: 'Pasted text into an answer', icon: ClipboardPaste },
  CONNECTION_LOST: { label: 'Connection lost', icon: WifiOff },
  CONNECTION_UNSTABLE: { label: 'Unstable connection', icon: MonitorOff },
}

export const DISPUTE_STATUS_META = {
  OPEN: { label: 'Open', icon: CircleDot, tone: 'warning' },
  UNDER_REVIEW: { label: 'Under review', icon: Search, tone: 'info' },
  RESOLVED: { label: 'Resolved', icon: CircleCheck, tone: 'success' },
}

export const DISPUTE_OUTCOME_META = {
  UPHELD: { label: 'Upheld', icon: Gavel, tone: 'success' },
  PARTIALLY_UPHELD: { label: 'Partially upheld', icon: Scale, tone: 'info' },
  REJECTED: { label: 'Rejected', icon: Ban, tone: 'neutral' },
}

export const DISPUTE_CATEGORY_META = {
  GRADING_ERROR: { label: 'Grading error', description: 'My answer was marked incorrectly.', icon: Flag },
  AMBIGUOUS_QUESTION: { label: 'Ambiguous question', description: 'The question or its options can be read in more than one way.', icon: CircleHelp },
  TECHNICAL_INCIDENT: { label: 'Technical incident', description: 'A connection or device problem affected my attempt.', icon: Unplug },
}

export const AUDIT_ACTION_LABELS = {
  ANNOUNCEMENT_SENT: 'Announcement sent',
  COMPENSATION_GRANTED: 'Time compensation granted',
  DISPUTE_RAISED: 'Dispute raised',
  DISPUTE_RESOLVED: 'Dispute resolved',
  DISPUTE_REVIEW_STARTED: 'Dispute review started',
  EXAM_CREATED: 'Exam created',
  EXAM_PUBLISHED: 'Exam published',
  GRADE_SAVED: 'Written answer graded',
  PASSWORD_RESET: 'Password reset',
  QUESTION_CREATED: 'Question created',
  QUESTIONS_IMPORTED: 'Questions imported',
  RESULTS_PUBLISHED: 'Results published',
  SANDBOX_STARTED: 'Sandbox preview started',
  USER_CREATED: 'User created',
  USER_UPDATED: 'User updated',
  USERS_IMPORTED: 'Users imported',
}
