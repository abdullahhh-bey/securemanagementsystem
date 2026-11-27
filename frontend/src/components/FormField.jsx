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
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>
        {label}
        {required && (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        )}
      </Label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy, 'aria-required': required || undefined })}
      {hint ? (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-sm font-normal text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : (
        <span id={errorId} className="sr-only" />
      )}
    </div>
  )
}
