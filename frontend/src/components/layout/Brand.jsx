import { ShieldCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Brand({ onDark = false, size = 'md', className }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <span
        className={cn(
          'flex items-center justify-center rounded-lg bg-primary text-white',
          size === 'lg' ? 'size-11' : 'size-9',
        )}
        aria-hidden="true"
      >
        <ShieldCheck className={size === 'lg' ? 'size-6' : 'size-5'} />
      </span>
      <span className={cn('font-heading font-extrabold tracking-tight', size === 'lg' ? 'text-2xl' : 'text-xl', onDark ? 'text-white' : 'text-ink')}>
        Quillmark
      </span>
    </span>
  )
}
