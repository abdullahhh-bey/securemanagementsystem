import { useId } from 'react'
import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'
import { Tooltip } from './tooltip'

/**
 * `disabledReason` keeps the switch focusable (aria-disabled) and explains in a
 * tooltip why it can't be changed, instead of silently removing it from the tab order.
 */
export function Switch({ className, disabledReason, onCheckedChange, ...props }) {
  const reasonId = useId()
  const control = (
    <SwitchPrimitive.Root
      aria-disabled={disabledReason ? true : undefined}
      aria-describedby={disabledReason ? reasonId : props['aria-describedby']}
      onCheckedChange={(value) => {
        if (!disabledReason) onCheckedChange?.(value)
      }}
      className={cn(
        'peer inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-input bg-sunken p-0.5 transition-colors',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary disabled:cursor-not-allowed disabled:opacity-50',
        'aria-disabled:cursor-not-allowed aria-disabled:opacity-60',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb className="block size-4.5 rounded-full bg-ink transition-transform data-[state=checked]:translate-x-5 data-[state=checked]:bg-white" />
    </SwitchPrimitive.Root>
  )

  if (!disabledReason) return control
  // The tooltip trigger is a wrapper: Tooltip.Trigger would otherwise overwrite
  // the switch's own `data-state` (checked/unchecked) used for styling.
  return (
    <Tooltip content={disabledReason}>
      <span className="inline-flex">
        {control}
        <span id={reasonId} className="sr-only">
          {disabledReason}
        </span>
      </span>
    </Tooltip>
  )
}
