import { QRCodeSVG } from 'qrcode.react'
import { ShieldCheck } from 'lucide-react'
import { formatDateTime } from '@/lib/format'

/**
 * Verification block for report previews: the verification ID, a QR code that
 * encodes the verify URL, and when the report was generated.
 * `report` is the object returned by getExamReportPreview / getCandidateReportPreview.
 */
export function VerificationPanel({ report }) {
  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-sky p-4 sm:flex-row sm:items-center">
      <div className="shrink-0 self-start rounded-md bg-surface p-2 text-ink sm:self-center">
        <QRCodeSVG
          value={report.verifyUrl}
          size={104}
          level="M"
          fgColor="currentColor"
          bgColor="transparent"
          role="img"
          aria-label={`QR code for ${report.verifyUrl}`}
        />
      </div>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <ShieldCheck className="size-4 text-primary" aria-hidden="true" />
          Verification ID
        </p>
        <p className="num mt-1 break-all text-xl font-semibold tracking-wide" data-testid="verification-id">
          {report.verificationId}
        </p>
        <p className="mt-2 break-all text-xs text-muted">Scan the code or open {report.verifyUrl} to confirm this report is genuine.</p>
        <p className="mt-1 text-xs text-muted">Generated {formatDateTime(report.generatedAt)}</p>
      </div>
    </div>
  )
}
