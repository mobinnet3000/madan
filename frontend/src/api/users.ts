import { api } from './client'
import { fetchPaginated } from './base'
import type { ManagedUser, RoleMatrixData } from '../types'

export interface UserPayload {
  username: string
  password?: string
  first_name?: string
  last_name?: string
  email?: string
  role: string
  factory?: number | null
  phone?: string
  is_active?: boolean
  permissions?: { granted: string[]; denied: string[] }
}

export const getUsersPage = (page = 1, pageSize = 50) =>
  fetchPaginated<ManagedUser>('/users/', {}, page, pageSize)

export const createUser = (payload: UserPayload) =>
  api.post<ManagedUser>('/users/create/', payload).then((r) => r.data)

export const updateUser = (id: number, payload: Partial<UserPayload>) =>
  api.patch<ManagedUser>(`/users/${id}/`, payload).then((r) => r.data)

export const deleteUser = (id: number) =>
  api.delete(`/users/${id}/delete/`)

export const getRoles = () =>
  api.get<RoleMatrixData>('/roles/').then((r) => r.data)

export const updateRoleMatrix = (role: string, enabled: string[]) =>
  api.patch('/roles/update/', { role, enabled }).then((r) => r.data)
