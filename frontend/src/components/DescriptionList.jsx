import { cn } from '@/lib/utils'

/** Label/value pairs as a semantic <dl>. items: [{ label, value, mono?, wide? }] */
export function DescriptionList({ items, className }) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-5 sm:grid-cols-2', className)}>
      {items.map(({ label, value, mono = false, wide = false }) => (
        <div key={label} className={cn('min-w-0', wide && 'sm:col-span-2')}>
          <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
          <dd className={cn('num mt-1 text-base leading-relaxed', mono && 'tabular-nums', wide && 'whitespace-pre-wrap')}>{value || '-'}</dd>
        </div>
      ))}
    </dl>
  )
}
