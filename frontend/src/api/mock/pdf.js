/**
 * Tiny dependency-free PDF writer used by the mock server to "generate" reports.
 * Real mode never uses this: the server streams the PDF.
 * lines: [{ text, size?, bold? }]  ->  Blob (application/pdf)
 */

const ascii = (text) =>
  String(text)
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\u00b7/g, '-')
    .replace(/[^\x20-\x7e]/g, '?')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')

export function makePdf(lines) {
  const pages = [[]]
  let y = 800
  for (const line of lines) {
    const size = line.size ?? 11
    const lead = size * 1.65
    if (y - lead < 56) {
      pages.push([])
      y = 800
    }
    y -= lead
    pages.at(-1).push({ ...line, size, y })
  }

  const objects = []
  const pageIds = pages.map((_, i) => 6 + i * 2)
  objects[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objects[2] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pages.length} >>`
  objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>'
  pages.forEach((page, i) => {
    const stream = page.map((l) => `BT /${l.bold ? 'F2' : 'F1'} ${l.size} Tf 56 ${l.y.toFixed(1)} Td (${ascii(l.text)}) Tj ET`).join('\n')
    objects[5 + i * 2] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`
    objects[6 + i * 2] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${5 + i * 2} 0 R >>`
  })

  let out = '%PDF-1.4\n'
  const offsets = []
  for (let id = 1; id < objects.length; id += 1) {
    offsets[id] = out.length
    out += `${id} 0 obj\n${objects[id]}\nendobj\n`
  }
  const xref = out.length
  out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`
  for (let id = 1; id < objects.length; id += 1) out += `${String(offsets[id]).padStart(10, '0')} 00000 n \n`
  out += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  return new Blob([out], { type: 'application/pdf' })
}

/** RFC-4180-ish CSV from an array of arrays. */
export function makeCsv(rows) {
  const cell = (value) => {
    const text = value === null || value === undefined ? '' : String(value)
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
  }
  return new Blob([rows.map((row) => row.map(cell).join(',')).join('\n')], { type: 'text/csv' })
}
