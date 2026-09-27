import { api } from './client'
import type { AttributeDef } from '../types'

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
  const { data } = await api.patch(`/devices/${id}/`, fd)
  return data
}
export async function deleteDeviceImage(id: number) {
  const { data } = await api.patch(`/devices/${id}/`, { image: null })
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
