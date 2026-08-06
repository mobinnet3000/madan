// ── تبدیل تاریخ میلادی به شمسی (Jalali) ─────────────────────────────
const div = (a: number, b: number) => Math.floor(a / b)
const mod = (a: number, b: number) => a - Math.floor(a / b) * b

export function gregorianToJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
  let gy2 = gm > 2 ? gy + 1 : gy
  let days = 355666 + 365 * gy + div(gy2 + 2, 4) - div(gy2 + 99, 100) + div(gy2 + 399, 400) + gd + g_d_m[gm - 1]
  let jy = -1595 + 33 * div(days, 12053)
  days = mod(days, 12053)
  jy += 4 * div(days, 1461)
  days -= 1461 * div(days, 1461)
  if (days > 0) { jy += div(days - 1, 365); days = mod(days - 1, 365) }
  let jm: number, jd: number
  if (days < 186) { jm = 1 + div(days, 31); jd = mod(days, 31) + 1 }
  else { jm = 7 + div(days - 186, 30); jd = mod(days - 186, 30) + 1 }
  return [jy, jm, jd]
}

export const PERSIAN_MONTHS = ['فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند']

// شاخص `new Date().getDay()` (۰=یکشنبه ... ۶=شنبه)
export const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه', 'شنبه']

function parseISO(iso: string): { y: number; m: number; d: number } {
  const [y, m, d] = iso.split('T')[0].split('-').map(Number)
  return { y, m, d }
}

export function toJalali(iso: string): [number, number, number] | null {
  if (!iso) return null
  const { y, m, d } = parseISO(iso)
  if (!y || !m || !d) return null
  return gregorianToJalali(y, m, d)
}

export function weekdayFa(iso: string): string {
  const { y, m, d } = parseISO(iso)
  if (!y || !m || !d) return ''
  return PERSIAN_WEEKDAYS[new Date(y, m - 1, d).getDay()]
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

export function formatDate(iso: string): string {
  if (!iso) return '-'
  const j = toJalali(iso)
  if (!j) return iso
  return `${j[0]}/${pad(j[1])}/${pad(j[2])}`
}

export function formatDateFull(iso: string): string {
  if (!iso) return '-'
  const j = toJalali(iso)
  if (!j) return iso
  const { y, m, d } = parseISO(iso)
  const wd = PERSIAN_WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${wd} ${j[2]} ${PERSIAN_MONTHS[j[1] - 1]} ${j[0]}`
}

export function formatDateWithWeekday(iso: string): string {
  if (!iso) return '-'
  const j = toJalali(iso)
  if (!j) return iso
  const { y, m, d } = parseISO(iso)
  const wd = PERSIAN_WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${wd} · ${j[0]}/${pad(j[1])}/${pad(j[2])}`
}

// ساعت شیفت از ساعت‌های شروع و پایان (پشتیبانی از شیفت شبانه که پايان < شروع)
export function shiftHours(hhmmStart: string | undefined, hhmmEnd: string | undefined): number {
  if (!hhmmStart || !hhmmEnd) return 0
  const toMin = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    return (h || 0) * 60 + (m || 0)
  }
  let mins = toMin(hhmmEnd) - toMin(hhmmStart)
  if (mins < 0) mins += 24 * 60
  return mins / 60
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
      cell.font = { bold: true, sz: 11, name: 'B Nazanin' }
      cell.alignment = { horizontal: 'center', vertical: 'center' }
      cell.fill = { fgColor: { rgb: '1E3A5F' }, patternType: 'solid' }
      cell.font.color = { rgb: 'FFFFFF' }
    }
  }

  for (let r = headerRange.s.r + 1; r <= headerRange.e.r; r++) {
    for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
      const addr = XLSX.utils.encode_cell({ r, c })
      const cell = ws[addr]
      if (cell) {
        cell.alignment = { horizontal: 'center', vertical: 'center' }
        cell.font = { sz: 10, name: 'B Nazanin' }
      }
    }
  }

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'گزارش')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

function htmlToPdf(
  html: string,
  fileName: string,
): void {
  // Create a hidden iframe
  const iframe = document.createElement('iframe')
  iframe.style.position = 'absolute'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  document.body.appendChild(iframe)

  // Write the HTML content
  const iframeDoc = iframe.contentWindow?.document
  if (!iframeDoc) {
    // Fallback: open in new window
    const win = window.open('', '_blank')
    win?.document.write(html)
    win?.document.close()
    win?.focus()
    win?.print()
    return
  }

  iframeDoc.open()
  iframeDoc.write(html)
  iframeDoc.close()

  // Wait for fonts to load, then print
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()

    // Clean up after print dialog closes
    setTimeout(() => {
      document.body.removeChild(iframe)
    }, 1000)
  }, 500)
}

export async function exportToPdf(
  rows: Record<string, string | number>[],
  fileName: string,
  title: string,
): Promise<void> {
  const headers = Object.keys(rows[0] || {}).map(k => k)
  const today = new Date().toLocaleDateString('fa-IR')
  const dateStr = `${today}`

  function esc(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  }

  // Build HTML table
  const headerRow = headers.map(h => `<th style="padding:6px 10px;background:#1e3a5f;color:#fff;font-weight:700;font-size:10px;text-align:center;border:1px solid #334155;">${esc(h)}</th>`).join('')

  const bodyRows = rows.map(r =>
    '<tr>' + headers.map(h => {
      const v = r[h]
      const val = v !== null && v !== undefined && v !== '' && v !== '\u2014' ? String(v) : ''
      return `<td style="padding:4px 8px;font-size:9px;text-align:center;border:1px solid #cbd5e1;">${esc(val)}</td>`
    }).join('') + '</tr>'
  ).join('')

  const html = `<!DOCTYPE html>
<html dir="rtl" lang="fa">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<style>
  @font-face {
    font-family: 'Vazirmatn';
    src: url('/fonts/Vazirmatn-FD-Regular.ttf') format('truetype');
    font-weight: normal;
  }
  @font-face {
    font-family: 'Vazirmatn';
    src: url('/fonts/Vazirmatn-FD-Bold.ttf') format('truetype');
    font-weight: bold;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Vazirmatn', Tahoma, sans-serif;
    direction: rtl;
    padding: 20px;
    color: #1e293b;
  }
  .header {
    text-align: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 2px solid #1e3a5f;
  }
  .header h1 { font-size: 18px; color: #1e3a5f; margin-bottom: 4px; }
  .header .meta { font-size: 10px; color: #64748b; }
  table {
    width: 100%;
    border-collapse: collapse;
    margin-top: 8px;
  }
  th { background: #1e3a5f; color: #fff; font-weight: bold; font-size: 10px; }
  td { font-size: 9px; }
  tr:nth-child(even) { background: #f8fafc; }
  tr:nth-child(odd) { background: #fff; }
  .footer {
    text-align: center;
    margin-top: 20px;
    padding-top: 10px;
    border-top: 1px solid #cbd5e1;
    font-size: 8px;
    color: #94a3b8;
  }
  @media print {
    body { padding: 10px; }
    .no-print { display: none; }
    @page { margin: 15mm; }
  }
</style>
</head>
<body>
<div class="header">
  <h1>${esc(title)}</h1>
  <div class="meta">${esc(dateStr)}</div>
</div>
<table>
<thead><tr>${headerRow}</tr></thead>
<tbody>${bodyRows}</tbody>
</table>
<div class="footer">
  ${esc(title)} — تاریخ چاپ: ${esc(dateStr)}
</div>
</body>
</html>`

  htmlToPdf(html, fileName)
}
