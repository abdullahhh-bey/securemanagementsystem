import { Check, Minus } from 'lucide-react'
import { SETTING_DEFS } from '@/lib/constants'
import { cn } from '@/lib/utils'

/** Read-only list of exam settings: icon + "On"/"Off" text, never colour alone. */
export function ExamSettings({ settings }) {
  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {SETTING_DEFS.map(({ key, label, description }) => {
        const on = Boolean(settings?.[key])
        return (
          <li key={key} className="flex items-start gap-3 p-3">
            <span
              className={cn(
                'mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full',
                on ? 'bg-success-soft text-success' : 'bg-sunken text-muted',
              )}
              aria-hidden="true"
            >
              {on ? <Check className="size-3.5" strokeWidth={3} /> : <Minus className="size-3.5" strokeWidth={3} />}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">
                {label} <span className="font-normal text-muted">{'\u00b7'} {on ? 'On' : 'Off'}</span>
              </p>
              {description ? <p className="text-sm text-muted">{description}</p> : null}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
