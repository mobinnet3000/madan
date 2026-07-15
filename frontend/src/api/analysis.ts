import { api } from './client'
import type {
  DeviceDailyAnalysis,
  DeviceDailyAnalysisPayload,
  AnalysisFilters,
} from '../types'

function buildQuery(filters: AnalysisFilters): Record<string, string | number> {
  const q: Record<string, string | number> = {}
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q[k] = v
  })
  return q
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export async function getAnalyses(
  filters: AnalysisFilters = {},
): Promise<DeviceDailyAnalysis[]> {
  const { data } = await api.get<DeviceDailyAnalysis[]>('/daily-analysis/', { params: buildQuery(filters) })
  return data
}

export async function getAnalysesPage(
  filters: AnalysisFilters = {},
  page = 1,
  pageSize = 200,
): Promise<PaginatedResponse<DeviceDailyAnalysis>> {
  const { data } = await api.get<PaginatedResponse<DeviceDailyAnalysis>>('/daily-analysis/', {
    params: { ...buildQuery(filters), page, page_size: pageSize },
  })
  return data
}

export async function fetchAllAnalyses(
  filters: AnalysisFilters = {},
  pageSize = 200,
  onChunk?: (chunk: DeviceDailyAnalysis[], loaded: number, total: number) => void,
): Promise<DeviceDailyAnalysis[]> {
  const first = await getAnalysesPage(filters, 1, pageSize)
  let all = [...first.results]
  onChunk?.(first.results, all.length, first.count)
  const totalPages = Math.max(1, Math.ceil(first.count / pageSize))
  for (let page = 2; page <= totalPages; page++) {
    const next = await getAnalysesPage(filters, page, pageSize)
    all = all.concat(next.results)
    onChunk?.(next.results, all.length, next.count)
  }
  return all
}

export async function createAnalysis(
  payload: DeviceDailyAnalysisPayload,
): Promise<DeviceDailyAnalysis> {
  const { data } = await api.post<DeviceDailyAnalysis>('/daily-analysis/', payload)
  return data
}

export async function updateAnalysis(
  id: number,
  payload: Partial<DeviceDailyAnalysisPayload>,
): Promise<DeviceDailyAnalysis> {
  const { data } = await api.patch<DeviceDailyAnalysis>(
    `/daily-analysis/${id}/`,
    payload,
  )
  return data
}

export async function deleteAnalysis(id: number): Promise<void> {
  await api.delete(`/daily-analysis/${id}/`)
}
