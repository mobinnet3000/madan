import { api, TOKEN_KEY } from './client'
import type { UserProfile } from '../types'

interface LoginResponse {
  token: string
  user: UserProfile
}

export async function login(
  username: string,
  password: string,
): Promise<LoginResponse> {
  const { data } = await api.post<LoginResponse>('/auth/login/', {
    username,
    password,
  })
  localStorage.setItem(TOKEN_KEY, data.token)
  return data
}

export async function fetchMe(): Promise<UserProfile> {
  const { data } = await api.get<UserProfile>('/auth/me/')
  return data
}

export async function logout(): Promise<void> {
  try {
    await api.post('/auth/logout/')
  } finally {
    localStorage.removeItem(TOKEN_KEY)
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}
