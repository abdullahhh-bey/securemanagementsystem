import * as DialogPrimitive from '@radix-ui/react-dialog'
import { CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useIncidents } from '@/hooks/useMonitor'
import { INCIDENT_META } from '@/lib/constants'
import { formatDateTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import { formatAgo, useTick } from './time'

export const INCIDENT_NOTE = 'Indicators only, not evidence of misconduct.'
export const INCIDENT_NOTE_DETAIL =
  'These are automatic signals, for example a connection drop or leaving the tab. Always talk to the candidate before drawing conclusions.'

function IncidentList({ incidents }) {
  const now = useTick(5000)
  return (
    <ol className="space-y-3" aria-label="Incidents, newest first">
      {incidents.map((incident) => {
        const meta = INCIDENT_META[incident.type]
        const Icon = meta?.icon ?? TriangleAlert
        return (
          <li key={incident.id} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning" aria-hidden="true">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{meta?.label ?? incident.label}</p>
              {incident.detail && <p className="mt-0.5 text-sm text-muted">{incident.detail}</p>}
              <p className="num mt-1 text-xs text-muted">
                <time dateTime={incident.at}>{formatDateTime(incident.at)}</time>
                <span aria-hidden="true"> {'\u00b7'} </span>
                <span>{formatAgo(incident.at, now)}</span>
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}

/**
 * Right-hand drawer built on Radix Dialog: focus is trapped, Esc closes it, and it has a title
 * and description. It slides in with a CSS transition, which the global reduced-motion rule switches off.
 */
export function IncidentDrawer({ open, onOpenChange, examId, attempt }) {
  const incidents = useIncidents(examId, attempt?.id, { enabled: open })
  const name = attempt?.candidate?.name ?? 'Candidate'

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn('fixed inset-0 z-50 bg-ink/50 transition-opacity duration-200 starting:opacity-0')}
        />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-y-0 right-0 z-50 flex h-dvh w-full max-w-md flex-col border-l border-border bg-surface shadow-dialog',
            'transition-transform duration-200 ease-out starting:translate-x-full',
          )}
        >
          <div className="flex items-start gap-3 border-b border-border px-5 py-4">
            <div className="min-w-0 flex-1">
              <DialogPrimitive.Title className="font-heading text-lg font-bold tracking-tight">
                Incidents for {name}
              </DialogPrimitive.Title>
              <DialogPrimitive.Description className="mt-1 text-sm text-muted">
                Automatic signals recorded during this attempt, newest first.
              </DialogPrimitive.Description>
            </div>
            <DialogPrimitive.Close
              aria-label="Close incidents"
              className="inline-flex size-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
            >
              <X className="size-4" aria-hidden="true" />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div role="note" className="flex gap-3 rounded-lg border border-info/30 bg-info-soft p-4 text-info">
              <Info className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
              <div>
                <p className="font-bold">{INCIDENT_NOTE}</p>
                <p className="mt-1 text-sm text-ink">{INCIDENT_NOTE_DETAIL}</p>
              </div>
            </div>

            {incidents.isPending ? (
              <div className="space-y-3" role="status">
                <span className="sr-only">Loading incidents</span>
                {[0, 1, 2].map((n) => (
                  <Skeleton key={n} className="h-16 w-full" />
                ))}
              </div>
            ) : incidents.error ? (
              <ErrorState compact error={incidents.error} onRetry={incidents.refetch} isRetrying={incidents.isRefetching} title="We couldn't load the incidents" />
            ) : incidents.data.incidents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success" aria-hidden="true">
                  <CircleCheck className="size-6" />
                </span>
                <p className="font-semibold">No incidents recorded</p>
                <p className="max-w-xs text-sm text-muted">Nothing unusual has been picked up for {name} so far.</p>
              </div>
            ) : (
              <IncidentList incidents={incidents.data.incidents} />
            )}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
