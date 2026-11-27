import { cn } from '@/lib/utils'

/** Icon + what's missing + the next action. */
export function EmptyState({ icon: Icon, title, description, action, className, compact = false, titleAs: Title = 'h2' }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        compact ? 'px-4 py-10' : 'rounded-lg border border-dashed border-input/60 bg-surface px-6 py-16',
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-sunken text-muted" aria-hidden="true">
          <Icon className="size-6" />
        </span>
      )}
      <Title className="text-base font-semibold">{title}</Title>
      {description && <p className="mt-1.5 max-w-md text-pretty text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
