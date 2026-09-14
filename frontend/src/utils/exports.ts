import { saveAs } from 'file-saver'
import { formatDate } from '../utils'
import { buildPdfHtml } from './pdf/renderer'
import { htmlToPdf } from './pdf/printer'
import { DEFAULT_PAGE, DEFAULT_STYLE } from './pdf/styles'

export type ExportFormat = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'html' | 'json'

export interface ExportOptions {
  fileName: string
  title: string
  factoryName?: string
  dateFrom?: string
  dateTo?: string
  format: ExportFormat
  outputLabelMap?: Record<string, string>
}

function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function rowsToHeaders(rows: Record<string, string | number>[]): string[] {
  return Object.keys(rows[0] ?? {})
}

function toCsv(rows: Record<string, string | number>[]): string {
  if (!rows.length) return ''
  const headers = rowsToHeaders(rows)
  const escCsv = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  return [headers.map(escCsv).join(','), ...rows.map((r) => headers.map((h) => escCsv(r[h])).join(','))].join('\n')
}

async function exportXlsx(rows: Record<string, string | number>[], fileName: string): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1')
  for (let c = range.s.c; c <= range.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const cell = ws[addr]
    if (cell) {
      cell.s = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { fgColor: { rgb: '1E3A5F' } }, alignment: { horizontal: 'center', vertical: 'center' } }
    }
  }
  ws['!cols'] = rowsToHeaders(rows).map(() => ({ wch: 16 }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'گزارش')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

async function exportDocx(rows: Record<string, string | number>[], title: string, fileName: string): Promise<void> {
  const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType, HeadingLevel, AlignmentType, TextRun } = await import('docx')
  const headers = rowsToHeaders(rows)
  const headerCells = headers.map((h) => new TableCell({
    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 18 })] })],
    shading: { fill: '1E3A5F', type: 'clear' as const, color: 'auto' },
    width: { size: 100 / Math.max(1, headers.length), type: WidthType.PERCENTAGE },
  }))
  const bodyRows = rows.map((r) => new TableRow({
    children: headers.map((h) => new TableCell({
      children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: String(r[h] ?? ''), size: 16 })] })],
    })),
  }))
  const table = new Table({
    rows: [new TableRow({ children: headerCells }), ...bodyRows],
    width: { size: 100, type: WidthType.PERCENTAGE },
  })
  const doc = new Document({
    sections: [{ children: [new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 26 })] }), new Paragraph({ text: '' }), table] }],
  })
  const blob = await Packer.toBlob(doc)
  saveAs(blob, `${fileName}.docx`)
}

function exportHtml(rows: Record<string, string | number>[], title: string, fileName: string): void {
  const headers = rowsToHeaders(rows)
  const th = headers.map((h) => `<th style="padding:6px 10px;background:#1e3a5f;color:#fff;font-size:10px">${esc(h)}</th>`).join('')
  const tr = rows.map((r) => `<tr>${headers.map((h) => `<td style="padding:4px 8px;font-size:9px;border:1px solid #cbd5e1;text-align:center">${esc(String(r[h] ?? ''))}</td>`).join('')}</tr>`).join('')
  const html = `<!DOCTYPE html><html dir="rtl" lang="fa"><head><meta charset="UTF-8"><title>${esc(title)}</title></head><body style="font-family:Tahoma,sans-serif;direction:rtl;padding:20px"><h1 style="text-align:center;color:#1e3a5f">${esc(title)}</h1><table style="width:100%;border-collapse:collapse;margin-top:12px"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></body></html>`
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  saveAs(blob, `${fileName}.html`)
}

function exportJson(rows: Record<string, string | number>[], fileName: string): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json;charset=utf-8' })
  saveAs(blob, `${fileName}.json`)
}

function exportPdf(rows: Record<string, string | number>[], fileName: string, title: string, opts: Partial<ExportOptions>): void {
  const html = buildPdfHtml({
    title,
    fileName,
    branding: { factoryName: opts.factoryName ?? '', primaryColor: '#1e3a5f' },
    page: { ...DEFAULT_PAGE },
    style: { ...DEFAULT_STYLE },
    header: { variant: 'branded', height: '26mm', branding: { factoryName: opts.factoryName ?? '' }, title, subtitle: opts.factoryName ? `${opts.factoryName} — ${opts.dateFrom ?? ''} تا ${opts.dateTo ?? ''}` : undefined, showLogo: true, showDate: true },
    footer: { variant: 'standard', height: '13mm', branding: { factoryName: opts.factoryName ?? '' }, showPageNumbers: true, showPrintDate: true },
    cover: { title, factoryName: opts.factoryName ?? '', dateFrom: opts.dateFrom, dateTo: opts.dateTo, generatedAt: new Date().toLocaleDateString('fa-IR'), recordCount: rows.length },
    tables: rows.length ? [{ columns: rowsToHeaders(rows).map((k) => ({ key: k, header: k, align: 'center' as const })), rows: rows as unknown as Record<string, unknown>[], variant: 'striped', striped: true, bordered: false, headerBg: '#1e3a5f', headerColor: '#fff', showRowNumbers: true }] : [],
  })
  htmlToPdf(html, fileName)
}

function exportCsv(rows: Record<string, string | number>[], fileName: string): void {
  const csv = `\uFEFF${toCsv(rows)}`
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  saveAs(blob, `${fileName}.csv`)
}

export async function exportData(rows: Record<string, string | number>[], opts: ExportOptions): Promise<void> {
  const fileName = opts.fileName || 'report'
  switch (opts.format) {
    case 'xlsx': return exportXlsx(rows, fileName)
    case 'csv': return exportCsv(rows, fileName)
    case 'docx': return exportDocx(rows, opts.title, fileName)
    case 'html': return exportHtml(rows, opts.title, fileName)
    case 'json': return exportJson(rows, fileName)
    case 'pdf': return exportPdf(rows, fileName, opts.title, opts)
    default: return exportXlsx(rows, fileName)
  }
}

export async function exportToExcel(rows: Record<string, string | number>[], fileName: string): Promise<void> {
  return exportXlsx(rows, fileName)
}

export async function exportToPdf(rows: Record<string, string | number>[], fileName: string, title: string): Promise<void> {
  return exportPdf(rows, fileName, title, { fileName, title, format: 'pdf' })
}

export const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word (DOCX)' },
  { value: 'xlsx', label: 'Excel (XLSX)' },
  { value: 'csv', label: 'CSV' },
  { value: 'html', label: 'HTML' },
  { value: 'json', label: 'JSON' },
]
