import { cva } from 'class-variance-authority'
import {
  ACCESS_STATUS_META, ACCOUNT_STATUS_META, CHECK_STATUS_META, CONNECTION_META, DIFFICULTY_META, DISPUTE_OUTCOME_META,
  DISPUTE_STATUS_META, EXAM_STATUS_META, RESULTS_STATE_META, ROLE_META,
} from '@/lib/constants'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-md border px-2 py-0.5 font-sans text-xs font-semibold [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      tone: {
        neutral: 'border-border bg-sunken text-muted',
        brand: 'border-primary/25 bg-sky text-primary-hover',
        success: 'border-success/30 bg-success-soft text-success',
        warning: 'border-warning/30 bg-warning-soft text-warning',
        danger: 'border-danger/30 bg-danger-soft text-danger',
        info: 'border-info/30 bg-info-soft text-info',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
)

/** Base pill: always an icon plus a text label, never colour alone. */
export function Badge({ tone, icon: Icon, children, className, ...props }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {Icon && <Icon aria-hidden="true" />}
      {children}
    </span>
  )
}

const REGISTRY = {
  exam: EXAM_STATUS_META,
  access: ACCESS_STATUS_META,
  account: ACCOUNT_STATUS_META,
  check: CHECK_STATUS_META,
  results: RESULTS_STATE_META,
  connection: CONNECTION_META,
  difficulty: DIFFICULTY_META,
  dispute: DISPUTE_STATUS_META,
  outcome: DISPUTE_OUTCOME_META,
}

/**
 * <StatusBadge kind="exam" status="ONGOING" />  (kinds: exam, access, account, check, results, connection, difficulty, dispute, outcome)
 * `status` is whatever string the server sent; `label` overrides the text.
 */
export function StatusBadge({ kind = 'exam', status, label, className }) {
  const meta = REGISTRY[kind]?.[status]
  if (!meta) return <Badge className={className}>{label ?? status}</Badge>
  return (
    <Badge tone={meta.tone} icon={meta.icon} className={className}>
      {label ?? meta.label}
    </Badge>
  )
}

export function RoleChip({ role, className }) {
  const meta = ROLE_META[role]
  if (!meta) return <Badge className={className}>{role}</Badge>
  return (
    <Badge tone="brand" icon={meta.icon} className={className}>
      {meta.label}
    </Badge>
  )
}
