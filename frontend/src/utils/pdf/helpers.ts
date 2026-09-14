import { formatDate, formatNumber, formatPercent } from '../../utils'
import type { AppliedFilterChip, PdfKpiCard } from './types'
export function esc(s: string): string {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}
export function escAttr(s: string): string {
  return esc(s).replace(/\n/g, ' ')
}
export function toPersianDigits(input: string | number): string {
  const map: Record<string, string> = { '0': '۰', '1': '۱', '2': '۲', '3': '۳', '4': '۴', '5': '۵', '6': '۶', '7': '۷', '8': '۸', '9': '۹' }
  return String(input).replace(/[0-9]/g, (d) => map[d] ?? d)
}
export function fmtNum(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return esc(String(v))
  return esc(formatNumber(n))
}
export function fmtPercent(v: unknown): string {
  if (v == null || v === '') return '—'
  const n = typeof v === 'number' ? v : Number(v)
  if (Number.isNaN(n)) return '—'
  return esc(formatPercent(n))
}
export function fmtDate(v: unknown): string {
  if (!v) return '—'
  return esc(formatDate(String(v)))
}
export function fmtCell(v: unknown): string {
  if (v == null || v === '' || v === '—') return '—'
  if (typeof v === 'number') return fmtNum(v)
  const s = String(v).trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return fmtDate(s)
  return esc(s)
}
export function chipHtml(chip: AppliedFilterChip): string {
  return `<span class="pdf-chip"><span class="pdf-chip-label">${esc(chip.label)}:</span> ${esc(chip.value)}</span>`
}
export function chipsHtml(chips: AppliedFilterChip[]): string {
  if (!chips.length) return '<span class="pdf-chip pdf-chip-empty">بدون فیلتر</span>'
  return chips.map(chipHtml).join('')
}
export function kpiCardHtml(card: PdfKpiCard): string {
  const trend = card.trend != null ? `<span class="pdf-kpi-trend ${card.trend >= 0 ? 'up' : 'down'}">${card.trend >= 0 ? '▲' : '▼'} ${esc(String(card.trend))}%</span>` : ''
  return `<div class="pdf-kpi-card" style="${card.bg ? `background:${escAttr(card.bg)};` : ''}${card.color ? `border-color:${escAttr(card.color)};` : ''}">
    <div class="pdf-kpi-label">${esc(card.label)}</div>
    <div class="pdf-kpi-value">${esc(card.value)} ${card.suffix ? `<span class="pdf-kpi-suffix">${esc(card.suffix)}</span>` : ''}</div>
    ${trend}
  </div>`
}

export function emptyStateHtml(title: string, desc: string): string {
  return `<div class="pdf-empty"><div class="pdf-empty-title">${esc(title)}</div><div class="pdf-empty-desc">${esc(desc)}</div></div>`
}

export function dividerHtml(): string {
  return '<div class="pdf-divider"></div>'
}

export function sectionTitleHtml(title: string, subtitle?: string): string {
  return `<div class="pdf-section-head"><h3 class="pdf-section-title">${esc(title)}</h3>${subtitle ? `<p class="pdf-section-sub">${esc(subtitle)}</p>` : ''}</div>`
}

export function badgeHtml(text: string, variant: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral'): string {
  return `<span class="pdf-badge pdf-badge-${variant}">${esc(text)}</span>`
}

export function summaryGridHtml(items: { label: string; value: string | number }[], columns = 3): string {
  const cols = Math.max(1, Math.min(4, columns))
  return `<div class="pdf-summary-grid cols-${cols}">${items.map((it) => `<div class="pdf-summary-item"><span class="pdf-summary-label">${esc(it.label)}</span><span class="pdf-summary-value">${esc(String(it.value))}</span></div>`).join('')}</div>`
}

export function cssVar(name: string, value: string): string {
  return `--${name}:${value};`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n))
}

export function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + 'â€¦'
}

export function safeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').trim() || 'report'
}

export function todayFa(): string {
  try {
    return new Date().toLocaleDateString('fa-IR')
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}
