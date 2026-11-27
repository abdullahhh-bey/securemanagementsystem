import { useState } from 'react'
import { CircleAlert, Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/useToast'
import { saveBlob } from '@/lib/download'

/**
 * A download button with loading and error states.
 *
 *   <DownloadButton label="Download PDF report" action={() => downloadExamReport(examId)} icon="pdf" />
 *
 * `action` resolves to `{ blob, filename }` (what the *_report / export API functions return).
 * While running the button is locked and shows a spinner; on failure an inline alert explains and offers a retry.
 */
export function DownloadButton({ label, action, icon = 'download', variant = 'secondary', size, disabledReason, className }) {
  const toast = useToast()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState(null)
  const Icon = icon === 'pdf' ? FileText : Download

  const run = async () => {
    setPending(true)
    setError(null)
    try {
      const { blob, filename } = await action()
      saveBlob(blob, filename)
      toast.success(`${filename} downloaded`)
    } catch (err) {
      setError(err.message || 'The file could not be created. Please try again.')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className={className}>
      <Button variant={variant} size={size} loading={pending} onClick={run} disabledReason={disabledReason}>
        {!pending && <Icon />}
        {pending ? 'Preparing\u2026' : label}
      </Button>
      {error && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-sm font-medium text-danger">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>
            {error}{' '}
            <button type="button" onClick={run} className="rounded-sm font-semibold underline underline-offset-2">
              Try again
            </button>
          </span>
        </p>
      )}
    </div>
  )
}
