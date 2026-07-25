import { useState, useEffect, useCallback, useRef } from 'react'
import { fetchPaginated } from '../api/base'

interface UsePaginatedFetchResult<T> {
  data: T[]
  loading: boolean
  error: string | null
  page: number
  totalCount: number
  totalPages: number
  goToPage: (p: number) => void
  reload: () => void
  setFilters: (f: Record<string, unknown>) => void
}

export function usePaginatedFetch<T>(
  url: string,
  initialFilters: Record<string, unknown> = {},
  pageSize = 30,
): UsePaginatedFetchResult<T> {
  const [data, setData] = useState<T[]>([])
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filters, setFilters] = useState(initialFilters)
  const filtersRef = useRef(filters)
  const activeRef = useRef(true)

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))

  const load = useCallback(async (p: number, f: Record<string, unknown>) => {
    setLoading(true)
    try {
      const res = await fetchPaginated<T>(url, f, p, pageSize)
      if (!activeRef.current) return
      setData(res.results)
      setTotalCount(res.count)
      setError(null)
    } catch (e: any) {
      if (activeRef.current) setError(e.message)
    } finally {
      if (activeRef.current) setLoading(false)
    }
  }, [url, pageSize])

  useEffect(() => {
    activeRef.current = true
    const filtersChanged = JSON.stringify(filters) !== JSON.stringify(filtersRef.current)
    if (filtersChanged) {
      filtersRef.current = filters
      setPage(1)
      load(1, filters)
    } else {
      load(page, filters)
    }
    return () => { activeRef.current = false }
  }, [page, filters, load])

  const goToPage = useCallback((p: number) => {
    if (p >= 1 && p <= totalPages) setPage(p)
  }, [totalPages])

  const reload = useCallback(() => load(page, filters), [load, page, filters])

  return { data, loading, error, page, totalCount, totalPages, goToPage, reload, setFilters }
}
