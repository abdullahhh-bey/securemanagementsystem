import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = DialogPrimitive.Root
export const DialogTrigger = DialogPrimitive.Trigger
export const DialogClose = DialogPrimitive.Close
export const DialogTitle = ({ className, ...props }) => (
  <DialogPrimitive.Title className={cn('font-heading text-lg font-semibold tracking-tight', className)} {...props} />
)
export const DialogDescription = ({ className, ...props }) => (
  <DialogPrimitive.Description className={cn('text-sm text-muted', className)} {...props} />
)

export const DialogOverlay = ({ className, ...props }) => (
  <DialogPrimitive.Overlay
    className={cn('fixed inset-0 z-50 bg-ink/50 animate-[fade-in_150ms_ease-out]', className)}
    {...props}
  />
)

export function DialogContent({ className, children, hideClose = false, ...props }) {
  return (
    <DialogPrimitive.Portal>
      <DialogOverlay />
      <DialogPrimitive.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-32px)] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col',
          'rounded-xl border border-border bg-surface shadow-dialog animate-[pop-in_150ms_ease-out]',
          className,
        )}
        {...props}
      >
        {children}
        {!hideClose && (
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="absolute right-4 top-4 inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  )
}

export const DialogHeader = ({ className, ...props }) => (
  <div className={cn('flex flex-col gap-1 px-6 pb-2 pr-14 pt-6', className)} {...props} />
)

export const DialogBody = ({ className, ...props }) => (
  <div className={cn('flex-1 overflow-y-auto px-6 py-4', className)} {...props} />
)

export const DialogFooter = ({ className, ...props }) => (
  <div className={cn('flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end', className)} {...props} />
)
