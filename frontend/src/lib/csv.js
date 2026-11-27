/**
 * Small, dependency-free CSV and JSON table reader/writer used by the import dialog.
 * Plain ES module: it imports nothing from the app so it can also run under node.
 */

/** Largest file the import dialog accepts. */
export const MAX_IMPORT_BYTES = 2 * 1024 * 1024
/** Most rows (below the header) the dialog accepts in one file. */
export const MAX_IMPORT_ROWS = 5000

export class ImportFileError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ImportFileError'
  }
}

/** Picks the separator from the header line: comma, or semicolon/tab as some spreadsheet apps save them. */
export function detectDelimiter(text) {
  let inQuotes = false
  let commas = 0
  let semicolons = 0
  let tabs = 0
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (!inQuotes) {
      if (ch === '\n' || ch === '\r') break
      if (ch === ',') commas += 1
      else if (ch === ';') semicolons += 1
      else if (ch === '\t') tabs += 1
    }
  }
  if (semicolons > commas && semicolons >= tabs) return ';'
  if (tabs > commas && tabs > semicolons) return '\t'
  return ','
}

/**
 * RFC 4180 parser. Handles quoted fields, doubled quotes, delimiters and line breaks inside quotes,
 * CRLF / LF / CR line endings and a leading byte-order mark.
 * Returns an array of records (arrays of strings). A record is one row of the file, including blank
 * ones in the middle, so the index + 1 is the row number a spreadsheet would show. Trailing blank rows are dropped.
 */
export function parseCsv(input, delimiter) {
  const text = String(input ?? '').replace(/^\uFEFF/, '')
  const sep = delimiter ?? detectDelimiter(text)
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  let justClosedQuote = false
  let quoteOpenedAtRow = 0

  const endField = () => {
    row.push(field)
    field = ''
    justClosedQuote = false
  }
  const endRow = () => {
    endField()
    rows.push(row)
    row = []
  }

  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 1
        } else {
          inQuotes = false
          justClosedQuote = true
        }
      } else {
        field += ch
      }
    } else if (ch === '"' && field === '' && !justClosedQuote) {
      inQuotes = true
      quoteOpenedAtRow = rows.length + 1
    } else if (ch === sep) {
      endField()
    } else if (ch === '\n') {
      endRow()
    } else if (ch === '\r') {
      if (text[i + 1] === '\n') i += 1
      endRow()
    } else {
      // Text right after a closing quote is kept as-is, which is what most spreadsheet apps do.
      field += ch
    }
  }
  if (inQuotes) {
    throw new ImportFileError(`A quote that starts in row ${quoteOpenedAtRow} is never closed. Check that every opening " has a closing ".`)
  }
  if (field !== '' || row.length > 0) endRow()

  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === '')) rows.pop()
  return rows
}

/** Turns an array of records into CSV text, quoting only where needed. Uses CRLF so it opens cleanly in spreadsheet apps. */
export function toCsv(rows) {
  const quote = (value) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\r\n]/.test(text) || /^\s|\s$/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return `${rows.map((row) => row.map(quote).join(',')).join('\r\n')}\r\n`
}

/** "Correct answers", "correct_answers" and "CORRECT-ANSWERS" all become "correctanswers". */
export const normalizeHeader = (name) =>
  String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/**
 * Reads the text of a .csv or .json file into a table:
 *   { headers: string[], records: [{ label, values: { [normalizedHeader]: value } }], format: 'csv' | 'json' }
 * `label` is how the row is named in messages: "Row 14" for CSV (header = row 1) or "Item 3" for JSON.
 * `headers` are the original column names as written in the file. Blank CSV rows are skipped but still counted.
 */
export function readTable(text, fileName = '') {
  const isJson = /\.json$/i.test(fileName) || /^\s*[[{]/.test(String(text).replace(/^\uFEFF/, ''))
  return isJson ? readJson(text) : readCsv(text)
}

function readCsv(text) {
  const rows = parseCsv(text)
  if (rows.length === 0) throw new ImportFileError('The file is empty. Add a header row and at least one row of data.')
  const [headerRow, ...body] = rows
  const headers = headerRow.map((h) => h.trim())
  const keys = headers.map(normalizeHeader)
  const records = []
  body.forEach((cells, index) => {
    if (cells.every((cell) => cell.trim() === '')) return
    const values = {}
    keys.forEach((key, column) => {
      if (key && values[key] === undefined) values[key] = (cells[column] ?? '').trim()
    })
    records.push({ label: `Row ${index + 2}`, values, extraCells: cells.slice(headers.length).some((c) => c.trim() !== '') })
  })
  return { format: 'csv', headers: headers.filter(Boolean), records }
}

function readJson(text) {
  let data
  try {
    data = JSON.parse(String(text).replace(/^\uFEFF/, ''))
  } catch {
    throw new ImportFileError("The file isn't valid JSON. Check for a missing comma, bracket or quote.")
  }
  if (!Array.isArray(data)) {
    const firstList = data && typeof data === 'object' ? Object.values(data).find(Array.isArray) : null
    if (!firstList) throw new ImportFileError('The JSON file should contain a list of rows, like [ { ... }, { ... } ].')
    data = firstList
  }
  const headers = []
  const records = []
  data.forEach((item, index) => {
    const label = `Item ${index + 1}`
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      records.push({ label, values: {}, notAnObject: true })
      return
    }
    const values = {}
    for (const [name, value] of Object.entries(item)) {
      const key = normalizeHeader(name)
      if (!key) continue
      if (!headers.some((h) => normalizeHeader(h) === key)) headers.push(name)
      if (values[key] === undefined) values[key] = typeof value === 'string' ? value.trim() : value
    }
    records.push({ label, values })
  })
  return { format: 'json', headers, records }
}
