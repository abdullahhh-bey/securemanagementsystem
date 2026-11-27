import { useId } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ErrorState'
import { cn } from '@/lib/utils'

/**
 * Every chart in the app lives in one of these: a clear title, a one-line
 * takeaway (the insight in plain words) and the chart itself.
 *
 *   <ChartCard title="Most skipped questions" takeaway="Q4 was skipped by 40% of candidates."
 *              isLoading={q.isPending} error={q.error} onRetry={q.refetch} empty={rows.length === 0} emptyText="...">
 *     <MyChart />
 *   </ChartCard>
 *
 * Give the chart itself an accessible description (role="img" + aria-label) or a data table fallback.
 */
export function ChartCard({ title, takeaway, children, isLoading = false, error, onRetry, isRetrying, empty = false, emptyText = 'No data yet.', className, chartHeight = 'h-64' }) {
  const id = useId()
  return (
    <Card as="section" aria-labelledby={id} className={className}>
      <CardHeader>
        <CardTitle as="h3" id={id}>
          {title}
        </CardTitle>
        {takeaway && !isLoading && !error && !empty && <p className="text-sm font-medium text-ink">{takeaway}</p>}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div role="status">
            <span className="sr-only">Loading chart</span>
            <Skeleton className={cn('w-full', chartHeight)} />
          </div>
        ) : error ? (
          <ErrorState compact error={error} onRetry={onRetry} isRetrying={isRetrying} />
        ) : empty ? (
          <p className={cn('flex items-center justify-center rounded-lg bg-sunken px-4 text-center text-sm text-muted', chartHeight)}>{emptyText}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
