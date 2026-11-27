import { useCallback, useId, useRef, useState } from 'react'
import { Download, FileUp, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { ImportFileError, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, readTable } from '@/lib/csv'

function acceptedExtensions(accept) {
  return String(accept ?? '')
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => part.startsWith('.'))
}

function fileMatchesAccept(file, accept) {
  const extensions = acceptedExtensions(accept)
  if (extensions.length === 0) return true
  const name = file.name.toLowerCase()
  return extensions.some((ext) => name.endsWith(ext))
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

/**
 * Reusable import dialog: pick or drop a CSV/JSON file, validate each row with `parseRecord`,
 * preview valid rows, then call `onImport` with only those values.
 */
export function ImportDialog({
  open,
  onOpenChange,
  title,
  description,
  accept = '.csv,.json',
  parseRecord,
  onImport,
  columns = [],
  sampleHint,
  templateCsv,
}) {
  const inputId = useId()
  const inputRef = useRef(null)
  const [dragActive, setDragActive] = useState(false)
  const [fileName, setFileName] = useState('')
  const [fileError, setFileError] = useState(null)
  const [importError, setImportError] = useState(null)
  const [importing, setImporting] = useState(false)
  const [parsed, setParsed] = useState(null)

  const reset = useCallback(() => {
    setDragActive(false)
    setFileName('')
    setFileError(null)
    setImportError(null)
    setImporting(false)
    setParsed(null)
    if (inputRef.current) inputRef.current.value = ''
  }, [])

  const handleOpenChange = (next) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const processFile = useCallback(
    async (file) => {
      setFileError(null)
      setImportError(null)
      setParsed(null)
      setFileName(file?.name ?? '')

      if (!file) return
      if (file.size > MAX_IMPORT_BYTES) {
        setFileError('That file is too large. Use a file under 2 MB.')
        return
      }
      if (!fileMatchesAccept(file, accept)) {
        const extList = acceptedExtensions(accept).join(' or ') || accept
        setFileError(`Choose a ${extList} file.`)
        return
      }

      try {
        const text = await file.text()
        const table = readTable(text, file.name)
        if (table.records.length > MAX_IMPORT_ROWS) {
          setFileError(`The file has too many rows. Split it so there are at most ${MAX_IMPORT_ROWS} data rows.`)
          return
        }

        const valid = []
        const invalid = []
        for (const record of table.records) {
          const result = parseRecord(record)
          if (result.ok) valid.push({ label: record.label, value: result.value })
          else invalid.push({ label: record.label, messages: result.messages })
        }
        setParsed({ valid, invalid, format: table.format })
      } catch (error) {
        setFileError(error instanceof ImportFileError ? error.message : 'That file could not be read.')
      }
    },
    [accept, parseRecord],
  )

  const onFileInput = (event) => {
    const file = event.target.files?.[0]
    if (file) processFile(file)
  }

  const onDrop = (event) => {
    event.preventDefault()
    setDragActive(false)
    const file = event.dataTransfer.files?.[0]
    if (file) processFile(file)
  }

  const validCount = parsed?.valid.length ?? 0
  const invalidCount = parsed?.invalid.length ?? 0

  const handleImport = async () => {
    if (!parsed || validCount === 0) return
    setImportError(null)
    setImporting(true)
    try {
      await onImport(parsed.valid.map((row) => row.value))
      handleOpenChange(false)
    } catch (error) {
      setImportError(error?.message || 'Something went wrong while importing.')
    } finally {
      setImporting(false)
    }
  }

  const previewRows = parsed?.valid.slice(0, 8) ?? []

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {(sampleHint || templateCsv) && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-sunken/40 px-4 py-3 text-sm text-muted">
              {sampleHint ? <p className="min-w-0 flex-1">{sampleHint}</p> : <span />}
              {templateCsv ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => downloadText('import-template.csv', templateCsv)}>
                  <Download className="size-4" aria-hidden="true" />
                  Download template
                </Button>
              ) : null}
            </div>
          )}

          <DropZone
            dragActive={dragActive}
            inputId={inputId}
            accept={accept}
            fileName={fileName}
            onBrowse={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault()
              setDragActive(true)
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              e.preventDefault()
              if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false)
            }}
            onDrop={onDrop}
          />

          <input ref={inputRef} id={inputId} type="file" accept={accept} className="sr-only" onChange={onFileInput} />

          {fileError ? (
            <p role="alert" className="text-sm text-danger">
              {fileError}
            </p>
          ) : null}
          {importError ? (
            <p role="alert" className="text-sm text-danger">
              {importError}
            </p>
          ) : null}

          {parsed ? (
            <>
              <p className="text-sm text-ink" role="status">
                <span className="font-medium">{validCount} valid</span>
                {invalidCount > 0 ? (
                  <>
                    , <span className="font-medium text-danger">{invalidCount} with errors</span>
                  </>
                ) : null}
                <span className="text-muted"> · {parsed.format.toUpperCase()}</span>
              </p>

              {invalidCount > 0 ? (
                <ul
                  role="alert"
                  className="max-h-28 list-none space-y-1 overflow-y-auto rounded-lg border border-danger/30 bg-danger-soft/40 px-3 py-2 text-sm text-danger"
                >
                  {parsed.invalid.map((row) => (
                    <li key={row.label}>
                      {row.label}: {row.messages.join('; ')}
                    </li>
                  ))}
                </ul>
              ) : null}

              {validCount > 0 && columns.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full min-w-[28rem] text-left text-sm">
                    <caption className="sr-only">Preview of valid rows</caption>
                    <thead className="border-b border-border bg-sunken/60 text-muted">
                      <tr>
                        <th scope="col" className="px-3 py-2 font-medium">
                          #
                        </th>
                        {columns.map((col) => (
                          <th key={col.key} scope="col" className="px-3 py-2 font-medium">
                            {col.header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {previewRows.map((row, index) => (
                        <tr key={`${row.label}-${index}`}>
                          <td className="px-3 py-2 text-muted">{row.label}</td>
                          {columns.map((col) => (
                            <td key={col.key} className="max-w-[14rem] truncate px-3 py-2">
                              {col.cell ? col.cell(row) : String(row.value?.[col.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {validCount > previewRows.length ? (
                    <p className="border-t border-border px-3 py-2 text-xs text-muted">
                      Showing {previewRows.length} of {validCount} valid rows.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : null}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)} disabled={importing}>
            Cancel
          </Button>
          <Button type="button" onClick={handleImport} disabled={importing || validCount === 0} loading={importing} loadingLabel="Importing…">
            <Upload className="size-4" aria-hidden="true" />
            Import {validCount} valid row{validCount === 1 ? '' : 's'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DropZone({ dragActive, inputId, accept, fileName, onBrowse, onDragEnter, onDragOver, onDragLeave, onDrop }) {
  const extensions = acceptedExtensions(accept)
  const acceptLabel = extensions.length > 0 ? extensions.map((e) => e.slice(1)).join(', ') : accept

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault()
          onBrowse()
        }
      }}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onBrowse}
      className={cn(
        'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors',
        dragActive ? 'border-primary bg-sky/60' : 'border-border bg-surface hover:border-primary/50 hover:bg-sunken/30',
      )}
    >
      <FileUp className="size-8 text-muted" aria-hidden="true" />
      <p className="text-sm font-medium text-ink">Drop a file here or click to browse</p>
      <p className="text-xs text-muted">Accepted: {acceptLabel}</p>
      <label htmlFor={inputId} className="sr-only">
        Choose file to import
      </label>
      {fileName ? <p className="text-xs text-primary">{fileName}</p> : null}
    </div>
  )
}