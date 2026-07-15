import { api } from './client'
import type { DeviceLog, DeviceLogPayload, LogFilters } from '../types'

function buildQuery(filters: LogFilters): Record<string, string | number> {
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

export async function getLogs(
  filters: LogFilters = {},
): Promise<DeviceLog[]> {
  const { data } = await api.get<DeviceLog[]>('/device-logs/', { params: buildQuery(filters) })
  return data
}

export async function getLogsPage(
  filters: LogFilters = {},
  page = 1,
  pageSize = 30,
): Promise<PaginatedResponse<DeviceLog>> {
  const { data } = await api.get<PaginatedResponse<DeviceLog>>('/device-logs/', {
    params: { ...buildQuery(filters), page, page_size: pageSize },
  })
  return data
}

export async function fetchAllLogs(
  filters: LogFilters = {},
  pageSize = 200,
  onChunk?: (chunk: DeviceLog[], loaded: number, total: number) => void,
): Promise<DeviceLog[]> {
  const first = await getLogsPage(filters, 1, pageSize)
  let all = [...first.results]
  onChunk?.(first.results, all.length, first.count)
  const totalPages = Math.max(1, Math.ceil(first.count / pageSize))
  for (let page = 2; page <= totalPages; page++) {
    const next = await getLogsPage(filters, page, pageSize)
    all = all.concat(next.results)
    onChunk?.(next.results, all.length, next.count)
  }
  return all
}

export async function createLog(payload: DeviceLogPayload): Promise<DeviceLog> {
  const { data } = await api.post<DeviceLog>('/device-logs/', payload)
  return data
}

export async function updateLog(
  id: number,
  payload: Partial<DeviceLogPayload>,
): Promise<DeviceLog> {
  const { data } = await api.patch<DeviceLog>(`/device-logs/${id}/`, payload)
  return data
}

export async function deleteLog(id: number): Promise<void> {
  await api.delete(`/device-logs/${id}/`)
}
