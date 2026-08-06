import { api } from './client'
import { fetchPaginated, fetchAll } from './base'
import type {
  ProductionReport,
  ProductionReportPayload,
  ProductionReportFilters,
  AttributeDef,
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
