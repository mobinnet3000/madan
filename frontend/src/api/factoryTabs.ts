import { api } from './client'
import { fetchPaginated, fetchAll } from './base'
import type {
  FactoryTabBrief,
  FactoryTabFull,
  FactoryTabRecord,
  FactoryTabRecordFilters,
  FactoryTabRecordPayload,
  FactoryTabReport,
  FactoryTabReportPayload,
  FactoryTabReportRun,
  FactoryTabReportTypes,
  FactoryTabSchema,
  FactoryTabWidget,
} from '../types'

export const getFactoryTabs = (filters: { factory?: number; active?: number } = {}) =>
  api.get<FactoryTabFull[]>('/factory-tabs/', { params: filters }).then((r) => r.data)

export const createFactoryTab = (payload: Record<string, unknown>) =>
  api.post<FactoryTabFull>('/factory-tabs/', payload).then((r) => r.data)

export const updateFactoryTab = (id: number, payload: Record<string, unknown>) =>
  api.patch<FactoryTabFull>(`/factory-tabs/${id}/`, payload).then((r) => r.data)

export const deleteFactoryTab = (id: number) =>
  api.delete(`/factory-tabs/${id}/`)

export function getFactoryTabSchema(tabId: number) {
  return api.get<FactoryTabSchema>(`/factory-tabs/${tabId}/schema/`).then((r) => r.data)
}

export function validateTabFormula(tabId: number, expression: string) {
  return api
    .post<{ ok: boolean; errors: string[] }>('/formula/validate-tab/', {
      tab_id: tabId,
      expression,
    })
    .then((r) => r.data)
}

export const getFactoryTabRecords = (filters: FactoryTabRecordFilters = {}, page = 1, pageSize = 30) =>
  fetchPaginated<FactoryTabRecord>('/factory-tab-records/', filters as unknown as Record<string, unknown>, page, pageSize)

export const fetchAllFactoryTabRecords = (filters: FactoryTabRecordFilters = {}, pageSize = 500) =>
  fetchAll<FactoryTabRecord>('/factory-tab-records/', filters as unknown as Record<string, unknown>, pageSize)

export const createFactoryTabRecord = (payload: FactoryTabRecordPayload) =>
  api.post<FactoryTabRecord>('/factory-tab-records/', payload).then((r) => r.data)

export const updateFactoryTabRecord = (id: number, payload: FactoryTabRecordPayload) =>
  api.patch<FactoryTabRecord>(`/factory-tab-records/${id}/`, payload).then((r) => r.data)

export const deleteFactoryTabRecord = (id: number) =>
  api.delete(`/factory-tab-records/${id}/`)

export const getFactoryTabReports = (filters: { tab?: number; active?: number } = {}) =>
  api.get<FactoryTabReport[]>('/factory-tab-reports/', { params: filters }).then((r) => r.data)

export const createFactoryTabReport = (payload: FactoryTabReportPayload) =>
  api.post<FactoryTabReport>('/factory-tab-reports/', payload).then((r) => r.data)

export const updateFactoryTabReport = (id: number, payload: Partial<FactoryTabReportPayload>) =>
  api.patch<FactoryTabReport>(`/factory-tab-reports/${id}/`, payload).then((r) => r.data)

export const deleteFactoryTabReport = (id: number) =>
  api.delete(`/factory-tab-reports/${id}/`)

export const createFactoryTabWidget = (reportId: number, payload: Record<string, unknown>) =>
  api.post<FactoryTabWidget>(`/factory-tab-reports/${reportId}/widgets/`, payload).then((r) => r.data)

export const updateFactoryTabWidget = (reportId: number, widgetId: number, payload: Record<string, unknown>) =>
  api.patch<FactoryTabWidget>(`/factory-tab-reports/${reportId}/widgets/${widgetId}/`, payload).then((r) => r.data)

export const deleteFactoryTabWidget = (reportId: number, widgetId: number) =>
  api.delete(`/factory-tab-reports/${reportId}/widgets/${widgetId}/`)

export function runFactoryTabReport(reportId: number, params: Record<string, unknown> = {}) {
  return api.get<FactoryTabReportRun>(`/factory-tab-reports/${reportId}/run/`, { params }).then((r) => r.data)
}

export function getFactoryTabReportTypes() {
  return api.get<FactoryTabReportTypes>('/factory-tab-reports/types/').then((r) => r.data)
}
