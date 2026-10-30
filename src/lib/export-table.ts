/** Client-side CSV + Excel (SpreadsheetML) export helpers for admin tables. */

export type ExportColumn = {
  key: string
  label: string
}

function cellValue(row: Record<string, unknown>, key: string): string {
  const v = row[key]
  if (v == null) return ''
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

function escapeCsv(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function downloadBlob(filename: string, mime: string, content: string | Blob) {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function exportRowsToCsv(
  filename: string,
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
) {
  const header = columns.map((c) => escapeCsv(c.label)).join(',')
  const body = rows
    .map((row) => columns.map((c) => escapeCsv(cellValue(row, c.key))).join(','))
    .join('\r\n')
  // BOM so Excel opens UTF-8 correctly
  downloadBlob(`${filename}.csv`, 'text/csv;charset=utf-8', `\uFEFF${header}\r\n${body}`)
}

/** Excel-compatible SpreadsheetML (.xls) — opens in Excel/Google Sheets without deps. */
export function exportRowsToExcel(
  filename: string,
  columns: ExportColumn[],
  rows: Array<Record<string, unknown>>,
  sheetName = 'Sheet1',
) {
  const escapeXml = (s: string) =>
    s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')

  const headerCells = columns
    .map((c) => `<Cell><Data ss:Type="String">${escapeXml(c.label)}</Data></Cell>`)
    .join('')
  const dataRows = rows
    .map((row) => {
      const cells = columns
        .map((c) => {
          const raw = cellValue(row, c.key)
          const asNum = Number(raw)
          if (raw !== '' && Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(raw)) {
            return `<Cell><Data ss:Type="Number">${raw}</Data></Cell>`
          }
          return `<Cell><Data ss:Type="String">${escapeXml(raw)}</Data></Cell>`
        })
        .join('')
      return `<Row>${cells}</Row>`
    })
    .join('')

  const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="${escapeXml(sheetName.slice(0, 31))}">
  <Table>
   <Row>${headerCells}</Row>
   ${dataRows}
  </Table>
 </Worksheet>
</Workbook>`

  downloadBlob(
    `${filename}.xls`,
    'application/vnd.ms-excel;charset=utf-8',
    xml,
  )
}
