import { formatDate, formatNumber } from '../../../utils'
import { downtimeTemplate } from '../../../utils/pdf/templates'
import type {
  AppliedFilterChip,
  PdfChartConfig,
  PdfKpiCard,
  PdfRenderOptions,
  PdfTableConfig,
} from '../../../utils/pdf/types'
import type { FactoryTabBrief, FactoryTabReportRun } from '../../../types'

export interface TabReportPdfInput {
  title: string
  factoryName: string
  factoryAddress?: string
  dateFrom: string
  dateTo: string
  tab: FactoryTabBrief
  run: FactoryTabReportRun
  detailRows: Record<string, string | number>[]
  chips?: AppliedFilterChip[]
}

const PALETTE = ['#0f2040', '#ea580c', '#059669', '#7c3aed', '#0284c7', '#dc2626', '#0891b2', '#65a30d']

function num(v: number | null | undefined, unit = ''): string {
  if (v === null || v === undefined) return '—'
  return `${formatNumber(v)}${unit ? ` ${unit}` : ''}`
}

function statLabel(s: string): string {
  return { sum: 'جمع کل', avg: 'میانگین', min: 'کمینه', max: 'بیشینه', count: 'تعداد' }[s] ?? s
}

function short(s: string, n = 14): string {
  return s.length > n ? `${s.slice(0, n)}…` : s
}

