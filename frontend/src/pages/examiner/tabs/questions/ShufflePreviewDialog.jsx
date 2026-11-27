import { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ErrorState } from '@/components/ErrorState'
import { Skeleton } from '@/components/ui/skeleton'
import { useShufflePreview } from '@/hooks/useQuestions'
import { QUESTION_TYPE_META } from '@/lib/constants'
import { cn } from '@/lib/utils'

const randomSeed = () => Math.floor(Math.random() * 1_000_000)

export function ShufflePreviewDialog({ open, onOpenChange, examId, hasSavedQuestions }) {
  const [seed, setSeed] = useState(() => randomSeed())
  const [session, setSession] = useState(0)
  const preview = useShufflePreview(examId, seed, { enabled: open && hasSavedQuestions })

  const handleOpenChange = (next) => {
    if (next) {
      setSeed(randomSeed())
      setSession((n) => n + 1)
    }
    onOpenChange(next)
  }

  const regenerate = () => setSeed(randomSeed())

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl" key={session}>
        <DialogHeader>
          <DialogTitle>Shuffle preview</DialogTitle>
          <DialogDescription>
            Sample papers generated with seed <span className="num font-mono">{preview.data?.seed ?? seed}</span>.
            {preview.data && (
              <>
                {' '}
                Questions {preview.data.shuffleQuestions ? 'shuffled' : 'in fixed order'} · options{' '}
                {preview.data.shuffleOptions ? 'shuffled' : 'in fixed order'}.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          {!hasSavedQuestions ? (
            <p className="text-sm text-muted">Save questions to this exam before previewing a shuffle.</p>
          ) : preview.isPending ? (
            <div className="space-y-3" role="status">
              <span className="sr-only">Loading shuffle preview</span>
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : preview.error ? (
            <ErrorState compact error={preview.error} onRetry={preview.refetch} isRetrying={preview.isRefetching} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {(preview.data?.papers ?? []).map((paper) => (
                <article key={paper.label} className="rounded-lg border border-border bg-surface p-4">
                  <h3 className="font-semibold">{paper.label}</h3>
                  <ol className="mt-3 space-y-3">
                    {paper.questions.map((q) => (
                      <li key={q.id} className="text-sm">
                        <p className="font-medium">
                          <span className="num text-muted">Q{q.number}</span> {q.text}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {QUESTION_TYPE_META[q.type]?.label ?? q.type} · {q.marks} marks
                        </p>
                        {q.options?.length > 0 && (
                          <ul className="mt-1 space-y-0.5 text-xs text-muted">
                            {q.options.map((opt, index) => (
                              <li key={opt.id} className={cn('truncate')}>
                                {String.fromCharCode(65 + index)}. {opt.text}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                </article>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
          <Button type="button" onClick={regenerate} disabled={!hasSavedQuestions || preview.isPending}>
            <RefreshCw /> Regenerate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
