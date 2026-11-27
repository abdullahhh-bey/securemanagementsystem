import { useId } from 'react'
import { CircleAlert } from 'lucide-react'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/**
 * Label + control + hint + inline error, wired together for assistive tech.
 *
 *   <FormField label="Title" error={errors.title?.message}>
 *     {(field) => <Input {...field} {...register('title')} />}
 *   </FormField>
 *
 * `field` carries id, aria-invalid and aria-describedby.
 */
export function FormField({ label, error, hint, required = false, className, children }) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint && (
        <p id={hintId} className="text-sm text-muted">
          {hint}
        </p>
      )}
      <p id={errorId} aria-live="polite" className={cn('flex items-start gap-1.5 text-sm font-medium text-danger', !error && 'hidden')}>
        {error && (
          <>
            <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </>
        )}
      </p>
    </div>
  )
}
