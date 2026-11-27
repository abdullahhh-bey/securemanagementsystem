import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const controlClasses =
  'w-full rounded-md border border-input bg-surface px-3 font-sans text-sm font-normal text-ink placeholder:text-muted ' +
  'transition-colors hover:border-ink/60 disabled:cursor-not-allowed disabled:bg-sunken disabled:opacity-70 ' +
  'aria-invalid:border-danger aria-invalid:ring-1 aria-invalid:ring-danger'

export function Input({ className, type = 'text', ref, ...props }) {
  return <input ref={ref} type={type} className={cn(controlClasses, 'h-10', className)} {...props} />
}

export function Textarea({ className, ref, ...props }) {
  return <textarea ref={ref} className={cn(controlClasses, 'min-h-28 resize-y py-2 leading-relaxed', className)} {...props} />
}

/** Native <select> keeps full keyboard + screen reader support for free. */
export function Select({ className, children, ref, ...props }) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlClasses, 'h-10 appearance-none pr-9', className)} {...props}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
    </div>
  )
}
