import type { PdfRenderOptions } from '../../../utils/pdf/types'
import { tableOnlyTemplate } from '../../../utils/pdf/templates'

export interface TableReportInput {
  title: string
  factoryName: string
  rows: Record<string, string | number>[]
  branding?: { logoUrl?: string }
}

export function buildTableReport(input: TableReportInput): PdfRenderOptions {
  return tableOnlyTemplate.build({
    title: input.title,
    factoryName: input.factoryName,
    dateFrom: '',
    dateTo: '',
    rows: input.rows,
    rawRows: input.rows as unknown[],
    branding: input.branding,
  })
}
