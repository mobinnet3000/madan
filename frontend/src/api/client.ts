import axios from 'axios'

export const TOKEN_KEY = 'madan_token'

// در حالت توسعه (Vite proxy) به /api هدایت می‌شه
// در حالت production از متغیر محیطی VITE_API_BASE_URL استفاده کن
const BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api'

export const api = axios.create({
  baseURL: BASE,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
})

// الصاق توکن به همه درخواست‌ها
api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY)
  if (token) {
    config.headers = config.headers ?? {}
    config.headers.Authorization = `Token ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
    }
    const message =
      error.response?.data?.detail ||
      error.response?.data?.non_field_errors?.join(' ') ||
      (typeof error.response?.data === 'object'
        ? Object.values(error.response.data).flat().join(' ')
        : null) ||
      error.message ||
      'خطا در ارتباط با سرور'
    return Promise.reject(new Error(message))
  },
)
