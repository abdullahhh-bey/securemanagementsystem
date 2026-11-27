import { useState } from 'react'
import { cn } from '@/lib/utils'

const LOGO_DEFAULT = '/brand/fs-logo.svg'
const LOGO_ON_DARK = '/brand/fs-logo-white.svg'
const ALT = 'FS University Lahore'

// Height drives the size; width follows from the artwork's own aspect ratio.
const SIZE_CLASS = {
  sm: 'h-9',
  md: 'h-12',
  lg: 'h-16 sm:h-20',
}

const FALLBACK_TEXT_CLASS = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-xl',
}

/**
 * The FS University Lahore logo.
 *
 * - `variant="onDark"` uses the white artwork and falls back to the default
 *   artwork if it is missing.
 * - If neither file loads the image is removed and the university name is shown
 *   as plain text, so the header is never left with a broken-image icon.
 * - The artwork is never stretched, recoloured or given effects; `p-1`
 *   keeps a little clear space around it.
 */
export function BrandLogo({ size = 'md', variant = 'default', className }) {
  const [failed, setFailed] = useState({ onDark: false, default: false })
  const onDark = variant === 'onDark'

  let src = null
  if (onDark && !failed.onDark) src = LOGO_ON_DARK
  else if (!failed.default) src = LOGO_DEFAULT

  const handleError = () => {
    setFailed((current) => (src === LOGO_ON_DARK ? { ...current, onDark: true } : { ...current, default: true }))
  }

  if (!src) {
    return (
      <span
        className={cn(
          'inline-flex max-w-full p-1 font-heading font-extrabold leading-tight tracking-tight',
          FALLBACK_TEXT_CLASS[size],
          onDark ? 'text-on-dark' : 'text-ink',
          className,
        )}
      >
        {ALT}
      </span>
    )
  }

  return (
    <span className={cn('inline-flex max-w-full p-1', className)}>
      <img
        key={src}
        src={src}
        alt={ALT}
        onError={handleError}
        draggable={false}
        className={cn('w-auto max-w-full select-none object-contain object-left', SIZE_CLASS[size])}
      />
    </span>
  )
}
