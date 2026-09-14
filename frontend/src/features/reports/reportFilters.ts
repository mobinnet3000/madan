import { todayISO } from '../../utils'
export const PRESETS = [
  { label: 'امروز', key: 'today' as const },
  { label: 'دیروز', key: 'yesterday' as const },
  { label: 'این هفته', key: 'this_week' as const },
  { label: 'هفته قبل', key: 'last_week' as const },
  { label: 'این ماه', key: 'this_month' as const },
  { label: 'ماه قبل', key: 'last_month' as const },
  { label: 'امسال', key: 'this_year' as const },
  { label: '۷ روز', key: '7days' as const },
  { label: '۳۰ روز', key: '30days' as const },
  { label: '۹۰ روز', key: '90days' as const },
  { label: 'یک سال', key: '365days' as const },
  { label: 'همه', key: 'all' as const },
] as const
export type PresetKey = (typeof PRESETS)[number]['key'] | 'custom'
export function presetBounds(key: string): [string, string] {
  const t = todayISO()
  const d = new Date()
  if (key === 'today') return [t, t]
  if (key === 'yesterday') { const x = new Date(); x.setDate(x.getDate() - 1); const s = x.toISOString().split('T')[0]; return [s, s] }
  if (key === 'this_week') { const x = new Date(d); x.setDate(x.getDate() - d.getDay()); return [x.toISOString().split('T')[0], t] }
  if (key === 'last_week') { const e = new Date(d); e.setDate(e.getDate() - d.getDay() - 1); const s = new Date(e); s.setDate(s.getDate() - 6); return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]] }
  if (key === 'this_month') { const x = new Date(d.getFullYear(), d.getMonth(), 1); return [x.toISOString().split('T')[0], t] }
  if (key === 'last_month') { const e = new Date(d.getFullYear(), d.getMonth(), 0); const s = new Date(e.getFullYear(), e.getMonth(), 1); return [s.toISOString().split('T')[0], e.toISOString().split('T')[0]] }
  if (key === 'this_year') { const x = new Date(d.getFullYear(), 0, 1); return [x.toISOString().split('T')[0], t] }
  if (key === '7days') { const x = new Date(); x.setDate(x.getDate() - 7); return [x.toISOString().split('T')[0], t] }
  if (key === '30days') { const x = new Date(); x.setDate(x.getDate() - 30); return [x.toISOString().split('T')[0], t] }
  if (key === '90days') { const x = new Date(); x.setDate(x.getDate() - 90); return [x.toISOString().split('T')[0], t] }
  if (key === '365days') { const x = new Date(); x.setDate(x.getDate() - 365); return [x.toISOString().split('T')[0], t] }
  if (key === 'all') return ['2020-01-01', t]
  return [t, t]
}
export type SortKey = 'date' | 'downtime' | 'runtime' | 'line' | 'efficiency'
export type SortDir = 'asc' | 'desc'
export interface ReportFilters { date_from: string; date_to: string; line?: string; shift?: string; device?: string; failure_cause?: string; search: string; sortKey: SortKey; sortDir: SortDir }
export function defaultFilters(): ReportFilters { return { date_from: '', date_to: '', search: '', sortKey: 'date', sortDir: 'desc' } }
