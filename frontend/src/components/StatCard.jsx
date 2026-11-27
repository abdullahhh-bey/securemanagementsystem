import { Link } from 'react-router-dom'
import { cva } from 'class-variance-authority'
import { ArrowUpRight } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

const iconTone = cva('flex size-10 items-center justify-center rounded-lg [&_svg]:size-5', {
  variants: {
    tone: {
      neutral: 'bg-sunken text-ink',
      brand: 'bg-sky text-primary-hover',
      success: 'bg-success-soft text-success',
      warning: 'bg-warning-soft text-warning',
      danger: 'bg-danger-soft text-danger',
      info: 'bg-info-soft text-info',
    },
  },
  defaultVariants: { tone: 'neutral' },
})

export function StatCard({ label, value, icon: Icon, tone, hint, to, loading = false, className }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium text-muted">{label}</p>
        {Icon && (
          <span className={iconTone({ tone })} aria-hidden="true">
            <Icon />
          </span>
        )}
      </div>
      <div className="mt-2">
        {loading ? (
          <Skeleton className="h-9 w-16" />
        ) : (
          <p className="stat-number text-3xl leading-none">{value}</p>
        )}
      </div>
      {(hint || to) && (
        <div className="mt-3 flex items-center gap-1 text-sm text-muted">
          {loading ? <Skeleton className="h-4 w-28" /> : <span>{hint}</span>}
          {to && <ArrowUpRight className="ml-auto size-4" aria-hidden="true" />}
        </div>
      )}
    </>
  )

  const classes = cn('block p-5', className)
  if (to) {
    return (
      <Card as={Link} to={to} className={cn(classes, 'transition-colors hover:border-primary/50 hover:bg-sky/40')}>
        {body}
      </Card>
    )
  }
  return <Card className={classes}>{body}</Card>
}
