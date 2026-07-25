export function formatDate(iso: string): string {
  if (!iso) return '-'
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function formatNumber(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return new Intl.NumberFormat('fa-IR').format(n)
}

export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return `${formatNumber(Math.round(n * 10) / 10)}٪`
}

export function classNames(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ')
}

export function todayISO(): string {
  const d = new Date()
  const off = d.getTimezoneOffset()
  const local = new Date(d.getTime() - off * 60000)
  return local.toISOString().split('T')[0]
}

export type ReportRange = 'daily' | 'weekly' | 'monthly' | 'custom'

export function rangeBounds(
  range: ReportRange,
  customFrom?: string,
  customTo?: string,
): { from: string; to: string; groupBy: 'day' | 'isoWeek' | 'month' } {
  const today = new Date()
  const to = todayISO()
  if (range === 'daily') {
    const from = new Date(today)
    from.setDate(today.getDate() - 29)
    return { from: from.toISOString().split('T')[0], to, groupBy: 'day' }
  }
  if (range === 'weekly') {
    const from = new Date(today)
    from.setDate(today.getDate() - 83)
    return { from: from.toISOString().split('T')[0], to, groupBy: 'isoWeek' }
  }
  if (range === 'monthly') {
    const from = new Date(today)
    from.setMonth(today.getMonth() - 11)
    return { from: from.toISOString().split('T')[0], to, groupBy: 'month' }
  }
  return { from: customFrom || to, to: customTo || to, groupBy: 'day' }
}

const EXCEL_COL_WIDTHS = [
  { wch: 18 }, { wch: 22 }, { wch: 10 }, { wch: 16 },
  { wch: 18 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
  { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
]

export async function exportToExcel(
  rows: Record<string, string | number>[],
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)

  ws['!cols'] = EXCEL_COL_WIDTHS

  const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1')
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c })
    const cell = ws[addr]
    if (cell) {
      cell.font = { bold: true, sz: 11, name: 'Vazirmatn' }
      cell.alignment = { horizontal: 'center', vertical: 'center' }
      cell.fill = { fgColor: { rgb: 'F97316' }, patternType: 'solid' }
      cell.font.color = { rgb: 'FFFFFF' }
    }
  }

  for (let r = headerRange.s.r + 1; r <= headerRange.e.r; r++) {
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (cell) {
        cell.alignment = { horizontal: 'center', vertical: 'center' }
        cell.font = { sz: 10, name: 'Vazirmatn' }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'گزارش عملکرد')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

export async function exportToPdf(
  rows: Record<string, string | number>[],
  fileName: string,
  title: string,
): Promise<void> {
  const { default: jsPDF } = await import('jspdf')
  const { default: autoTable } = await import('jspdf-autotable')

  const doc = new jsPDF('l', 'mm', 'a4')
  const pageW = doc.internal.pageSize.getWidth()

  doc.setFont('Helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(249, 115, 22)
  doc.text(title, pageW / 2, 18, { align: 'center' })

  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  const dateStr = new Date().toLocaleDateString('fa-IR')
  doc.text(`تاریخ خروجی: ${dateStr}`, pageW / 2, 25, { align: 'center' })

  const headers = Object.keys(rows[0] || {}).map(k => k as string)
  const data = rows.map(r => headers.map(h => {
    const v = r[h]
    return v !== null && v !== undefined && v !== '' && v !== '—' ? String(v) : ''
  }))

  autoTable(doc, {
    head: [headers],
    body: data,
    startY: 30,
    styles: {
      font: 'helvetica',
      fontSize: 7,
      cellPadding: 2,
      halign: 'center',
    },
    headStyles: {
      fillColor: [249, 115, 22],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: headers.reduce((acc, _, i) => {
      acc[i] = { cellWidth: Math.max(20, pageW / headers.length - 4) }
      return acc
    }, {} as Record<number, { cellWidth: number }>),
    margin: { top: 30, right: 8, bottom: 10, left: 8 },
    tableWidth: 'auto',
  })

  doc.save(`${fileName}.pdf`)
}
