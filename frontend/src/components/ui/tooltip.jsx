import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { cn } from '@/lib/utils'

export const TooltipProvider = ({ delayDuration = 150, ...props }) => (
  <TooltipPrimitive.Provider delayDuration={delayDuration} {...props} />
)

/** `<Tooltip content="...">{trigger}</Tooltip>` - trigger must accept a ref. */
export function Tooltip({ content, children, side = 'top', className }) {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-[70] max-w-xs rounded-md bg-ink px-3 py-2 text-sm leading-snug text-white',
            'animate-[fade-in_120ms_ease-out]',
            className,
          )}
        >
          {content}
          <TooltipPrimitive.Arrow className="fill-ink" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
