import { api } from './client'
import type { Shift } from '../types'
export const getShifts = (line?: number) => api.get<Shift[]>('/shifts/', { params: line ? { line } : {} }).then(r => r.data)
export const createShift = (payload: { line: number; name: string; start_time: string; end_time: string; is_active?: boolean }) => api.post<Shift>('/shifts/', payload).then(r => r.data)
export const updateShift = (id: number, payload: Partial<{ line: number; name: string; start_time: string; end_time: string; is_active: boolean }>) => api.patch<Shift>(`/shifts/${id}/`, payload).then(r => r.data)
export const deleteShift = (id: number) => api.delete(`/shifts/${id}/`)
