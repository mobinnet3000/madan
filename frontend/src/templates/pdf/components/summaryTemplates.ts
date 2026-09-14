import { esc, summaryGridHtml, badgeHtml, sectionTitleHtml } from '../../../utils/pdf/helpers'

export interface SummaryItem { label: string; value: string | number; variant?: 'success' | 'warning' | 'danger' | 'neutral' }
export interface SummaryCtx { title?: string; subtitle?: string; items: SummaryItem[]; columns?: number; showBadges?: boolean }

export function summaryGrid(ctx: SummaryCtx): string {
  const title = ctx.title ? sectionTitleHtml(ctx.title, ctx.subtitle) : ''
  const cols = Math.max(1, Math.min(4, ctx.columns ?? 3))
  const grid = `<div class="pdf-summary-grid cols-${cols}">${ctx.items.map((it) => `<div class="pdf-summary-item"><span class="pdf-summary-label">${esc(it.label)}</span><span class="pdf-summary-value">${esc(String(it.value))} ${it.variant && ctx.showBadges ? badgeHtml(it.variant, it.variant) : ''}</span></div>`).join('')}</div>`
  return `<section class="pdf-section">${title}${grid}</section>`
}

export function summaryInline(ctx: SummaryCtx): string {
  const rows = ctx.items.map((it) => `<tr><td style="font-size:8px;color:#64748b;padding:4px 8px">${esc(it.label)}</td><td style="font-size:8px;font-weight:700;padding:4px 8px">${esc(String(it.value))}</td></tr>`).join('')
  return `<section class="pdf-section">${ctx.title ? sectionTitleHtml(ctx.title, ctx.subtitle) : ''}<table class="pdf-table" style="border:1px solid #cbd5e1;border-radius:8px;overflow:hidden"><tbody>${rows}</tbody></table></section>`
}

export function summaryKpi(ctx: SummaryCtx): string {
  return summaryGrid({ ...ctx, columns: ctx.columns ?? 4 })
}

export function renderSummary(ctx: SummaryCtx, variant: 'grid' | 'inline' | 'kpi' = 'grid'): string {
  switch (variant) {
    case 'inline': return summaryInline(ctx)
    case 'kpi': return summaryKpi(ctx)
    default: return summaryGrid(ctx)
  }
}

export function summaryHtml(items: SummaryItem[], columns = 3): string {
  return summaryGridHtml(items.map((i) => ({ label: i.label, value: i.value })), columns)
}
