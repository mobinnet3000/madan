import { esc, todayFa } from '../../../utils/pdf/helpers'
import type { PdfBranding } from '../../../utils/pdf/types'

export type FooterVariant = 'standard' | 'minimal' | 'detailed' | 'none'

export interface FooterCtx {
  branding: PdfBranding
  variant: FooterVariant
  height?: string
  footnote?: string
  showPageNumbers?: boolean
  showPrintDate?: boolean
  pageText?: string
}

function pageCounter(text?: string): string {
  return `<span class="pdf-page-counter">${text ? esc(text) + ' ' : ''}</span>`
}

export function footerStandard(ctx: FooterCtx): string {
  return `<footer class="pdf-footer" style="${ctx.height ? `height:${ctx.height};` : ''}">
    <span>${ctx.footnote ? esc(ctx.footnote) : esc(ctx.branding.factoryName ?? '')} ${ctx.showPrintDate !== false ? `— ${esc(todayFa())}` : ''}</span>
    <span style="display:flex;gap:10px;align-items:center">${ctx.showPageNumbers !== false ? pageCounter(ctx.pageText) : ''}</span>
  </footer>`
}

export function footerMinimal(ctx: FooterCtx): string {
  return `<footer class="pdf-footer" style="height:${ctx.height ?? '10mm'};font-size:6.5px;opacity:.7">
    <span>${esc(ctx.branding.factoryName ?? '')}</span>
    ${ctx.showPageNumbers !== false ? pageCounter(ctx.pageText) : ''}
  </footer>`
}

export function footerDetailed(ctx: FooterCtx): string {
  return `<footer class="pdf-footer" style="${ctx.height ? `height:${ctx.height};` : ''};flex-direction:column;align-items:stretch;gap:2px;padding:4px 14px">
    <div style="display:flex;justify-content:space-between;width:100%"><span style="font-weight:700">${esc(ctx.branding.factoryName ?? '')}</span><span>${ctx.showPageNumbers !== false ? pageCounter(ctx.pageText) : ''}</span></div>
    <div style="display:flex;justify-content:space-between;width:100%;opacity:.7"><span>${ctx.footnote ? esc(ctx.footnote) : esc(ctx.branding.factoryAddress ?? '')}</span><span>${ctx.showPrintDate !== false ? esc(todayFa()) : ''}</span></div>
  </footer>`
}

export function footerNone(): string { return '' }

export function renderFooter(ctx: FooterCtx): string {
  switch (ctx.variant) {
    case 'minimal': return footerMinimal(ctx)
    case 'detailed': return footerDetailed(ctx)
    case 'none': return footerNone()
    case 'standard':
    default: return footerStandard(ctx)
  }
}

export const FOOTER_HEIGHT: Record<FooterVariant, string> = { standard: '13mm', minimal: '10mm', detailed: '16mm', none: '0mm' }
