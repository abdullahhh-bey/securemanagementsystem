import { cn } from '@/lib/utils'

export function Card({ className, as: Comp = 'div', ...props }) {
  return <Comp className={cn('rounded-lg border border-border bg-surface', className)} {...props} />
}

export function CardHeader({ className, ...props }) {
  return <div className={cn('flex flex-col gap-1 border-b border-border px-6 py-4', className)} {...props} />
}

export function CardTitle({ as: Comp = 'h2', className, ...props }) {
  return <Comp className={cn('font-heading text-base font-semibold', className)} {...props} />
}

export function CardDescription({ className, ...props }) {
  return <p className={cn('text-sm text-muted', className)} {...props} />
}

export function CardContent({ className, ...props }) {
  return <div className={cn('p-6', className)} {...props} />
}
