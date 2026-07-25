import { api } from './client'

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export function buildQuery(filters: Record<string, any>): Record<string, string | number> {
  const q: Record<string, string | number> = {}
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') q[k] = v
  })
  return q
}

export async function fetchPaginated<T>(
  url: string,
  filters: Record<string, any> = {},
  page = 1,
  pageSize = 30,
): Promise<PaginatedResponse<T>> {
  const { data } = await api.get<PaginatedResponse<T>>(url, {
    params: { ...buildQuery(filters), page, page_size: pageSize },
  })
  return data
}

export async function fetchAll<T>(
  url: string,
  filters: Record<string, any> = {},
  pageSize = 200,
  onChunk?: (chunk: T[], loaded: number, total: number) => void,
): Promise<T[]> {
  const first = await fetchPaginated<T>(url, filters, 1, pageSize)
  let all = [...first.results]
  onChunk?.(first.results, all.length, first.count)
  const totalPages = Math.max(1, Math.ceil(first.count / pageSize))
  for (let page = 2; page <= totalPages; page++) {
    const next = await fetchPaginated<T>(url, filters, page, pageSize)
    all = all.concat(next.results)
    onChunk?.(next.results, all.length, next.count)
  }
  return all
}

export function createApi<T, P>(basePath: string) {
  return {
    list: (filters: Record<string, any> = {}) =>
      api.get<T[]>(basePath, { params: buildQuery(filters) }).then(r => r.data),

    listPage: (filters: Record<string, any> = {}, page = 1, pageSize = 30) =>
      fetchPaginated<T>(basePath, filters, page, pageSize),

    fetchAll: (filters: Record<string, any> = {}, pageSize = 200, onChunk?: (chunk: T[], loaded: number, total: number) => void) =>
      fetchAll<T>(basePath, filters, pageSize, onChunk),

    create: (payload: P) =>
      api.post<T>(basePath, payload).then(r => r.data),

    update: (id: number, payload: Partial<P>) =>
      api.patch<T>(`${basePath}${id}/`, payload).then(r => r.data),

    delete: (id: number) =>
      api.delete(`${basePath}${id}/`),
  }
}
