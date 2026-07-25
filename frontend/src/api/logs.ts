import { createApi, fetchPaginated, fetchAll } from './base'
import type { DeviceLog, DeviceLogPayload, LogFilters } from '../types'

const api = createApi<DeviceLog, DeviceLogPayload>('/device-logs/')

export const getLogs = api.list
export const getLogsPage = (filters: LogFilters = {}, page = 1, pageSize = 30) =>
  fetchPaginated<DeviceLog>('/device-logs/', filters as unknown as Record<string, unknown>, page, pageSize)
export const fetchAllLogs = (
  filters: LogFilters = {}, pageSize = 200,
  onChunk?: (chunk: DeviceLog[], loaded: number, total: number) => void,
) => fetchAll<DeviceLog>('/device-logs/', filters as unknown as Record<string, unknown>, pageSize, onChunk)
export const createLog = api.create
export const updateLog = api.update
export const deleteLog = api.delete
