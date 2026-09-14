import type { PdfRenderOptions } from '../../../utils/pdf/types'
import { standardTemplate } from '../../../utils/pdf/templates'

export interface StandardReportInput {
  title: string
  factoryName: string
  factoryAddress?: string
  dateFrom?: string
  dateTo?: string
  rows: Record<string, string | number>[]
  branding?: { logoUrl?: string; primaryColor?: string }
}

export function buildStandardReport(input: StandardReportInput): PdfRenderOptions {
  return standardTemplate.build({
    title: input.title,
    factoryName: input.factoryName,
    factoryAddress: input.factoryAddress,
    dateFrom: input.dateFrom ?? '',
    dateTo: input.dateTo ?? '',
    rows: input.rows,
    rawRows: input.rows as unknown[],
    branding: input.branding,
  })
}
