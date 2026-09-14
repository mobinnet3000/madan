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

export interface DevicePayload {
  line: number
  name: string
  code?: string
  order?: number
  template?: number
}
export async function createDevice(payload: DevicePayload) {
  const { data } = await api.post('/devices/', payload)
  return data
}
export async function updateDevice(id: number, payload: Partial<DevicePayload>) {
  const { data } = await api.patch(`/devices/${id}/`, payload)
  return data
}
export async function deleteDevice(id: number) {
  const { data } = await api.delete(`/devices/${id}/`)
  return data
}
export async function uploadDeviceImage(id: number, file: File) {
  const fd = new FormData()
  fd.append('image', file)
  const { data } = await api.patch(`/devices/${id}/`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  return data
}
export async function deleteDeviceImage(id: number) {
  const { data } = await api.patch(`/devices/${id}/`, { image: null })
  return data
}
export async function reorderDevices(lineId: number, orderedIds: number[]) {
  const { data } = await api.post(`/lines/${lineId}/reorder-devices/`, { order: orderedIds })
  return data
}
export async function getDeviceTemplates(): Promise<{ id: number; name: string }[]> {
  try {
    const { data } = await api.get('/device-templates/')
    return Array.isArray(data) ? data : data.results ?? []
  } catch { return [] }
}
export async function getLineTemplates(): Promise<{ id: number; name: string }[]> {
  try {
    const { data } = await api.get('/production-line-templates/')
    return Array.isArray(data) ? data : data.results ?? []
  } catch { return [] }
}
export async function createLine(payload: { factory: number; name: string; description?: string; line_type?: string; template: number }) {
  const { data } = await api.post('/production-lines/', payload)
  return data
}
export async function updateLine(id: number, payload: Partial<{ name: string; description: string; line_type: string; template: number }>) {
  const { data } = await api.patch(`/production-lines/${id}/`, payload)
  return data
}
export async function deleteLine(id: number) {
  const { data } = await api.delete(`/production-lines/${id}/`)
  return data
}
