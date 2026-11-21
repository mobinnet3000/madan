import axios from 'axios'

export const TOKEN_KEY = 'madan_token'

// آدرس سرور بک‌اند:
// ۱. قابلیت تنظیم در زمان اجرا بدون نیاز به بیلد مجدد: window.__API_URL__
// ۲. متغیر محیطی بیلد Vite: VITE_API_BASE_URL در فایل .env یا .env.production
// ۳. حالت پیش‌فرض: /api (مناسب Nginx reverse proxy یا Vite dev proxy)
const env = (import.meta as any).env
const runtimeUrl =
  typeof window !== 'undefined'
    ? (window as any).__API_URL__ || (window as any).__APP_CONFIG__?.API_URL
    : undefined
const BASE = runtimeUrl || (env?.PROD && env?.VITE_API_BASE_URL ? env.VITE_API_BASE_URL : '/api')

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
  if (config.data instanceof FormData) {
    delete (config.headers as any)['Content-Type']
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY)
    }
    const data = error.response?.data
    const pick = (v: unknown): string | null => {
      if (typeof v === 'string') return v
      if (Array.isArray(v)) return v.flat().filter(Boolean).join(' ')
      if (v && typeof v === 'object') {
        const inner = Object.values(v)
          .flat()
          .map((x) => (x && typeof x === 'object' ? JSON.stringify(x, null, 0) : x))
          .filter(Boolean)
        return inner.length ? inner.join(' · ') : null
      }
      return v ? String(v) : null
    }
    const message =
      pick(data?.errors) ||
      pick(data?.detail) ||
      pick(data?.non_field_errors) ||
      pick(data) ||
      error.message ||
      'خطا در ارتباط با سرور'
    return Promise.reject(new Error(message))
  },
)
