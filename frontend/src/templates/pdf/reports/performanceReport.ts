import type { PdfRenderOptions, PdfKpiCard } from '../../../utils/pdf/types'
import { downtimeTemplate } from '../../../utils/pdf/templates'

export interface PerformanceReportInput { title: string; factoryName: string; dateFrom: string; dateTo: string; rows: Record<string, string | number>[]; kpis?: PdfKpiCard[]; branding?: { logoUrl?: string } }
export function buildPerformanceReport(input: PerformanceReportInput): PdfRenderOptions {
  return downtimeTemplate.build({ title: input.title, factoryName: input.factoryName, dateFrom: input.dateFrom, dateTo: input.dateTo, rows: input.rows, rawRows: input.rows as unknown[], kpis: input.kpis, branding: input.branding })
}
