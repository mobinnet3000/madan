import { useCallback, useEffect, useMemo, useState } from 'react'
import { useFactory } from '../../store/FactoryContext'
import { fetchAllLogs } from '../../api/logs'
import type { DeviceLog, LogFilters } from '../../types'
import { defaultFilters, presetBounds, type ReportFilters, type SortDir, type SortKey, type PresetKey } from './reportFilters'

export interface UseReportStateReturn {
  filters: ReportFilters
  setFilters: React.Dispatch<React.SetStateAction<ReportFilters>>
  setFilter: (k: keyof ReportFilters, v: string) => void
  setSearch: (v: string) => void
  setSort: (k: SortKey, dir?: SortDir) => void
  applyPreset: (key: PresetKey) => void
  logs: DeviceLog[]
  filtered: DeviceLog[]
  sorted: DeviceLog[]
  paginated: DeviceLog[]
  loading: boolean
  error: string | null
  page: number
  setPage: (n: number) => void
  pageSize: number
  setPageSize: (n: number) => void
  totalCount: number
  totalPages: number
  reload: () => Promise<void>
  chips: { label: string; value: string; onRemove: () => void }[]
  hasActiveFilters: boolean
  clearFilters: () => void
}

export function useReportState(initial?: Partial<ReportFilters>, pageSizeInit = 30): UseReportStateReturn {
  const { selectedFactory } = useFactory()
  const lineIds = useMemo(() => (selectedFactory?.lines ?? []).map((l) => l.id), [selectedFactory])
  const [filters, setFilters] = useState<ReportFilters>(() => ({ ...defaultFilters(), ...initial }))
  const [logs, setLogs] = useState<DeviceLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(pageSizeInit)

  const reload = useCallback(async () => {
    if (!selectedFactory) return
    setLoading(true)
    try {
      const q: LogFilters = {
        ...(filters.date_from ? { date_from: filters.date_from } : {}),
        ...(filters.date_to ? { date_to: filters.date_to } : {}),
        line: filters.line ? Number(filters.line) : undefined,
        shift: filters.shift ? Number(filters.shift) : undefined,
        device: filters.device ? Number(filters.device) : undefined,
        failure_cause: filters.failure_cause ? Number(filters.failure_cause) : undefined,
        lines: lineIds.length ? lineIds.join(',') : undefined,
      } as LogFilters
      const data = await fetchAllLogs(q, 200)
      const scoped = data.filter((l) => !lineIds.length || lineIds.includes(l.line.id))
      setLogs(scoped)
      setError(null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [selectedFactory, filters.date_from, filters.date_to, filters.line, filters.shift, filters.device, filters.failure_cause, lineIds])

  useEffect(() => {
    reload()
  }, [reload])

  useEffect(() => {
    setPage(1)
  }, [filters.date_from, filters.date_to, filters.line, filters.shift, filters.device, filters.failure_cause, filters.search, filters.sortKey, filters.sortDir])

  const filtered = useMemo(() => {
    const q = filters.search.trim().toLowerCase()
    if (!q) return logs
    return logs.filter((l) => {
      const hay = [l.line?.name, l.shift?.name, l.device?.name, l.failure_cause?.title, l.failure_description, l.repair_description, l.date].join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [logs, filters.search])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    const dir = filters.sortDir === 'asc' ? 1 : -1
    arr.sort((a, b) => {
      switch (filters.sortKey) {
        case 'downtime':
          return (a.downtime_hours - b.downtime_hours) * dir
        case 'runtime':
          return (a.runtime_hours - b.runtime_hours) * dir
        case 'line':
          return (a.line?.name ?? '').localeCompare(b.line?.name ?? '') * dir
        case 'efficiency':
          return ((a.efficiency ?? -1) - (b.efficiency ?? -1)) * dir
        case 'date':
        default:
          return (a.date.localeCompare(b.date) * dir * -1)
      }
    })
    if (filters.sortKey === 'date' && filters.sortDir === 'desc') {
      arr.sort((a, b) => b.date.localeCompare(a.date))
    }
    if (filters.sortKey === 'date' && filters.sortDir === 'asc') {
      arr.sort((a, b) => a.date.localeCompare(b.date))
    }
    return arr
  }, [filtered, filters.sortKey, filters.sortDir])

  const totalCount = sorted.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const paginated = useMemo(() => sorted.slice((page - 1) * pageSize, page * pageSize), [sorted, page, pageSize])

  const setFilter = useCallback((k: keyof ReportFilters, v: string) => {
    setFilters((prev) => ({ ...prev, [k]: v === '' ? undefined : (v as unknown as ReportFilters[typeof k]) }))
  }, [])

  const setSearch = useCallback((v: string) => setFilters((p) => ({ ...p, search: v })), [])
  const setSort = useCallback((k: SortKey, dir?: SortDir) => {
    setFilters((p) => ({ ...p, sortKey: k, sortDir: dir ?? (p.sortKey === k && p.sortDir === 'desc' ? 'asc' : 'desc') }))
  }, [])
  const applyPreset = useCallback((key: PresetKey) => {
    if (key === 'custom') return
    const [f, t] = presetBounds(key)
    setFilters((p) => ({ ...p, date_from: f, date_to: t }))
  }, [])
  const clearFilters = useCallback(() => setFilters(defaultFilters()), [])

  const chips = useMemo(() => {
    const c: { label: string; value: string; onRemove: () => void }[] = []
    if (filters.line) c.push({ label: 'خط', value: filters.line, onRemove: () => setFilter('line', '') })
    if (filters.shift) c.push({ label: 'شیفت', value: filters.shift, onRemove: () => setFilter('shift', '') })
    if (filters.device) c.push({ label: 'دستگاه', value: filters.device, onRemove: () => setFilter('device', '') })
    if (filters.failure_cause) c.push({ label: 'علت', value: filters.failure_cause, onRemove: () => setFilter('failure_cause', '') })
    if (filters.search) c.push({ label: 'جستجو', value: filters.search, onRemove: () => setSearch('') })
    return c
  }, [filters.line, filters.shift, filters.device, filters.failure_cause, filters.search, setFilter, setSearch])

  const hasActiveFilters = chips.length > 0 || filters.date_from !== defaultFilters().date_from || filters.date_to !== defaultFilters().date_to

  return { filters, setFilters, setFilter, setSearch, setSort, applyPreset, logs, filtered, sorted, paginated, loading, error, page, setPage, pageSize, setPageSize, totalCount, totalPages, reload, chips, hasActiveFilters, clearFilters }
}
