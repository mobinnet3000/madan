import { api } from './client'
import { fetchPaginated, fetchAll } from './base'
import type {
  DeliveredTonnage,
  DeliveredTonnagePayload,
  DeliveredTonnageFilters,
  TonnageSchema,
} from '../types'

export const getDeliveredTonnages = (filters: DeliveredTonnageFilters = {}, page = 1, pageSize = 30) =>
  fetchPaginated<DeliveredTonnage>('/delivered-tonnages/', filters as unknown as Record<string, unknown>, page, pageSize)

export const fetchAllDeliveredTonnages = (filters: DeliveredTonnageFilters = {}, pageSize = 500) =>
  fetchAll<DeliveredTonnage>('/delivered-tonnages/', filters as unknown as Record<string, unknown>, pageSize)

export const createDeliveredTonnage = (payload: DeliveredTonnagePayload) =>
  api.post<DeliveredTonnage>('/delivered-tonnages/', payload).then((r) => r.data)

export const updateDeliveredTonnage = (id: number, payload: DeliveredTonnagePayload) =>
  api.patch<DeliveredTonnage>(`/delivered-tonnages/${id}/`, payload).then((r) => r.data)

export const deleteDeliveredTonnage = (id: number) =>
  api.delete(`/delivered-tonnages/${id}/`)

export function getTonnageSchema(lineId: number) {
  return api.get<TonnageSchema>('/tonnage/definition/schema/', { params: { line: lineId } }).then((r) => r.data)
}
