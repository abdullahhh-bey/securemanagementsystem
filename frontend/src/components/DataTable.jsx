import { useId, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, Search, SearchX, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Select } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/EmptyState'
import { ErrorState } from '@/components/ErrorState'
import { cn } from '@/lib/utils'

/**
 * Generic table with client-side search, select filters, sorting and pagination.
 *
 * columns: [{ key, header, cell?(row), sortValue?(row), className?, headerClassName? }]
 * filters: [{ id, label, options: [{ value, label }], match?(row, value) }]   (value "" = all)
 * searchText(row) -> string used by the search box
 */
export function DataTable({
  caption,
  columns,
  rows,
  rowKey = (row) => row.id,
  searchText,
  searchLabel = 'Search',
  searchPlaceholder = 'Search\u2026',
  filters = [],
  pageSize = 8,
  isLoading = false,
  error = null,
  onRetry,
  isRetrying = false,
  emptyState,
  toolbarActions,
  initialSort,
  initialFilters,
}) {
  const uid = useId()
  const [search, setSearch] = useState('')
  const [filterValues, setFilterValues] = useState(initialFilters ?? {})
  const [sort, setSort] = useState(initialSort ?? null) // { key, dir }
  const [page, setPage] = useState(1)

  const hasActiveFilters = search.trim() !== '' || Object.values(filterValues).some(Boolean)

  const processed = useMemo(() => {
    let result = rows ?? []
    const q = search.trim().toLowerCase()
    if (q && searchText) result = result.filter((row) => searchText(row).toLowerCase().includes(q))
    for (const filter of filters) {
      const value = filterValues[filter.id]
      if (!value) continue
      result = result.filter((row) => (filter.match ? filter.match(row, value) : row[filter.id] === value))
    }
    if (sort) {
      const column = columns.find((c) => c.key === sort.key)
      if (column?.sortValue) {
        const dir = sort.dir === 'asc' ? 1 : -1
        result = [...result].sort((a, b) => {
          const av = column.sortValue(a)
          const bv = column.sortValue(b)
          if (av === bv) return 0
          return (av > bv ? 1 : -1) * dir
        })
      }
    }
    return result
  }, [rows, search, searchText, filters, filterValues, sort, columns])

  const pageCount = Math.max(1, Math.ceil(processed.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const start = (currentPage - 1) * pageSize
  const visible = processed.slice(start, start + pageSize)

  const resetFilters = () => {
    setSearch('')
    setFilterValues({})
    setPage(1)
  }

  const toggleSort = (key) => {
    setPage(1)
    setSort((current) => {
      if (current?.key !== key) return { key, dir: 'asc' }
      if (current.dir === 'asc') return { key, dir: 'desc' }
      return null
    })
  }

  if (error) return <Card><ErrorState error={error} onRetry={onRetry} isRetrying={isRetrying} /></Card>

  const noRowsAtAll = !isLoading && (rows?.length ?? 0) === 0
  if (noRowsAtAll && emptyState) return emptyState

  const showToolbar = Boolean(searchText) || filters.length > 0 || toolbarActions

  return (
    <Card>
      {showToolbar && (
        <div className="flex flex-col gap-3 border-b border-border p-4 md:flex-row md:items-end">
          {searchText && (
            <div className="relative min-w-0 flex-1 md:max-w-sm">
              <label htmlFor={`${uid}-search`} className="sr-only">
                {searchLabel}
              </label>
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden="true" />
              <Input
                id={`${uid}-search`}
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value)
                  setPage(1)
                }}
                placeholder={searchPlaceholder}
                className="pl-9"
                disabled={isLoading}
              />
            </div>
          )}
          {filters.map((filter) => (
            <div key={filter.id} className="flex flex-col gap-1.5 md:w-48">
              <label htmlFor={`${uid}-${filter.id}`} className="text-xs font-medium text-muted">
                {filter.label}
              </label>
              <Select
                id={`${uid}-${filter.id}`}
                value={filterValues[filter.id] ?? ''}
                disabled={isLoading}
                onChange={(event) => {
                  setFilterValues((current) => ({ ...current, [filter.id]: event.target.value }))
                  setPage(1)
                }}
              >
                <option value="">{filter.allLabel ?? 'All'}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
          ))}
          {hasActiveFilters && (
            <Button variant="ghost" size="md" onClick={resetFilters}>
              <X /> Clear
            </Button>
          )}
          {toolbarActions && <div className="flex gap-2 md:ml-auto">{toolbarActions}</div>}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border bg-sky">
              {columns.map((column) => {
                const sortable = Boolean(column.sortValue)
                const direction = sort?.key === column.key ? sort.dir : null
                return (
                  <th
                    key={column.key}
                    scope="col"
                    aria-sort={direction ? (direction === 'asc' ? 'ascending' : 'descending') : undefined}
                    className={cn('px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted', column.headerClassName)}
                  >
                    {sortable ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(column.key)}
                        className="-mx-1 inline-flex items-center gap-1.5 rounded-sm px-1 uppercase tracking-wide hover:text-ink"
                      >
                        {column.header}
                        {direction === 'asc' ? (
                          <ArrowUp className="size-3.5" aria-hidden="true" />
                        ) : direction === 'desc' ? (
                          <ArrowDown className="size-3.5" aria-hidden="true" />
                        ) : (
                          <ChevronsUpDown className="size-3.5 opacity-60" aria-hidden="true" />
                        )}
                        <span className="sr-only">, sortable</span>
                      </button>
                    ) : (
                      column.header
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              Array.from({ length: Math.min(pageSize, 5) }, (_, index) => (
                <tr key={index} className="border-b border-border last:border-0">
                  {columns.map((column) => (
                    <td key={column.key} className="px-4 py-4">
                      <Skeleton className="h-5 w-full max-w-40" />
                    </td>
                  ))}
                </tr>
              ))}
            {!isLoading &&
              visible.map((row) => (
                <tr key={rowKey(row)} className="border-b border-border transition-colors last:border-0 hover:bg-sky/60">
                  {columns.map((column) => (
                    <td key={column.key} className={cn('px-4 py-3 align-middle', column.className)}>
                      {column.cell ? column.cell(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
        {isLoading && <span className="sr-only" role="status">Loading data</span>}
      </div>

      {!isLoading && processed.length === 0 && (
        <EmptyState
          compact
          icon={SearchX}
          title="Nothing matches your search"
          description="Try a different keyword or clear the filters to see everything."
          action={
            <Button variant="secondary" onClick={resetFilters}>
              Clear search and filters
            </Button>
          }
        />
      )}

      {!isLoading && processed.length > 0 && (
        <div className="flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm text-muted sm:flex-row">
          <p role="status" aria-live="polite">
            Showing <span className="num font-medium text-ink">{start + 1}{'\u2013'}{start + visible.length}</span> of{' '}
            <span className="num font-medium text-ink">{processed.length}</span>
          </p>
          {pageCount > 1 && (
            <nav aria-label="Pagination" className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1}>
                <ChevronLeft /> Previous
              </Button>
              <span className="num min-w-20 text-center">
                Page {currentPage} / {pageCount}
              </span>
              <Button variant="secondary" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage === pageCount}>
                Next <ChevronRight />
              </Button>
            </nav>
          )}
        </div>
      )}
    </Card>
  )
}
