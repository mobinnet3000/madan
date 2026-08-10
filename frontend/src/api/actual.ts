import { api } from './client'
import { fetchPaginated, fetchAll } from './base'
import type {
  ActualAnalysis,
  ActualAnalysisPayload,
  ActualAnalysisFilters,
  AnalysisSchema,
  ProductionLineDetail,
} from '../types'

export function getProductionLineDetail(id: number): Promise<ProductionLineDetail> {
  return api.get<ProductionLineDetail>(`/production-lines/${id}/`).then(r => r.data)
}

export function getAnalysisSchema(id: number): Promise<AnalysisSchema> {
  return api.get<AnalysisSchema>(`/production-lines/${id}/analysis-definition/`).then(r => r.data)
}

export const getActualAnalyses = (
  filters: ActualAnalysisFilters = {},
  page = 1,
  pageSize = 30,
) =>
  fetchPaginated<ActualAnalysis>(
    '/actual-analyses/',
    filters as unknown as Record<string, unknown>,
    page,
    pageSize,
  )

export const fetchAllActualAnalyses = (
  filters: ActualAnalysisFilters = {},
  pageSize = 300,
  onChunk?: (chunk: ActualAnalysis[], loaded: number, total: number) => void,
) =>
  fetchAll<ActualAnalysis>(
    '/actual-analyses/',
    filters as unknown as Record<string, unknown>,
    pageSize,
    onChunk,
  )

export function createActualAnalysis(payload: ActualAnalysisPayload) {
  return api.post<ActualAnalysis>('/actual-analyses/', payload).then(r => r.data)
}

export function updateActualAnalysis(id: number, payload: ActualAnalysisPayload) {
  return api.patch<ActualAnalysis>(`/actual-analyses/${id}/`, payload).then(r => r.data)
}

export function deleteActualAnalysis(id: number) {
  return api.delete(`/actual-analyses/${id}/`)
}

export function validateFormula(lineId: number, expression: string) {
  return api
    .post<{ ok: boolean; errors: string[] }>('/formula/validate/', {
      line_id: lineId,
      expression,
    })
    .then(r => r.data)
}