/** PDF تب: ابتدا گزارش (KPI + متریک)، سپس نمودارها، سپس جدول‌ها، آخر جزئیات رکوردها. */
export function buildTabReportPdf(input: TabReportPdfInput): PdfRenderOptions {
  const { run, tab, detailRows, chips = [], title, factoryName, factoryAddress, dateFrom, dateTo } = input

  const kpis: PdfKpiCard[] = []
  const kpiWidget = run.widgets.find((w) => w.type === 'kpi' && !w.error && w.data?.cards)
  const cards = kpiWidget?.data?.cards ?? []
  cards.slice(0, 6).forEach((c, i) => {
    kpis.push({
      label: c.label,
      value: num(c.value),
      suffix: Object.keys(c.sub ?? {}).length
        ? Object.entries(c.sub).map(([k, v]) => `${statLabel(k)} ${num(v)}`).join(' · ')
        : undefined,
      bg: ['#eff6ff', '#f0fdfa', '#faf5ff', '#fff7ed', '#f0f9ff', '#fef2f2'][i % 6],
      color: ['#1e3a5f', '#0f766e', '#6b21a8', '#9a3412', '#075985', '#991b1b'][i % 6],
    })
  })
  if (!kpis.length) {
    kpis.push({ label: 'تعداد رکورد', value: formatNumber(run.record_count), suffix: 'مورد', bg: '#eff6ff', color: '#1e3a5f' })
  }
  run.metrics
    .filter((m) => m.value !== null && m.error == null)
    .slice(0, 4)
    .forEach((m, i) => {
      kpis.push({
        label: m.label,
        value: num(m.value, m.unit),
        bg: ['#faf5ff', '#f0fdfa', '#fff7ed', '#eff6ff'][i % 4],
        color: ['#6b21a8', '#0f766e', '#9a3412', '#1e3a5f'][i % 4],
      })
    })

  const charts: PdfChartConfig[] = []
  run.widgets
    .filter((w) => w.type === 'chart' && !w.error && (w.data?.points?.length ?? 0) > 0)
    .forEach((w, i) => {
      const pts = w.data!.points!.map((p) => ({
        label: p.label,
        value: typeof p.value === 'number' ? p.value : 0,
      }))
      charts.push({
        type: w.data!.chart === 'pie' ? 'pie' : w.data!.chart === 'line' ? 'bar' : 'bar',
        title: w.title,
        labels: pts.map((p) => short(p.label, w.data!.chart === 'pie' ? 18 : 12)),
        datasets: [{ label: w.data?.value_label || 'مقدار', data: pts.map((p) => p.value), color: PALETTE[i % PALETTE.length] }],
        showLegend: false,
      })
    })

  const tables: PdfTableConfig[] = []
  const statWidget = run.widgets.find((w) => w.type === 'stat_table' && !w.error && w.data?.rows?.length)
  if (statWidget?.data?.rows?.length) {
    const cols = statWidget.data.columns ?? []
    const statKeys = cols.filter((c) => c !== 'field' && c !== 'label')
    tables.push({
      columns: [
        { key: 'label', header: 'پارامتر', align: 'right' },
        ...statKeys.map((c) => ({ key: c, header: statLabel(c), align: 'center' as const })),
      ],
      rows: statWidget.data.rows as unknown as Record<string, unknown>[],
      variant: 'striped', striped: true, bordered: false,
      headerBg: '#1e3a5f', headerColor: '#fff', showRowNumbers: false,
    } as never)
  }

  run.widgets
    .filter((w) => w.type === 'group_table' && !w.error && w.data?.rows?.length)
    .forEach((w, i) => {
      const rows = [...(w.data!.rows as unknown as Record<string, unknown>[])]
      if (w.data?.total) rows.push(w.data.total as unknown as Record<string, unknown>)
      const cols = w.data!.columns ?? []
      tables.push({
        columns: cols.map((c) => ({
          key: c,
          header: c === 'label' ? 'گروه' : c === 'count' ? 'تعداد' : aggHeader(c, tab),
          align: 'center' as const,
          format: (v: unknown) => (typeof v === 'number' ? formatNumber(v) : v === null || v === undefined ? '—' : String(v)),
        })),
        rows,
        variant: 'striped', striped: true, bordered: false,
        headerBg: ['#0f172a', '#334155', '#155e75'][i % 3], headerColor: '#fff',
        showRowNumbers: false,
      } as never)
    })

  const base = downtimeTemplate.build({
    title,
    factoryName,
    factoryAddress,
    dateFrom,
    dateTo,
    rows: detailRows as unknown as Record<string, string | number>[],
    rawRows: detailRows as unknown[],
    filters: chips,
    kpis,
    charts: charts.length ? charts : undefined,
    branding: {},
  })

  const detailTable: PdfTableConfig = {
    columns: Object.keys(detailRows[0] ?? {}).map((k) => ({ key: k, header: k, align: 'center' as const })),
    rows: detailRows as unknown as Record<string, unknown>[],
    variant: 'striped', striped: true, bordered: false,
    headerBg: '#1e3a5f', headerColor: '#fff', showRowNumbers: true, maxRows: 400,
  }
  base.tables = [...(base.tables ?? []), ...tables, detailTable]

  const guide = `<div style="font-size:7px;color:#475569;line-height:1.8">
    <div style="font-weight:700;color:#0f2040;margin-bottom:4px">ساختار این گزارش — تب «${tab.name}»</div>
    <div><b>۱) شاخص‌ها (KPI):</b> اولین ویجت گزارش، سپس متریک‌های محاسباتی.</div>
    <div><b>۲) نمودارها:</b> همه ویجت‌های نموداری (میله‌ای/دایره‌ای).</div>
    <div><b>۳) جداول:</b> آمار فیلدها و جدول‌های تفکیکی گزارش.</div>
    <div><b>۴) جدول رکوردها:</b> جزئیات خام رکوردهای ثبت‌شده در همین فیلتر.</div>
  </div>`
  base.sections = [...(base.sections ?? []), { type: 'text', title: 'راهنما', html: guide }]

  if (!run.record_count) {
    base.sections = [
      ...(base.sections ?? []),
      {
        type: 'text',
        title: 'وضعیت داده',
        html: `<div style="border:1px dashed #cbd5e1;border-radius:10px;padding:14px;text-align:center;background:#f8fafc"><div style="font-weight:700;color:#0f2040;margin-bottom:4px">برای بازه/فیلتر انتخابی رکوردی یافت نشد</div><div style="font-size:7px;color:#64748b">فیلترها یا بازه را تغییر دهید.</div></div>`,
      },
    ]
  }

  return base
}

function aggHeader(col: string, tab: FactoryTabBrief): string {
  const idx = col.lastIndexOf('__')
  if (idx < 0) return col
  const ref = col.slice(0, idx)
  const stat = col.slice(idx + 2)
  const key = ref.includes('.') ? ref.split('.').pop()! : ref
  const label =
    tab.outputs.find((o) => o.key === key)?.name ??
    tab.inputs.find((i) => i.key === key)?.name ?? key
  return `${label} (${statLabel(stat)})`
}

export function buildTabReportPdfLegacy(input: {
  title: string; factoryName: string; dateFrom: string; dateTo: string
  rows: Record<string, string | number>[]; kpis?: PdfKpiCard[]
}): PdfRenderOptions {
  return downtimeTemplate.build({
    title: input.title, factoryName: input.factoryName,
    dateFrom: input.dateFrom, dateTo: input.dateTo,
    rows: input.rows, rawRows: input.rows as unknown[], kpis: input.kpis,
  })
}
