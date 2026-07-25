import { createApi, fetchPaginated, fetchAll } from './base'
import type { DeviceDailyAnalysis, DeviceDailyAnalysisPayload, AnalysisFilters } from '../types'

const api = createApi<DeviceDailyAnalysis, DeviceDailyAnalysisPayload>('/daily-analysis/')

export const getAnalyses = api.list
export const getAnalysesPage = (filters: AnalysisFilters = {}, page = 1, pageSize = 200) =>
  fetchPaginated<DeviceDailyAnalysis>('/daily-analysis/', filters as unknown as Record<string, unknown>, page, pageSize)
export const fetchAllAnalyses = (
  filters: AnalysisFilters = {}, pageSize = 200,
  onChunk?: (chunk: DeviceDailyAnalysis[], loaded: number, total: number) => void,
) => fetchAll<DeviceDailyAnalysis>('/daily-analysis/', filters as unknown as Record<string, unknown>, pageSize, onChunk)
export const createAnalysis = api.create
export const updateAnalysis = api.update
export const deleteAnalysis = api.delete
