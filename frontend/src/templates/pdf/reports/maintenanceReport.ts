import type { PdfRenderOptions } from '../../../utils/pdf/types'
import { standardTemplate } from '../../../utils/pdf/templates'
export interface MaintenanceReportInput { title: string; factoryName: string; dateFrom: string; dateTo: string; rows: Record<string, string | number>[]; branding?: { logoUrl?: string } }
export function buildMaintenanceReport(input: MaintenanceReportInput): PdfRenderOptions {
  return standardTemplate.build({ title: input.title, factoryName: input.factoryName, dateFrom: input.dateFrom, dateTo: input.dateTo, rows: input.rows, rawRows: input.rows as unknown[], branding: input.branding })
}
