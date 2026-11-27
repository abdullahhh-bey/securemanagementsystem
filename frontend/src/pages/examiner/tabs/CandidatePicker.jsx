import { useId, useMemo, useState } from 'react'
import { Search, UserSearch } from 'lucide-react'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/EmptyState'

/**
 * Searchable multi-select. `candidates`: [{ id, name, email }],
 * `selected`: string[] of ids, `onChange(ids)`.
 */
export function CandidatePicker({ candidates, selected, onChange, isLoading = false, disabled = false, label = 'Search candidates' }) {
  const uid = useId()
  const [query, setQuery] = useState('')

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? candidates.filter((c) => `${c.name} ${c.email}`.toLowerCase().includes(q)) : candidates
  }, [candidates, query])

  const selectedSet = new Set(selected)
  const shownSelected = shown.filter((c) => selectedSet.has(c.id)).length
  const allShown = shown.length > 0 && shownSelected === shown.length
  const someShown = shownSelected > 0 && !allShown

  const toggle = (id, checked) => onChange(checked ? [...selected, id] : selected.filter((x) => x !== id))
  const toggleAllShown = (checked) => {
    const shownIds = new Set(shown.map((c) => c.id))
    onChange(checked ? [...new Set([...selected, ...shownIds])] : selected.filter((id) => !shownIds.has(id)))
  }

  return (
    <div>
      <div className="relative">
        <label htmlFor={`${uid}-search`} className="sr-only">
          {label}
        </label>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <Input
          id={`${uid}-search`}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name or email"
          className="pl-9"
          disabled={disabled || isLoading}
        />
      </div>

      <div className="mt-3 rounded-lg border border-border">
        {isLoading ? (
          <div className="space-y-3 p-4" role="status">
            <span className="sr-only">Loading candidates</span>
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : shown.length === 0 ? (
          <EmptyState
            compact
            icon={UserSearch}
            title={candidates.length === 0 ? 'Everyone is already enrolled' : 'No candidates match'}
            description={candidates.length === 0 ? 'All active candidate accounts are enrolled in this exam.' : 'Try a different name or email.'}
          />
        ) : (
          <>
            <div className="flex items-center gap-3 border-b border-border bg-sky px-4 py-2.5">
              <Checkbox
                id={`${uid}-all`}
                checked={allShown ? true : someShown ? 'indeterminate' : false}
                onCheckedChange={(checked) => toggleAllShown(checked === true)}
                disabled={disabled}
              />
              <label htmlFor={`${uid}-all`} className="flex-1 cursor-pointer text-sm font-medium">
                Select all {query ? 'matching' : ''} ({shown.length})
              </label>
            </div>
            <ul role="group" aria-label="Candidates" className="max-h-72 divide-y divide-border overflow-y-auto">
              {shown.map((candidate) => (
                <li key={candidate.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-sky/60">
                  <Checkbox
                    id={`${uid}-${candidate.id}`}
                    checked={selectedSet.has(candidate.id)}
                    onCheckedChange={(checked) => toggle(candidate.id, checked === true)}
                    disabled={disabled}
                  />
                  <label htmlFor={`${uid}-${candidate.id}`} className="min-w-0 flex-1 cursor-pointer">
                    <span className="block truncate text-sm font-medium">{candidate.name}</span>
                    <span className="block truncate text-xs text-muted">{candidate.email}</span>
                  </label>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  )
}
