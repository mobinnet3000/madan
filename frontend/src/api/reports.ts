import { api } from './client'

export async function downloadPerformanceReport(
  factoryId: number | null,
  range: string,
  format: 'pdf' | 'excel',
  dateFrom?: string,
  dateTo?: string,
): Promise<void> {
  const params: Record<string, string> = { range, format }
  if (factoryId) params.factory_id = String(factoryId)
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo

  const res = await api.get('/reports/performance/', {
    params,
    responseType: 'blob',
  })

  const cd = res.headers['content-disposition']
  const match = cd?.match(/filename="?(.+?)"?$/)
  const filename = match?.[1] || `performance_report_${factoryId || 'all'}_${range}.${format}`
  const url = URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function downloadAnalysisReport(
  factoryId: number | null,
  range: string,
  format: 'pdf' | 'excel',
  dateFrom?: string,
  dateTo?: string,
): Promise<void> {
  const params: Record<string, string> = { range, format }
  if (factoryId) params.factory_id = String(factoryId)
  if (dateFrom) params.date_from = dateFrom
  if (dateTo) params.date_to = dateTo

  const res = await api.get('/reports/analysis/', {
    params,
    responseType: 'blob',
  })

  const cd = res.headers['content-disposition']
  const match = cd?.match(/filename="?(.+?)"?$/)
  const filename = match?.[1] || `analysis_report_${factoryId || 'all'}_${range}.${format}`
  const url = URL.createObjectURL(new Blob([res.data]))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export interface ReportRange {
  key: string
  label: string
}

export async function fetchReportRanges(): Promise<ReportRange[]> {
  const { data } = await api.get<Record<string, string>>('/reports/ranges/')
  return Object.entries(data).map(([key, label]) => ({ key, label }))
}
