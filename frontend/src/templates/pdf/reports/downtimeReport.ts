import { formatDate, formatNumber, formatHours } from '../../../utils'
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

function isoWeekKey(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00Z')
  if (isNaN(d.getTime())) return iso
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNr = (t.getUTCDay() + 6) % 7
  t.setUTCDate(t.getUTCDate() - dayNr + 3)
  const jan4 = new Date(Date.UTC(t.getUTCFullYear(), 0, 4))
  const diff = (t.getTime() - jan4.getTime()) / 86400000
  const week = 1 + Math.round(diff / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
function monthKey(iso: string): string { return iso ? iso.slice(0, 7) : '—' }
function formatMonthLabel(mk: string): string {
  if (!mk || mk === '—' || !/^\d{4}-\d{2}$/.test(mk)) return mk
  return formatDate(mk + '-01').slice(0, 7)
}

export function buildDowntimeReport(input: DowntimeReportInput): PdfRenderOptions {
  const { rows, title, factoryName, factoryAddress, dateFrom, dateTo, chips = [], branding } = input
  const count = rows.length
  const totalDowntime = rows.reduce((s, r) => s + (r.downtime_hours || 0), 0)
  const totalRuntime = rows.reduce((s, r) => s + (r.runtime_hours || 0), 0)
  const effs = rows.filter(r => r.efficiency != null).map(r => r.efficiency as number)
  const avgEff = effs.length ? effs.reduce((a, b) => a + b, 0) / effs.length : null
  const minDown = rows.length ? Math.min(...rows.map(r => r.downtime_hours || 0)) : 0
  const maxDown = rows.length ? Math.max(...rows.map(r => r.downtime_hours || 0)) : 0
  const minRun = rows.length ? Math.min(...rows.map(r => r.runtime_hours || 0)) : 0
  const maxRun = rows.length ? Math.max(...rows.map(r => r.runtime_hours || 0)) : 0
  const minEff = effs.length ? Math.min(...effs) : 0
  const maxEff = effs.length ? Math.max(...effs) : 0

  const kpis: PdfKpiCard[] = [
    { label: 'تعداد رکورد', value: formatNumber(count), suffix: 'مورد', bg: '#eff6ff', color: '#1e3a5f' },
    { label: 'مجموع توقف', value: formatHours(totalDowntime), bg: '#fef2f2', color: '#991b1b' },
    { label: 'مجموع کارکرد', value: formatHours(totalRuntime), bg: '#ecfdf5', color: '#065f46' },
    { label: 'میانگین راندمان', value: avgEff != null ? `${(Math.round(avgEff * 10) / 10).toString()}٪` : '—', bg: '#f0fdfa', color: '#0f766e' },
  ]

  const byLine = new Map<string, { count: number; sumDown: number; sumRun: number; effs: number[] }>()
  const byDate = new Map<string, { count: number; sumDown: number; sumRun: number; effs: number[] }>()
  const byWeek = new Map<string, { count: number; sumDown: number; sumRun: number }>()
  const byMonth = new Map<string, { count: number; sumDown: number; sumRun: number }>()
  const byDevice = new Map<string, { count: number; sumDown: number }>()
  const byCause = new Map<string, { count: number; sumDown: number }>()
  const byShift = new Map<string, { count: number; sumDown: number; sumRun: number }>()

  for (const r of rows) {
    const ln = r.line || '—'
    const le = byLine.get(ln) ?? { count: 0, sumDown: 0, sumRun: 0, effs: [] as number[] }
    le.count += 1; le.sumDown += r.downtime_hours || 0; le.sumRun += r.runtime_hours || 0
    if (r.efficiency != null) le.effs.push(r.efficiency as number)
    byLine.set(ln, le)

    const d = r.date || ''
    const de = byDate.get(d) ?? { count: 0, sumDown: 0, sumRun: 0, effs: [] as number[] }
    de.count += 1; de.sumDown += r.downtime_hours || 0; de.sumRun += r.runtime_hours || 0
    if (r.efficiency != null) de.effs.push(r.efficiency as number)
    byDate.set(d, de)

    const wk = isoWeekKey(d)
    const we = byWeek.get(wk) ?? { count: 0, sumDown: 0, sumRun: 0 }
    we.count += 1; we.sumDown += r.downtime_hours || 0; we.sumRun += r.runtime_hours || 0
    byWeek.set(wk, we)

    const mk = monthKey(d)
    const me = byMonth.get(mk) ?? { count: 0, sumDown: 0, sumRun: 0 }
    me.count += 1; me.sumDown += r.downtime_hours || 0; me.sumRun += r.runtime_hours || 0
    byMonth.set(mk, me)

    const dev = (r.device || '—').trim() || '—'
    const dve = byDevice.get(dev) ?? { count: 0, sumDown: 0 }
    dve.count += 1; dve.sumDown += r.downtime_hours || 0
    byDevice.set(dev, dve)

    const cs = (r.cause || 'نامشخص').trim() || 'نامشخص'
    const ce = byCause.get(cs) ?? { count: 0, sumDown: 0 }
    ce.count += 1; ce.sumDown += r.downtime_hours || 0
    byCause.set(cs, ce)

    const sh = r.shift || '—'
    const she = byShift.get(sh) ?? { count: 0, sumDown: 0, sumRun: 0 }
    she.count += 1; she.sumDown += r.downtime_hours || 0; she.sumRun += r.runtime_hours || 0
    byShift.set(sh, she)
  }

  const lineNames = [...byLine.keys()].sort((a, b) => a.localeCompare(b, 'fa'))
  const dateKeys = [...byDate.keys()].sort()
  const weekKeys = [...byWeek.keys()].sort()
  const monthKeys = [...byMonth.keys()].sort()

  const charts: PdfChartConfig[] = []

  const sumDownByLine = lineNames.map(n => Math.round((byLine.get(n)!.sumDown) * 10) / 10)
  charts.push({ type: 'bar', title: 'مجموع توقف به تفکیک خط (ساعت)', labels: lineNames.map(l => l.length > 14 ? l.slice(0, 14) + '…' : l), datasets: [{ label: 'توقف جمع', data: sumDownByLine, color: '#dc2626' }], showLegend: false })
  const avgDownByLine = lineNames.map(n => { const e = byLine.get(n)!; return Math.round((e.sumDown / (e.count || 1)) * 10) / 10 })
  charts.push({ type: 'bar', title: 'میانگین توقف به تفکیک خط (ساعت)', labels: lineNames.map(l => l.length > 14 ? l.slice(0, 14) + '…' : l), datasets: [{ label: 'توقف میانگین', data: avgDownByLine, color: '#f97316' }], showLegend: false })

  const sumRunByLine = lineNames.map(n => Math.round((byLine.get(n)!.sumRun) * 10) / 10)
  charts.push({ type: 'bar', title: 'مجموع کارکرد به تفکیک خط (ساعت)', labels: lineNames.map(l => l.length > 14 ? l.slice(0, 14) + '…' : l), datasets: [{ label: 'کارکرد جمع', data: sumRunByLine, color: '#059669' }], showLegend: false })

  const avgEffByLine = lineNames.map(n => { const e = byLine.get(n)!; const a = e.effs.length ? e.effs.reduce((x, y) => x + y, 0) / e.effs.length : 0; return Math.round(a * 10) / 10 })
  charts.push({ type: 'bar', title: 'میانگین راندمان به تفکیک خط (٪)', labels: lineNames.map(l => l.length > 14 ? l.slice(0, 14) + '…' : l), datasets: [{ label: 'راندمان میانگین', data: avgEffByLine, color: '#0f2040' }], showLegend: false })

  if (dateKeys.length >= 2) {
    const useKeys = dateKeys.length > 24 ? (() => { const step = Math.ceil(dateKeys.length / 24); const p: string[] = []; for (let i = 0; i < dateKeys.length; i += step) p.push(dateKeys[i]); return p })() : dateKeys
    const sumDownDaily = useKeys.map(d => Math.round((byDate.get(d)!.sumDown) * 10) / 10)
    charts.push({ type: 'bar', title: `روند روزانه توقف (مجموع)${dateKeys.length > 24 ? ` — ${dateKeys.length} روز در ${useKeys.length} نقطه` : ''}`, labels: useKeys.map(d => formatDate(d).slice(5)), datasets: [{ label: 'توقف', data: sumDownDaily, color: '#dc2626' }], showLegend: false })
    const avgDownDaily = useKeys.map(d => { const e = byDate.get(d)!; return Math.round((e.sumDown / (e.count || 1)) * 10) / 10 })
    charts.push({ type: 'bar', title: 'روند روزانه توقف (میانگین)', labels: useKeys.map(d => formatDate(d).slice(5)), datasets: [{ label: 'توقف میانگین', data: avgDownDaily, color: '#f97316' }], showLegend: false })
  }

  if (weekKeys.length >= 2) {
    const wkDown = weekKeys.map(k => Math.round((byWeek.get(k)!.sumDown) * 10) / 10)
    charts.push({ type: 'bar', title: 'مجموع هفتگی توقف (ساعت)', labels: weekKeys, datasets: [{ label: 'توقف هفتگی', data: wkDown, color: '#1e3a5f' }], showLegend: false })
  }
  if (monthKeys.length >= 2) {
    const mDown = monthKeys.map(k => Math.round((byMonth.get(k)!.sumDown) * 10) / 10)
    charts.push({ type: 'bar', title: 'مجموع ماهانه توقف (ساعت)', labels: monthKeys.map(k => formatMonthLabel(k)), datasets: [{ label: 'توقف ماهانه', data: mDown, color: '#7c3aed' }], showLegend: false })
  }

  const causeLabels = [...byCause.keys()].sort((a, b) => (byCause.get(b)!.sumDown) - (byCause.get(a)!.sumDown)).slice(0, 8)
  if (causeLabels.length) {
    charts.push({ type: 'pie', title: `سهم علل توقف (بر اساس مجموع ساعت — Top ${causeLabels.length})`, labels: causeLabels.map(c => c.length > 22 ? c.slice(0, 22) + '…' : c), datasets: [{ label: 'توقف', data: causeLabels.map(c => Math.round(byCause.get(c)!.sumDown * 10) / 10) }], showLegend: false })
    charts.push({ type: 'pie', title: 'سهم علل توقف (بر اساس تعداد رکورد)', labels: causeLabels.map(c => c.length > 22 ? c.slice(0, 22) + '…' : c), datasets: [{ label: 'تعداد', data: causeLabels.map(c => byCause.get(c)!.count) }], showLegend: false })
  }

  const deviceLabels = [...byDevice.keys()].sort((a, b) => (byDevice.get(b)!.sumDown) - (byDevice.get(a)!.sumDown)).slice(0, 8)
  if (deviceLabels.length > 1) {
    charts.push({ type: 'pie', title: `سهم دستگاه‌ها در توقف (Top ${deviceLabels.length})`, labels: deviceLabels.map(c => c.length > 18 ? c.slice(0, 18) + '…' : c), datasets: [{ label: 'توقف', data: deviceLabels.map(c => Math.round(byDevice.get(c)!.sumDown * 10) / 10) }], showLegend: false })
  }

  if (byShift.size > 1) {
    const shLabels = [...byShift.keys()].sort((a, b) => (byShift.get(b)!.sumDown) - (byShift.get(a)!.sumDown))
    charts.push({ type: 'pie', title: 'سهم شیفت‌ها در توقف', labels: shLabels.map(c => c.length > 14 ? c.slice(0, 14) + '…' : c), datasets: [{ label: 'توقف', data: shLabels.map(c => Math.round(byShift.get(c)!.sumDown * 10) / 10) }], showLegend: false })
  }

  if (lineNames.length > 1) {
    charts.push({ type: 'donut', title: 'توزیع توقف بین خطوط (سهم از مجموع)', labels: lineNames.slice(0, 8).map(l => l.length > 16 ? l.slice(0, 16) + '…' : l), datasets: [{ label: 'توقف', data: lineNames.slice(0, 8).map(l => Math.round((byLine.get(l)!.sumDown) * 10) / 10) }], showLegend: false })
  }

  const tableRows = rows.map(r => ({
    تاریخ: formatDate(r.date),
    خط: r.line,
    شیفت: r.shift,
    دستگاه: r.device || '—',
    علت: r.cause || '—',
    توقف: formatHours(r.downtime_hours),
    کارکرد: formatHours(r.runtime_hours),
    راندمان: r.efficiency != null ? `${Math.round(r.efficiency * 10) / 10}٪` : '—',
  }))

  const ctx = {
    title,
    factoryName,
    factoryAddress,
    dateFrom,
    dateTo,
    rows: tableRows as unknown as Record<string, string | number>[],
    rawRows: rows as unknown[],
    filters: chips,
    kpis,
    charts: charts.length ? charts : undefined,
    branding,
  }

  const base = downtimeTemplate.build(ctx)

  const extraTables: typeof base.tables = []

  const statsRows = [
    { 'پارامتر': 'توقف (ساعت)', 'تعداد مقدار': count, 'جمع کل': formatHours(totalDowntime), 'میانگین': formatHours(count ? totalDowntime / count : 0), 'کمینه': formatHours(minDown), 'بیشینه': formatHours(maxDown) },
    { 'پارامتر': 'کارکرد (ساعت)', 'تعداد مقدار': count, 'جمع کل': formatHours(totalRuntime), 'میانگین': formatHours(count ? totalRuntime / count : 0), 'کمینه': formatHours(minRun), 'بیشینه': formatHours(maxRun) },
    { 'پارامتر': 'راندمان (٪)', 'تعداد مقدار': effs.length, 'جمع کل': '—', 'میانگین': avgEff != null ? `${Math.round(avgEff * 10) / 10}٪` : '—', 'کمینه': effs.length ? `${Math.round(minEff * 10) / 10}٪` : '—', 'بیشینه': effs.length ? `${Math.round(maxEff * 10) / 10}٪` : '—' },
  ]
  extraTables!.push({
    columns: Object.keys(statsRows[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
    rows: statsRows as unknown as Record<string, unknown>[],
    variant: 'striped',
    striped: true,
    bordered: false,
    headerBg: '#1e3a5f',
    headerColor: '#fff',
    showRowNumbers: false,
  } as never)

  const byLineRows = [...byLine.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa')).map(([name, v]) => ({
    'خط': name,
    'تعداد': v.count,
    'مجموع توقف': formatHours(v.sumDown),
    'میانگین توقف': formatHours(v.count ? v.sumDown / v.count : 0),
    'مجموع کارکرد': formatHours(v.sumRun),
    'میانگین کارکرد': formatHours(v.count ? v.sumRun / v.count : 0),
    'میانگین راندمان': v.effs.length ? `${Math.round(v.effs.reduce((a, b) => a + b, 0) / v.effs.length * 10) / 10}٪` : '—',
  }))
  const grandLine: Record<string, string | number> = {
    'خط': 'جمع کل',
    'تعداد': count,
    'مجموع توقف': formatHours(totalDowntime),
    'میانگین توقف': formatHours(count ? totalDowntime / count : 0),
    'مجموع کارکرد': formatHours(totalRuntime),
    'میانگین کارکرد': formatHours(count ? totalRuntime / count : 0),
    'میانگین راندمان': avgEff != null ? `${Math.round(avgEff * 10) / 10}٪` : '—',
  }
  extraTables!.push({
    columns: Object.keys(byLineRows[0] ?? grandLine).map(k => ({ key: k, header: k, align: 'center' as const })),
    rows: [...byLineRows, grandLine] as unknown as Record<string, unknown>[],
    variant: 'striped',
    striped: true,
    bordered: false,
    headerBg: '#0f172a',
    headerColor: '#fff',
    showRowNumbers: false,
  } as never)

  const buildIntervalTable = (map: Map<string, { count: number; sumDown: number; sumRun: number }>, labelKey: string, labelFmt: (k: string) => string) => {
    const rows2 = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, v]) => ({
      [labelKey]: labelFmt(key),
      'تعداد': v.count,
      'مجموع توقف': formatHours(v.sumDown),
      'میانگین توقف': formatHours(v.count ? v.sumDown / v.count : 0),
      'مجموع کارکرد': formatHours(v.sumRun),
      'میانگین کارکرد': formatHours(v.count ? v.sumRun / v.count : 0),
    }))
    if (!rows2.length) return null
    return {
      columns: Object.keys(rows2[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: rows2 as unknown as Record<string, unknown>[],
      variant: 'striped' as const,
      striped: true,
      bordered: false,
      headerBg: '#334155',
      headerColor: '#fff',
      showRowNumbers: false,
    }
  }

  const dailyTable = buildIntervalTable(byDate, 'تاریخ', d => formatDate(d))
  if (dailyTable) extraTables!.push(dailyTable as never)
  if (weekKeys.length > 1) {
    const wt = buildIntervalTable(byWeek, 'هفته', k => k)
    if (wt) extraTables!.push(wt as never)
  }
  if (monthKeys.length > 1) {
    const mt = buildIntervalTable(byMonth, 'ماه', k => formatMonthLabel(k))
    if (mt) extraTables!.push(mt as never)
  }

  if (byDevice.size) {
    const dRows = [...byDevice.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).map(([name, v]) => ({
      'دستگاه': name.length > 28 ? name.slice(0, 28) + '…' : name,
      'تعداد': v.count,
      'مجموع توقف': formatHours(v.sumDown),
      'میانگین توقف': formatHours(v.count ? v.sumDown / v.count : 0),
    }))
    extraTables!.push({
      columns: Object.keys(dRows[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: dRows as unknown as Record<string, unknown>[],
      variant: 'striped',
      striped: true,
      bordered: false,
      headerBg: '#475569',
      headerColor: '#fff',
      showRowNumbers: false,
    } as never)
  }

  if (byCause.size) {
    const cRows = [...byCause.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).map(([name, v]) => ({
      'علت': name.length > 28 ? name.slice(0, 28) + '…' : name,
      'تعداد': v.count,
      'مجموع توقف': formatHours(v.sumDown),
      'میانگین توقف': formatHours(v.count ? v.sumDown / v.count : 0),
    }))
    extraTables!.push({
      columns: Object.keys(cRows[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: cRows as unknown as Record<string, unknown>[],
      variant: 'striped',
      striped: true,
      bordered: false,
      headerBg: '#7c2d12',
      headerColor: '#fff',
      showRowNumbers: false,
    } as never)
  }

  if (byShift.size) {
    const sRows = [...byShift.entries()].sort((a, b) => b[1].sumDown - a[1].sumDown).map(([name, v]) => ({
      'شیفت': name,
      'تعداد': v.count,
      'مجموع توقف': formatHours(v.sumDown),
      'میانگین توقف': formatHours(v.count ? v.sumDown / v.count : 0),
      'مجموع کارکرد': formatHours(v.sumRun),
    }))
    extraTables!.push({
      columns: Object.keys(sRows[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: sRows as unknown as Record<string, unknown>[],
      variant: 'striped',
      striped: true,
      bordered: false,
      headerBg: '#1e3a5f',
      headerColor: '#fff',
      showRowNumbers: false,
    } as never)
  }

  base.tables = [...(base.tables ?? []), ...(extraTables ?? [])]

  base.sections = [
    ...(base.sections ?? []),
    {
      type: 'text',
      title: 'راهنما',
      html: `<div style="font-size:7px;color:#475569;line-height:1.8"><div style="font-weight:700;color:#0f2040;margin-bottom:4px">راهنمای جداول و بازه‌ها — توقفات</div><div><b>جدول ۱:</b> جزئیات هر رکورد (تاریخ، خط، شیفت، دستگاه، علت، توقف/کارکرد HH:MM، راندمان).</div><div><b>جدول آمار کلی:</b> جمع/میانگین/کمینه/بیشینهٔ توقف و کارکرد (HH:MM) و راندمان.</div><div><b>جدول تفکیک خط:</b> برای هر خط تعداد، مجموع/میانگین توقف و کارکرد و میانگین راندمان + جمع کل.</div><div><b>جداول بازه‌ای (روزانه/هفتگی/ماهانه):</b> همان تفکیک جمع/میانگین توقف و کارکرد گروه‌بندی‌شده در هر بازهٔ تقویمی.</div><div><b>جداول دستگاه/علت/شیفت:</b> تفکیک مشابه بر اساس هر بُعد.</div><div style="margin-top:4px;color:#64748b">نمودارها: میله‌ای جمع/میانگین توقف و کارکرد و راندمان به تفکیک خط، روند روزانه/هفتگی/ماهانه، پای علت/دستگاه/شیفت و توزیع خطوط.</div></div>`,
    },
  ]

  if (!rows.length) {
    base.sections = [
      ...(base.sections ?? []),
      { type: 'text', title: 'وضعیت داده', html: `<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;background:#f8fafc"><div style="font-weight:700;color:#0f2040;margin-bottom:4px">برای بازه/فیلتر انتخابی رکوردی یافت نشد</div><div style="font-size:7px;color:#64748b">فیلترها یا بازه را تغییر دهید.</div></div>` },
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
  return chips.map(c => `<span style="display:inline-flex;align-items:center;gap:4px;background:#f1f5f9;border:1px solid #cbd5e1;border-radius:999px;padding:2px 8px;font-size:7px;margin:2px"><b style="color:#1e3a5f">${esc(c.label)}:</b> ${esc(c.value)}</span>`).join('')
}
