import { formatDate, formatNumber } from '../../../utils'
import { downtimeTemplate } from '../../../utils/pdf/templates'
import type { PdfRenderOptions, PdfKpiCard, PdfChartConfig, AppliedFilterChip } from '../../../utils/pdf/types'
import type { DeliveredTonnage } from '../../../types'

export interface TonnageReportInput {
  title: string
  factoryName: string
  factoryAddress?: string
  dateFrom: string
  dateTo: string
  records: DeliveredTonnage[]
  chips?: AppliedFilterChip[]
  branding?: { logoUrl?: string; primaryColor?: string }
}

function uniqOutputs(records: DeliveredTonnage[]): string[] {
  return Array.from(new Set(records.flatMap(r => Object.keys(r.outputs || {})))).sort((a, b) => a.localeCompare(b, 'fa'))
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

export function buildTonnageReport(input: TonnageReportInput): PdfRenderOptions {
  const { records, title, factoryName, factoryAddress, dateFrom, dateTo, chips = [], branding } = input
  const outputKeys = uniqOutputs(records)
  const count = records.length

  const sums: Record<string, number> = {}
  const avgs: Record<string, number> = {}
  const mins: Record<string, number> = {}
  const maxs: Record<string, number> = {}
  const cnts: Record<string, number> = {}
  outputKeys.forEach(k => {
    const vals = records.map(r => r.outputs?.[k]).filter(v => typeof v === 'number') as number[]
    const s = vals.reduce((a, b) => a + b, 0)
    sums[k] = s
    cnts[k] = vals.length
    avgs[k] = vals.length ? s / vals.length : 0
    mins[k] = vals.length ? Math.min(...vals) : 0
    maxs[k] = vals.length ? Math.max(...vals) : 0
  })
  const topKeys = [...outputKeys].sort((a, b) => (sums[b] ?? 0) - (sums[a] ?? 0)).slice(0, 4)

  const kpis: PdfKpiCard[] = [
    { label: 'تعداد رکورد', value: formatNumber(count), suffix: 'مورد', bg: '#eff6ff', color: '#1e3a5f' },
    ...topKeys.slice(0, 3).map(k => ({
      label: `مجموع ${k}`,
      value: formatNumber(Math.round(sums[k] * 10) / 10),
      suffix: `میانگین ${formatNumber(Math.round(avgs[k] * 10) / 10)}`,
      bg: '#f0fdfa',
      color: '#0f766e',
    })),
  ]
  if (topKeys.length === 0) kpis.push({ label: 'خروجی', value: '—', bg: '#fff7ed', color: '#9a3412' })
  if (outputKeys.length > 3) {
    const rest = outputKeys.length - 3
    const restSum = outputKeys.slice(3).reduce((a, k) => a + (sums[k] ?? 0), 0)
    const restAvg = rest ? restSum / rest : 0
    kpis.push({ label: `سایر (${rest}) جمع`, value: formatNumber(Math.round(restSum * 10) / 10), suffix: `میانگین ${formatNumber(Math.round(restAvg * 10) / 10)}`, bg: '#faf5ff', color: '#6b21a8' })
  }

  const byLine = new Map<string, { count: number; sums: Record<string, number> }>()
  const byDate = new Map<string, { count: number; sums: Record<string, number> }>()
  const byWeek = new Map<string, { count: number; sums: Record<string, number> }>()
  const byMonth = new Map<string, { count: number; sums: Record<string, number> }>()
  const byContractor = new Map<string, { count: number; sums: Record<string, number> }>()
  const byHour = new Map<string, number>()

  for (const r of records) {
    const ln = r.line?.name || '—'
    const le = byLine.get(ln) ?? { count: 0, sums: {} }
    le.count += 1
    for (const k of outputKeys) {
      const v = r.outputs?.[k]
      if (typeof v === 'number') le.sums[k] = (le.sums[k] ?? 0) + v
    }
    byLine.set(ln, le)

    const d = r.date || ''
    const de = byDate.get(d) ?? { count: 0, sums: {} }
    de.count += 1
    for (const k of outputKeys) {
      const v = r.outputs?.[k]
      if (typeof v === 'number') de.sums[k] = (de.sums[k] ?? 0) + v
    }
    byDate.set(d, de)

    const wk = isoWeekKey(d)
    const we = byWeek.get(wk) ?? { count: 0, sums: {} }
    we.count += 1
    for (const k of outputKeys) {
      const v = r.outputs?.[k]
      if (typeof v === 'number') we.sums[k] = (we.sums[k] ?? 0) + v
    }
    byWeek.set(wk, we)

    const mk = monthKey(d)
    const me = byMonth.get(mk) ?? { count: 0, sums: {} }
    me.count += 1
    for (const k of outputKeys) {
      const v = r.outputs?.[k]
      if (typeof v === 'number') me.sums[k] = (me.sums[k] ?? 0) + v
    }
    byMonth.set(mk, me)

    const ck = r.contractor?.name || 'بدون پیمانکار'
    const ce = byContractor.get(ck) ?? { count: 0, sums: {} }
    ce.count += 1
    for (const k of outputKeys) {
      const v = r.outputs?.[k]
      if (typeof v === 'number') ce.sums[k] = (ce.sums[k] ?? 0) + v
    }
    byContractor.set(ck, ce)

    const hh = (r.hour || '').slice(0, 2)
    if (hh) byHour.set(hh, (byHour.get(hh) ?? 0) + 1)
  }

  const charts: PdfChartConfig[] = []
  const lineNames = [...byLine.keys()].sort((a, b) => a.localeCompare(b, 'fa'))
  const dateKeys = [...byDate.keys()].sort()
  const weekKeys = [...byWeek.keys()].sort()
  const monthKeys = [...byMonth.keys()].sort()
  const palette = ['#0f2040', '#ea580c', '#059669', '#7c3aed', '#0284c7', '#dc2626', '#0891b2', '#65a30d']

  topKeys.slice(0, 2).forEach((k, idx) => {
    const sumData = lineNames.map(ln => Math.round((byLine.get(ln)!.sums[k] ?? 0) * 10) / 10)
    charts.push({
      type: 'bar',
      title: `مجموع «${k}» به تفکیک خط`,
      labels: lineNames.map(n => n.length > 14 ? n.slice(0, 14) + '…' : n),
      datasets: [{ label: `${k} جمع`, data: sumData, color: palette[idx % palette.length] }],
      showLegend: false,
    })
    const avgData = lineNames.map(ln => {
      const e = byLine.get(ln)!
      return Math.round(((e.sums[k] ?? 0) / (e.count || 1)) * 10) / 10
    })
    charts.push({
      type: 'bar',
      title: `میانگین «${k}» به تفکیک خط`,
      labels: lineNames.map(n => n.length > 14 ? n.slice(0, 14) + '…' : n),
      datasets: [{ label: `${k} میانگین`, data: avgData, color: palette[(idx + 4) % palette.length] }],
      showLegend: false,
    })
  })

  if (dateKeys.length >= 2 && topKeys[0]) {
    const topK = topKeys[0]
    const useKeys = dateKeys.length > 28 ? (() => {
      const step = Math.ceil(dateKeys.length / 28)
      const p: string[] = []
      for (let i = 0; i < dateKeys.length; i += step) p.push(dateKeys[i])
      return p
    })() : dateKeys
    const sumData = useKeys.map(d => Math.round((byDate.get(d)!.sums[topK] ?? 0) * 10) / 10)
    charts.push({
      type: 'bar',
      title: `روند روزانه «${topK}» (مجموع)${dateKeys.length > 28 ? ` — ${dateKeys.length} روز در ${useKeys.length} نقطه` : ''}`,
      labels: useKeys.map(d => formatDate(d).slice(5)),
      datasets: [{ label: `${topK} جمع`, data: sumData, color: palette[2] }],
      showLegend: false,
    })
    const avgData = useKeys.map(d => {
      const e = byDate.get(d)!
      return Math.round(((e.sums[topK] ?? 0) / (e.count || 1)) * 10) / 10
    })
    charts.push({
      type: 'bar',
      title: `روند روزانه «${topK}» (میانگین)`,
      labels: useKeys.map(d => formatDate(d).slice(5)),
      datasets: [{ label: `${topK} میانگین`, data: avgData, color: palette[6] }],
      showLegend: false,
    })
  }

  if (weekKeys.length >= 2 && topKeys[0]) {
    const wk = topKeys[0]
    const wkData = weekKeys.map(k => Math.round((byWeek.get(k)!.sums[wk] ?? 0) * 10) / 10)
    charts.push({
      type: 'bar',
      title: `مجموع هفتگی «${wk}»`,
      labels: weekKeys,
      datasets: [{ label: `${wk} جمع هفتگی`, data: wkData, color: '#1e3a5f' }],
      showLegend: false,
    })
  }

  if (monthKeys.length >= 2 && topKeys[0]) {
    const mk = topKeys[0]
    const mData = monthKeys.map(k => Math.round((byMonth.get(k)!.sums[mk] ?? 0) * 10) / 10)
    charts.push({
      type: 'bar',
      title: `مجموع ماهانه «${mk}»`,
      labels: monthKeys.map(k => formatMonthLabel(k)),
      datasets: [{ label: `${mk} جمع ماهانه`, data: mData, color: '#7c3aed' }],
      showLegend: false,
    })
  }

  if (byContractor.size > 1) {
    const cLabels = [...byContractor.keys()].sort((a, b) => (byContractor.get(b)!.count) - (byContractor.get(a)!.count)).slice(0, 8)
    charts.push({
      type: 'pie',
      title: 'سهم پیمانکاران (تعداد رکورد)',
      labels: cLabels.map(c => c.length > 18 ? c.slice(0, 18) + '…' : c),
      datasets: [{ label: 'تعداد', data: cLabels.map(c => byContractor.get(c)!.count) }],
      showLegend: false,
    })
    if (topKeys[0]) {
      const tk = topKeys[0]
      const cSum = cLabels.map(c => Math.round((byContractor.get(c)!.sums[tk] ?? 0) * 10) / 10)
      charts.push({
        type: 'pie',
        title: `سهم پیمانکاران در مجموع «${tk}»`,
        labels: cLabels.map(c => c.length > 18 ? c.slice(0, 18) + '…' : c),
        datasets: [{ label: tk, data: cSum }],
        showLegend: false,
      })
    }
  }

  if (byHour.size > 1) {
    const hLabels = [...byHour.keys()].sort()
    const hData = hLabels.map(h => byHour.get(h) ?? 0)
    charts.push({
      type: 'bar',
      title: 'توزیع رکوردها در ساعات شبانه‌روز',
      labels: hLabels.map(h => `${h}:00`),
      datasets: [{ label: 'تعداد', data: hData, color: '#0891b2' }],
      showLegend: false,
    })
  }

  if (outputKeys.length >= 2 && topKeys[0]) {
    const distKey = topKeys[0]
    const pieLabels = lineNames.slice(0, 8)
    const pieData = pieLabels.map(n => Math.round((byLine.get(n)!.sums[distKey] ?? 0) * 10) / 10)
    if (pieLabels.length > 1) {
      charts.push({
        type: 'donut',
        title: `توزیع «${distKey}» بین خطوط (سهم از مجموع)`,
        labels: pieLabels.map(n => n.length > 16 ? n.slice(0, 16) + '…' : n),
        datasets: [{ label: distKey, data: pieData }],
        showLegend: false,
      })
    }
  }

  const detailRows = records.map(r => {
    const row: Record<string, string | number> = {
      'تاریخ': formatDate(r.date),
      'ساعت': (r.hour || '').slice(0, 5),
      'خط': r.line?.name || '—',
      'پیمانکار': r.contractor?.name || '—',
    }
    outputKeys.forEach(k => {
      const v = r.outputs?.[k]
      row[k] = typeof v === 'number' ? Math.round(v * 10) / 10 : (v as string | number) ?? '—'
    })
    if (r.note) row['یادداشت'] = r.note.slice(0, 40)
    return row
  })

  const summaryByLineRows = [...byLine.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fa')).map(([name, v]) => {
    const row: Record<string, string | number> = { 'خط': name, 'تعداد': v.count }
    outputKeys.forEach(k => {
      const s = v.sums[k] ?? 0
      const a = v.count ? s / v.count : 0
      row[`${k} جمع`] = Math.round(s * 10) / 10
      row[`${k} میانگین`] = Math.round(a * 10) / 10
    })
    return row
  })
  const grandRow: Record<string, string | number> = { 'خط': 'جمع کل', 'تعداد': count }
  outputKeys.forEach(k => {
    grandRow[`${k} جمع`] = Math.round(sums[k] * 10) / 10
    grandRow[`${k} میانگین`] = Math.round(avgs[k] * 10) / 10
  })

  const ctx = {
    title,
    factoryName,
    factoryAddress,
    dateFrom,
    dateTo,
    rows: detailRows as unknown as Record<string, string | number>[],
    rawRows: records as unknown[],
    filters: chips,
    kpis,
    charts: charts.length ? charts : undefined,
    branding,
  }
  const base = downtimeTemplate.build(ctx)

  const extraTables: typeof base.tables = []

  const statsRows = outputKeys.map(k => ({
    'پارامتر': k,
    'تعداد مقدار': cnts[k] ?? 0,
    'جمع کل': Math.round(sums[k] * 10) / 10,
    'میانگین': Math.round(avgs[k] * 10) / 10,
    'کمینه': Math.round(mins[k] * 10) / 10,
    'بیشینه': Math.round(maxs[k] * 10) / 10,
  }))
  if (statsRows.length) {
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
  }

  if (summaryByLineRows.length) {
    extraTables!.push({
      columns: Object.keys(summaryByLineRows[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: [...summaryByLineRows, grandRow] as unknown as Record<string, unknown>[],
      variant: 'striped',
      striped: true,
      bordered: false,
      headerBg: '#0f172a',
      headerColor: '#fff',
      showRowNumbers: false,
    } as never)
  }

  const buildIntervalTable = (map: Map<string, { count: number; sums: Record<string, number> }>, labelKey: string, labelFmt: (k: string) => string) => {
    const rows = [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, v]) => {
      const row: Record<string, string | number> = { [labelKey]: labelFmt(key), 'تعداد': v.count }
      outputKeys.forEach(k => {
        const s = v.sums[k] ?? 0
        const a = v.count ? s / v.count : 0
        row[`${k} جمع`] = Math.round(s * 10) / 10
        row[`${k} میانگین`] = Math.round(a * 10) / 10
      })
      return row
    })
    if (!rows.length) return null
    return {
      columns: Object.keys(rows[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: rows as unknown as Record<string, unknown>[],
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

  if (byContractor.size) {
    const cRows = [...byContractor.entries()].sort((a, b) => b[1].count - a[1].count).map(([name, v]) => {
      const row: Record<string, string | number> = { 'پیمانکار': name, 'تعداد': v.count }
      outputKeys.forEach(k => {
        const s = v.sums[k] ?? 0
        const a = v.count ? s / v.count : 0
        row[`${k} جمع`] = Math.round(s * 10) / 10
        row[`${k} میانگین`] = Math.round(a * 10) / 10
      })
      return row
    })
    const cGrand: Record<string, string | number> = { 'پیمانکار': 'جمع کل', 'تعداد': count }
    outputKeys.forEach(k => {
      cGrand[`${k} جمع`] = Math.round(sums[k] * 10) / 10
      cGrand[`${k} میانگین`] = Math.round(avgs[k] * 10) / 10
    })
    extraTables!.push({
      columns: Object.keys(cRows[0] ?? cGrand).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: [...cRows, cGrand] as unknown as Record<string, unknown>[],
      variant: 'striped',
      striped: true,
      bordered: false,
      headerBg: '#1e3a5f',
      headerColor: '#fff',
      showRowNumbers: false,
    } as never)
  }

  if (byHour.size > 1) {
    const hRows = [...byHour.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([hh, cnt]) => ({
      'ساعت': `${hh}:00`,
      'تعداد رکورد': cnt,
    }))
    extraTables!.push({
      columns: Object.keys(hRows[0]).map(k => ({ key: k, header: k, align: 'center' as const })),
      rows: hRows as unknown as Record<string, unknown>[],
      variant: 'striped',
      striped: true,
      bordered: false,
      headerBg: '#475569',
      headerColor: '#fff',
      showRowNumbers: false,
    } as never)
  }

  base.tables = [...(base.tables ?? []), ...(extraTables ?? [])]

  const sectionHtml = `<div style="font-size:7px;color:#475569;line-height:1.8">
    <div style="font-weight:700;color:#0f2040;margin-bottom:4px">راهنمای جداول و بازه‌ها — تناژ تحویلی</div>
    <div><b>جدول ۱:</b> جزئیات هر رکورد (تاریخ، ساعت، خط، پیمانکار و تمام خروجی‌ها).</div>
    <div><b>جدول آمار کلی:</b> برای هر پارامتر تعداد، جمع کل، میانگین، کمینه و بیشینه.</div>
    <div><b>جدول تفکیک خط:</b> برای هر خط تعداد و برای هر پارامتر «جمع» و «میانگین» + جمع کل.</div>
    <div><b>جداول بازه‌ای (روزانه / هفتگی / ماهانه):</b> همان تفکیک جمع/میانگین گروه‌بندی‌شده در هر بازهٔ تقویمی.</div>
    <div><b>جدول پیمانکار و ساعت:</b> تفکیک مشابه بر اساس پیمانکار و ساعت شبانه‌روز.</div>
    <div style="margin-top:4px;color:#64748b">نمودارها: میله‌ای جمع/میانگین هر پارامتر به تفکیک خط، روند روزانه/هفتگی/ماهانه، توزیع سهم خطوط و پیمانکاران، توزیع ساعتی.</div>
  </div>`
  base.sections = [
    ...(base.sections ?? []),
    { type: 'text', title: 'راهنما', html: sectionHtml },
  ]

  if (!records.length) {
    base.sections = [
      ...(base.sections ?? []),
      { type: 'text', title: 'وضعیت داده', html: `<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;background:#f8fafc"><div style="font-weight:700;color:#0f2040;margin-bottom:4px">برای بازه/فیلتر انتخابی رکوردی یافت نشد</div><div style="font-size:7px;color:#64748b">فیلترها یا بازه را تغییر دهید.</div></div>` },
    ]
  }
  return base
}

export function buildTonnageReportLegacy(input: { title: string; factoryName: string; dateFrom: string; dateTo: string; rows: Record<string, string | number>[]; branding?: { logoUrl?: string } }): PdfRenderOptions {
  const { standardTemplate } = require('../../../utils/pdf/templates') as typeof import('../../../utils/pdf/templates')
  return standardTemplate.build({ title: input.title, factoryName: input.factoryName, dateFrom: input.dateFrom, dateTo: input.dateTo, rows: input.rows, rawRows: input.rows as unknown[], branding: input.branding })
}
