import { api } from './client'
import { fetchPaginated, fetchAll } from './base'
import type {
  ProductionReport,
  ProductionReportPayload,
  ProductionReportFilters,
  AttributeDef,
  FactoryAnalysisSchema,
  FactoryAnalysisDefinitionFull,
  FactoryAnalysisDefinitionPayload,
} from '../types'

export const getProductionReports = (filters: ProductionReportFilters = {}, page = 1, pageSize = 30) =>
  fetchPaginated<ProductionReport>('/production-reports/', filters as unknown as Record<string, unknown>, page, pageSize)

export const fetchAllProductionReports = (filters: ProductionReportFilters = {}, pageSize = 200) =>
  fetchAll<ProductionReport>('/production-reports/', filters as unknown as Record<string, unknown>, pageSize)

export const createProductionReport = (payload: ProductionReportPayload) =>
  api.post<ProductionReport>('/production-reports/', payload).then((r) => r.data)

export const updateProductionReport = (id: number, payload: Partial<ProductionReportPayload>) =>
  api.patch<ProductionReport>(`/production-reports/${id}/`, payload).then((r) => r.data)

export const deleteProductionReport = (id: number) =>
  api.delete(`/production-reports/${id}/`)

// اسکیمای داینامیک آنالیز کارخانه (بر اساس خط یا کارخانه)
export function getFactoryAnalysisSchema(lineId?: number, factoryId?: number) {
  const params: Record<string, number> = {}
  if (lineId) params.line = lineId
  if (factoryId) params.factory = factoryId
  return api.get<FactoryAnalysisSchema>('/factory-analysis-definition/schema/', { params }).then(r => r.data)
}

// تعریف کامل آنالیز کارخانه (با فرمول‌ها)؛ اگر تعریفی نباشد null
export async function getFactoryAnalysisDefinition(factoryId: number) {
  const r = await api.get<FactoryAnalysisDefinitionFull>(
    `/factories/${factoryId}/analysis-definition/`,
    { validateStatus: (s) => s === 200 || s === 404 },
  )
  return r.status === 404 ? null : r.data
}

export function saveFactoryAnalysisDefinition(factoryId: number, payload: FactoryAnalysisDefinitionPayload) {
  return api.put<FactoryAnalysisDefinitionFull>(`/factories/${factoryId}/analysis-definition/`, payload).then((r) => r.data)
}

export function deleteFactoryAnalysisDefinition(factoryId: number) {
  return api.delete(`/factories/${factoryId}/analysis-definition/`)
}

export function validateFactoryFormula(factoryId: number, expression: string) {
  return api
    .post<{ ok: boolean; errors: string[] }>('/formula/validate-factory/', {
      factory_id: factoryId,
      expression,
    })
    .then((r) => r.data)
}

export interface AttributesPayload {
  attributes_values: Record<string, number | string>
  attribute_defs?: AttributeDef[]
}

export async function getLineAttributes(id: number): Promise<{ id: number; attributes_values: Record<string, number | string>; attribute_defs: AttributeDef[] }> {
  const { data } = await api.get(`/lines/${id}/attributes/`)
  return data
}

export async function saveLineAttributes(id: number, attributes_values: Record<string, number | string>) {
  const { data } = await api.patch(`/lines/${id}/attributes/`, { attributes_values })
  return data
}

export async function getDeviceAttributes(id: number): Promise<{ id: number; name: string; code: string; attributes_values: Record<string, number | string>; attribute_defs: AttributeDef[] }> {
  const { data } = await api.get(`/devices/${id}/attributes/`)
  return data
}

export async function saveDeviceAttributes(id: number, attributes_values: Record<string, number | string>) {
  const { data } = await api.patch(`/devices/${id}/attributes/`, { attributes_values })
  return data
}
