import { formatDate, formatNumber } from '../../../utils'
import { esc } from '../../../utils/pdf/helpers'
import type { PdfKpiCard, PdfRenderOptions, PdfChartConfig, AppliedFilterChip } from '../../../utils/pdf/types'
import { downtimeTemplate } from '../../../utils/pdf/templates'

export interface DowntimeRow {
  date: string
  line: string
  shift: string
  device: string
  cause: string
  downtime_hours: number
  runtime_hours: number
  efficiency: number | null
}

export interface DowntimeReportInput {
  title: string
  factoryName: string
  factoryAddress?: string
  dateFrom: string
  dateTo: string
  rows: DowntimeRow[]
  chips: AppliedFilterChip[]
  branding?: { logoUrl?: string; primaryColor?: string }
}

export function buildDowntimeReport(input: DowntimeReportInput): PdfRenderOptions {
  const totalDowntime = input.rows.reduce((s, r) => s + (r.downtime_hours || 0), 0)
  const totalRuntime = input.rows.reduce((s, r) => s + (r.runtime_hours || 0), 0)
  const effs = input.rows.filter((r) => r.efficiency != null).map((r) => r.efficiency as number)
  const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null
  const kpis: PdfKpiCard[] = [
    { label: 'تعداد رکورد', value: formatNumber(input.rows.length), suffix: 'مورد', bg: '#eff6ff', color: '#1e3a5f' },
    { label: 'مجموع توقف', value: formatNumber(Math.round(totalDowntime * 10) / 10), suffix: 'ساعت', bg: '#fef2f2', color: '#991b1b' },
    { label: 'مجموع کارکرد', value: formatNumber(Math.round(totalRuntime * 10) / 10), suffix: 'ساعت', bg: '#ecfdf5', color: '#065f46' },
    { label: 'میانگین راندمان', value: avgEff != null ? `${(Math.round(avgEff * 10) / 10).toString()}٪` : '—', bg: '#f0fdfa', color: '#0f766e' },
  ]

  const byDate = input.rows.reduce((acc: Record<string, number>, r) => {
    acc[r.date] = (acc[r.date] ?? 0) + (r.downtime_hours || 0)
    return acc
  }, {})
  const allDates = Object.keys(byDate).sort()
  const dateLabels = allDates.length > 16 ? (() => {
    const step = Math.ceil(allDates.length / 16)
    const picked: string[] = []
    for (let i = 0; i < allDates.length; i += step) {
      const chunk = allDates.slice(i, i + step)
      const sum = chunk.reduce((s, d) => s + byDate[d], 0)
      picked.push(chunk[0])
      byDate[chunk[0]] = Math.round(sum * 10) / 10
    }
    return picked
  })() : allDates
  const downtimeByDate: PdfChartConfig = {
    type: 'bar',
    title: allDates.length > 16 ? `توقف روزانه (ساعت) — تجمیع ${allDates.length} روز در ${dateLabels.length} نقطه` : 'توقف روزانه (ساعت)',
    labels: dateLabels.map((d) => formatDate(d).slice(5)),
    datasets: [{ label: 'ساعت', data: dateLabels.map((d) => Math.round(byDate[d] * 10) / 10), color: '#dc2626' }],
    showLegend: false,
  }

  const byLine = input.rows.reduce((acc: Record<string, number>, r) => {
    acc[r.line] = (acc[r.line] ?? 0) + (r.downtime_hours || 0)
    return acc
  }, {})
  const lineLabels = Object.keys(byLine).sort((a, b) => byLine[b] - byLine[a])
  const downtimeByLine: PdfChartConfig = {
    type: 'bar',
    title: 'توقف به تفکیک خط (ساعت)',
    labels: lineLabels.map((l) => (l.length > 12 ? l.slice(0, 12) + '…' : l)),
    datasets: [{ label: 'ساعت', data: lineLabels.map((l) => Math.round(byLine[l] * 10) / 10), color: '#0f2040' }],
    showLegend: false,
  }

  const byCause = input.rows.reduce((acc: Record<string, number>, r) => {
    const k = (r.cause || 'نامشخص').trim() || 'نامشخص'
    acc[k] = (acc[k] ?? 0) + (r.downtime_hours || 0)
    return acc
  }, {})
  const causeLabels = Object.keys(byCause).sort((a, b) => byCause[b] - byCause[a]).slice(0, 10)
  const causeChart: PdfChartConfig | undefined = causeLabels.length ? {
    type: 'pie',
    title: `سهم علل توقف (Top ${causeLabels.length})`,
    labels: causeLabels.map((c) => (c.length > 22 ? c.slice(0, 22) + '…' : c)),
    datasets: [{ label: 'ساعت', data: causeLabels.map((c) => Math.round(byCause[c] * 10) / 10) }],
    showLegend: false,
  } : undefined

  const tableRows = input.rows.map((r) => ({
    تاریخ: formatDate(r.date),
    خط: r.line,
    شیفت: r.shift,
    دستگاه: r.device || '—',
    علت: r.cause || '—',
    توقف: r.downtime_hours,
    کارکرد: r.runtime_hours,
    راندمان: r.efficiency ?? '—',
  }))

  const ctx = {
    title: input.title,
    factoryName: input.factoryName,
    factoryAddress: input.factoryAddress,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    rows: tableRows as unknown as Record<string, string | number>[],
    rawRows: input.rows as unknown[],
    filters: input.chips,
    kpis,
    charts: [downtimeByDate, downtimeByLine, ...(causeChart ? [causeChart] : [])],
    branding: input.branding,
  }

  const base = downtimeTemplate.build(ctx)
  if (!input.rows.length) {
    base.sections = [
      ...(base.sections ?? []),
      { type: 'text', title: 'وضعیت داده', html: `<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:16px;text-align:center;background:#f8fafc"><div style="font-weight:700;color:#1e3a5f;margin-bottom:4px">داده‌ای برای بازه انتخابی یافت نشد</div><div style="font-size:8px;color:#64748b">بازه یا فیلترها را تغییر دهید.</div></div>` },
    ]
  }
  return base
}

export function downtimeReportHtml(input: DowntimeReportInput): string {
  const { buildPdfHtml } = require('../../../utils/pdf/renderer') as typeof import('../../../utils/pdf/renderer')
  return buildPdfHtml(buildDowntimeReport(input))
}

export function appliedFiltersChipsHtml(chips: AppliedFilterChip[]): string {
  if (!chips.length) return '<span style="font-size:7px;color:#94a3b8">بدون فیلتر</span>'
  return chips.map((c) => `<span style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:999px;padding:2px 8px;font-size:7px;margin:2px"><b style="color:#1e3a5f">${esc(c.label)}:</b> ${esc(c.value)}</span>`).join('')
}
