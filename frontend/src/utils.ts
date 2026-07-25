// ابزارهای کمکی برای قالب‌بندی

export function formatDate(iso: string): string {
  if (!iso) return '-'
  // تاریخ به فرمت YYYY-MM-DD
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

// بازه‌های زمانی گزارش‌گیری
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
  return {
    from: customFrom || to,
    to: customTo || to,
    groupBy: 'day',
  }
}

// خروجی اکسل
export async function exportToExcel(
  rows: Record<string, string | number>[],
  fileName: string,
): Promise<void> {
  const XLSX = await import('xlsx')
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'گزارش')
  XLSX.writeFile(wb, `${fileName}.xlsx`)
}

