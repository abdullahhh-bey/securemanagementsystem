import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Horizontal step indicator. Each step shows an icon/number AND a text state
 * ("Done", "Current", "Upcoming") so colour is never the only signal.
 *
 * steps:   [{ key, label, icon? }]
 * current: index of the active step; `complete` marks every step as done.
 */
export function Stepper({ steps, current, complete = false, label = 'Progress', className }) {
  return (
    <nav aria-label={label} className={className}>
      <ol className="flex w-full items-start">
        {steps.map((step, index) => {
          const done = complete || index < current
          const active = !complete && index === current
          const Icon = step.icon
          const last = index === steps.length - 1
          const state = done ? 'Done' : active ? 'Current step' : 'Upcoming'
          return (
            <li key={step.key} className={cn('relative flex flex-1 flex-col items-center gap-2 text-center')} aria-current={active ? 'step' : undefined}>
              {!last && (
                <span
                  aria-hidden="true"
                  className={cn('absolute left-1/2 top-4 h-0.5 w-full', done ? 'bg-primary' : 'bg-border')}
                />
              )}
              <span
                aria-hidden="true"
                className={cn(
                  'relative z-10 flex size-8 items-center justify-center rounded-full border-2 text-sm font-semibold',
                  done && 'border-primary bg-primary text-white',
                  active && 'border-primary bg-surface text-primary-hover ring-4 ring-primary-soft',
                  !done && !active && 'border-input bg-surface text-muted',
                )}
              >
                {done ? <Check className="size-4" strokeWidth={3} /> : Icon ? <Icon className="size-4" /> : index + 1}
              </span>
              <span className="min-w-20 px-1">
                <span className={cn('block text-sm font-semibold', !done && !active && 'text-muted')}>{step.label}</span>
                <span className="block text-xs text-muted">{state}</span>
              </span>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
