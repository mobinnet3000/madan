import { esc, todayFa } from '../../../utils/pdf/helpers'
import type { PdfBranding } from '../../../utils/pdf/types'

export type HeaderVariant = 'standard' | 'minimal' | 'branded' | 'detailed'

export interface HeaderCtx {
  title: string
  subtitle?: string
  branding: PdfBranding
  variant: HeaderVariant
  meta?: string
  dateLabel?: string
  height?: string
}

export function headerStandard(ctx: HeaderCtx): string {
  return `<header class="pdf-header" style="${ctx.height ? `height:${ctx.height};` : ''}">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="width:28px;height:28px;border-radius:6px;background:#fff;color:${esc(ctx.branding.primaryColor ?? '#1e3a5f')};display:flex;align-items:center;justify-content:center;font-weight:800">M</div>
      <div><div style="font-size:10px;font-weight:800">${esc(ctx.title)}</div>${ctx.subtitle ? `<div style="font-size:7px;opacity:.85">${esc(ctx.subtitle)}</div>` : ''}</div>
    </div>
    <div style="text-align:left;font-size:7px;opacity:.9">${esc(ctx.dateLabel ?? 'تاریخ')}: ${esc(todayFa())}${ctx.meta ? `<div>${esc(ctx.meta)}</div>` : ''}</div>
  </header>`
}

export function headerMinimal(ctx: HeaderCtx): string {
  return `<header class="pdf-header" style="height:${ctx.height ?? '18mm'};background:#0f172a">
    <div style="font-size:9px;font-weight:700">${esc(ctx.title)}</div>
    <div style="font-size:7px;opacity:.8">${esc(todayFa())}</div>
  </header>`
}

export function headerBranded(ctx: HeaderCtx): string {
  const b = ctx.branding
  return `<header class="pdf-header" style="${ctx.height ? `height:${ctx.height};` : ''}">
    <div style="display:flex;align-items:center;gap:10px">
      ${b.logoUrl ? `<img src="${esc(b.logoUrl)}" alt="logo" style="width:28px;height:28px;object-fit:contain;background:#fff;border-radius:6px;padding:2px" />` : `<div style="width:28px;height:28px;border-radius:6px;background:#fff;color:${esc(b.primaryColor ?? '#1e3a5f')};display:flex;align-items:center;justify-content:center;font-weight:800">M</div>`}
      <div>
        <div style="font-size:10px;font-weight:800;line-height:1">${esc(ctx.title)}</div>
        ${ctx.subtitle ? `<div style="font-size:7px;opacity:.85">${esc(ctx.subtitle)}</div>` : ''}
        ${b.factoryName ? `<div style="font-size:6.5px;opacity:.75">${esc(b.factoryName)}${b.factoryAddress ? ` — ${esc(b.factoryAddress)}` : ''}</div>` : ''}
      </div>
    </div>
    <div style="text-align:left;font-size:7px;opacity:.9"><div>${esc(ctx.dateLabel ?? 'تاریخ چاپ')}: ${esc(todayFa())}</div>${ctx.meta ? `<div>${esc(ctx.meta)}</div>` : ''}</div>
  </header>`
}

export function headerDetailed(ctx: HeaderCtx): string {
  return `${headerBranded(ctx)}<div style="position:fixed;top:${ctx.height ?? '26mm'};left:0;right:0;height:6mm;background:#f1f5f9;border-bottom:1px solid #cbd5e1;display:flex;align-items:center;justify-content:space-between;padding:0 14px;font-size:6.5px;color:#64748b"><span>${esc(ctx.branding.factoryName ?? '')}</span><span>${esc(ctx.subtitle ?? '')}</span></div>`
}

export function renderHeader(ctx: HeaderCtx): string {
  switch (ctx.variant) {
    case 'minimal': return headerMinimal(ctx)
    case 'detailed': return headerDetailed(ctx)
    case 'standard': return headerStandard(ctx)
    case 'branded':
    default: return headerBranded(ctx)
  }
}

export const HEADER_HEIGHT: Record<HeaderVariant, string> = { standard: '26mm', minimal: '18mm', branded: '26mm', detailed: '32mm' }
