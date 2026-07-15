import axios from 'axios'

export const TOKEN_KEY = 'madan_token'

// نمونه پایه axios - با پروکسی vite درخواست‌ها به بک‌اند ارسال می‌شوند
export const api = axios.create({
  baseURL: '/api',
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
