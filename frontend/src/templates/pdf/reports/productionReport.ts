import type { PdfRenderOptions, PdfKpiCard } from '../../../utils/pdf/types'
import { formatNumber } from '../../../utils'
import { downtimeTemplate } from '../../../utils/pdf/templates'

export interface ProductionReportInput {
  title: string
  factoryName: string
  factoryAddress?: string
  dateFrom: string
  dateTo: string
  rows: Record<string, string | number>[]
  totals?: { feed: number; product: number; tailing: number; avgEff: number | null }
  branding?: { logoUrl?: string }
}

export function buildProductionReport(input: ProductionReportInput): PdfRenderOptions {
  const kpis: PdfKpiCard[] | undefined = input.totals ? [
    { label: 'ورودی', value: formatNumber(input.totals.feed), suffix: 'تن' },
    { label: 'محصول', value: formatNumber(input.totals.product), suffix: 'تن' },
    { label: 'باطله', value: formatNumber(input.totals.tailing), suffix: 'تن' },
    { label: 'راندمان', value: input.totals.avgEff != null ? `${(Math.round(input.totals.avgEff * 10) / 10).toString()}٪` : '—' },
  ] : undefined
  return downtimeTemplate.build({
    title: input.title,
    factoryName: input.factoryName,
    factoryAddress: input.factoryAddress,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
    rows: input.rows,
    rawRows: input.rows as unknown[],
    kpis,
    branding: input.branding,
  })
}
