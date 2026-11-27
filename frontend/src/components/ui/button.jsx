import { Slot } from '@radix-ui/react-slot'
import { cva } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Tooltip } from './tooltip'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap font-sans font-semibold transition-colors ' +
    'disabled:pointer-events-none disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 ' +
    '[&_svg]:size-4 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-on-primary hover:bg-primary-hover aria-disabled:hover:bg-primary',
        secondary: 'border border-input bg-surface text-ink hover:bg-sunken aria-disabled:hover:bg-surface',
        ghost: 'text-ink hover:bg-sunken aria-disabled:hover:bg-transparent',
        danger: 'bg-danger text-on-primary hover:bg-danger-hover',
        'danger-outline':
          'border border-danger/60 bg-surface text-danger hover:bg-danger-soft aria-disabled:hover:bg-surface',
        link: 'h-auto rounded-sm p-0 text-primary underline-offset-4 hover:text-primary-hover hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-6 text-base',
        icon: 'size-10',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
)

/**
 * - `loading`: shows a spinner and blocks clicks (prevents double submits).
 * - `loadingLabel`: replaces children while loading so the user knows what is happening.
 * - `disabledReason`: disables the control but keeps it focusable and explains why.
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel,
  disabledReason,
  disabled,
  children,
  onClick,
  type = 'button',
  ref,
  ...props
}) {
  const Comp = asChild ? Slot : 'button'
  const blocked = loading || Boolean(disabledReason)

  const button = (
    <Comp
      ref={ref}
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      onClick={(event) => {
        if (blocked) {
          event.preventDefault()
          return
        }
        onClick?.(event)
      }}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" aria-hidden="true" />}
          {loading && loadingLabel ? loadingLabel : children}
        </>
      )}
    </Comp>
  )

  if (!disabledReason) return button
  return <Tooltip content={disabledReason}>{button}</Tooltip>
}
