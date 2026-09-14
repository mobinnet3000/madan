import { esc } from './helpers'
import type { PdfCoverConfig } from './types'

export function renderCoverHtml(cover: PdfCoverConfig): string {
  return `<section class="pdf-cover">
    ${cover.logoUrl ? `<img src="${esc(cover.logoUrl)}" alt="logo" style="width:64px;height:64px;object-fit:contain;margin:0 auto 10px;display:block" />` : ''}
    <div class="pdf-cover-title">${esc(cover.title)}</div>
    ${cover.subtitle ? `<div class="pdf-cover-sub">${esc(cover.subtitle)}</div>` : ''}
    <div class="pdf-cover-meta"><div>${esc(cover.factoryName)}</div><div>${esc(cover.dateFrom ?? '')} تا ${esc(cover.dateTo ?? '')}</div><div>${esc(cover.generatedAt)}</div></div>
  </section>`
}
