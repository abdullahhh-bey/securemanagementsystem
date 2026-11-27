import { CircleAlert, CircleCheck, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const TONES = {
  success: { icon: CircleCheck, label: 'Success', accent: 'text-success', bar: 'bg-success' },
  error: { icon: CircleAlert, label: 'Error', accent: 'text-danger', bar: 'bg-danger' },
  info: { icon: Info, label: 'Notice', accent: 'text-info', bar: 'bg-info' },
}

function ToastItem({ toast, onDismiss }) {
  const tone = TONES[toast.tone]
  const Icon = tone.icon
  return (
    <div className="pointer-events-auto relative flex w-full gap-3 overflow-hidden rounded-lg border border-border bg-surface py-3 pl-5 pr-3 shadow-toast animate-[toast-in_180ms_ease-out]">
      <span className={cn('absolute inset-y-0 left-0 w-1', tone.bar)} aria-hidden="true" />
      <Icon className={cn('mt-0.5 size-5 shrink-0', tone.accent)} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">
          <span className="sr-only">{tone.label}: </span>
          {toast.title}
        </p>
        {toast.description && <p className="mt-0.5 text-sm text-muted">{toast.description}</p>}
        {toast.action && (
          <Button
            variant="secondary"
            size="sm"
            className="mt-2"
            onClick={() => {
              toast.action.onClick()
              onDismiss(toast.id)
            }}
          >
            {toast.action.label}
          </Button>
        )}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-ink"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  )
}

/**
 * Two permanent live regions: errors are announced assertively, everything else
 * politely. The regions must exist before content is added for screen readers
 * to pick the messages up.
 */
export function Toaster({ toasts, onDismiss }) {
  const errors = toasts.filter((toast) => toast.tone === 'error')
  const others = toasts.filter((toast) => toast.tone !== 'error')
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[80] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-96">
      <div role="alert" aria-live="assertive" className="flex w-full flex-col gap-2">
        {errors.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <div role="status" aria-live="polite" className="flex w-full flex-col gap-2">
        {others.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  )
}
