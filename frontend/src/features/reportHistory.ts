import type { ExportFormat } from '../utils/exports'

export type ReportKind = 'downtime' | 'production' | 'tonnage' | 'performance' | 'general'

export interface ReportHistoryEntry {
  id: string
  createdAt: string
  createdAtJalali: string
  kind: ReportKind
  kindLabel: string
  factoryName: string
  fileName: string
  title: string
  format: ExportFormat
  recordCount: number
  dateFrom?: string
  dateTo?: string
  chips: { label: string; value: string }[]
  filters: Record<string, string>
}

const STORAGE_KEY = 'madan_report_history'
const MAX_ENTRIES = 120

const KIND_LABEL: Record<ReportKind, string> = {
  downtime: 'توقفات خط تولید',
  production: 'ریز عملکرد خطوط تولید',
  tonnage: 'تناژ تحویلی',
  performance: 'عملکرد بخش تولید',
  general: 'گزارش کلی',
}

export function kindLabel(kind: ReportKind): string {
  return KIND_LABEL[kind] ?? kind
}

function safeJsonParse(raw: string | null): ReportHistoryEntry[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr as ReportHistoryEntry[] : []
  } catch { return [] }
}

export function getReportHistory(): ReportHistoryEntry[] {
  try { return safeJsonParse(localStorage.getItem(STORAGE_KEY)) } catch { return [] }
}

export function clearReportHistory(): void {
  try { localStorage.removeItem(STORAGE_KEY); window.dispatchEvent(new Event('madan:report-history')) } catch {}
}

export function removeReportHistoryEntry(id: string): void {
  try {
    const next = getReportHistory().filter(e => e.id !== id)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('madan:report-history'))
  } catch {}
}

export interface AddEntryInput {
  kind: ReportKind
  factoryName?: string
  fileName: string
  title: string
  format: ExportFormat
  recordCount: number
  dateFrom?: string
  dateTo?: string
  chips?: { label: string; value: string }[]
  filters?: Record<string, unknown>
}

function nowJalali(): string {
  try { return new Date().toLocaleString('fa-IR') } catch { return new Date().toISOString() }
}

function filtersToRecord(filters?: Record<string, unknown>): Record<string, string> {
  if (!filters) return {}
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(filters)) {
    if (v === undefined || v === null || v === '') continue
    out[k] = String(v)
  }
  return out
}

export function addReportHistoryEntry(input: AddEntryInput): ReportHistoryEntry {
  const entry: ReportHistoryEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    createdAt: new Date().toISOString(),
    createdAtJalali: nowJalali(),
    kind: input.kind,
    kindLabel: kindLabel(input.kind),
    factoryName: input.factoryName || '—',
    fileName: input.fileName,
    title: input.title,
    format: input.format,
    recordCount: input.recordCount ?? 0,
    dateFrom: input.dateFrom || undefined,
    dateTo: input.dateTo || undefined,
    chips: (input.chips ?? []).slice(0, 12),
    filters: filtersToRecord(input.filters),
  }
  try {
    const prev = getReportHistory()
    const next = [entry, ...prev].slice(0, MAX_ENTRIES)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    window.dispatchEvent(new Event('madan:report-history'))
  } catch {}
  return entry
}

export function exportHistoryAsJson(): void {
  const data = getReportHistory()
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `سابقه_گزارش‌ها_${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const REPORT_HISTORY_EVENT = 'madan:report-history'
