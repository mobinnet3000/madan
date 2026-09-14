import type { PdfCoverConfig } from '../../../utils/pdf/types'

export function coverConfig(title: string, factoryName: string, dateFrom: string, dateTo: string, count: number): PdfCoverConfig {
  return {
    title,
    subtitle: 'گزارش تحلیلی',
    factoryName,
    dateFrom,
    dateTo,
    generatedAt: new Date().toLocaleDateString('fa-IR'),
    recordCount: count,
  }
}
