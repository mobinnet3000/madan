import { useState, useCallback } from 'react'
import { defaultFilters, presetBounds, type ReportFilters, type PresetKey } from '../features/reports/reportFilters'

export function useReportFilters(initial?: Partial<ReportFilters>) {
  const [filters, setFilters] = useState<ReportFilters>(() => ({ ...defaultFilters(), ...initial }))
  const applyPreset = useCallback((key: PresetKey) => {
    if (key === 'custom') return
    const [f, t] = presetBounds(key)
    setFilters((p) => ({ ...p, date_from: f, date_to: t }))
  }, [])
  const setFilter = useCallback((k: keyof ReportFilters, v: string) => setFilters((p) => ({ ...p, [k]: v === '' ? undefined : (v as unknown as ReportFilters[typeof k]) })), [])
  const clear = useCallback(() => setFilters(defaultFilters()), [])
  return { filters, setFilters, setFilter, applyPreset, clear }
}
