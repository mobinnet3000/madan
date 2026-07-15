import { api } from './client'
import type { Factory } from '../types'

export async function getFactories(): Promise<Factory[]> {
  const { data } = await api.get<Factory[]>('/factory-setup/')
  return data
}

export async function getFactory(id: number): Promise<Factory> {
  const { data } = await api.get<Factory>(`/factory-setup/${id}/`)
  return data
}
