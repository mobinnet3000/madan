import { esc, fmtCell, emptyStateHtml } from '../../../utils/pdf/helpers'
import type { PdfColumnDef, PdfTableConfig } from '../../../utils/pdf/types'

export function tableStriped<T extends Record<string, unknown>>(cfg: PdfTableConfig<T>): string {
  return renderTable({ ...cfg, variant: 'striped', striped: true, bordered: false } as PdfTableConfig<T>)
}
export function tableBordered<T extends Record<string, unknown>>(cfg: PdfTableConfig<T>): string {
  return renderTable({ ...cfg, variant: 'bordered', striped: false, bordered: true } as PdfTableConfig<T>)
}
export function tableCompact<T extends Record<string, unknown>>(cfg: PdfTableConfig<T>): string {
  return renderTable({ ...cfg, variant: 'compact', striped: true, bordered: true } as PdfTableConfig<T>)
}
export function tableGrid<T extends Record<string, unknown>>(cfg: PdfTableConfig<T>): string {
  return renderTable({ ...cfg, variant: 'grid', striped: false, bordered: true } as PdfTableConfig<T>)
}

export function renderTable<T extends Record<string, unknown>>(cfg: PdfTableConfig<T>): string {
  const rows = (cfg.rows ?? []) as T[]
  if (!rows.length) return `<div class="pdf-table-wrap">${emptyStateHtml('داده‌ای وجود ندارد', cfg.emptyText ?? 'جدول خالی است.')}</div>`
  const showNumbers = cfg.showRowNumbers
  const headerCells = [
    ...(showNumbers ? ['<th style="width:36px">#</th>'] : []),
    ...cfg.columns.map((c: PdfColumnDef<T>) => `<th style="${c.width ? `width:${esc(c.width)};` : ''}${c.align ? `text-align:${esc(c.align)};` : ''}">${esc(c.header)}</th>`),
  ].join('')
  const bodyRows = rows.slice(0, cfg.maxRows ?? 1200).map((r, idx) => {
    const cells = cfg.columns.map((c) => {
      const raw = (r as Record<string, unknown>)[c.key]
      const val = c.format ? c.format(raw, r) : fmtCell(raw)
      return `<td style="${c.align ? `text-align:${esc(c.align)};` : ''}">${val}</td>`
    }).join('')
    return `<tr>${showNumbers ? `<td>${idx + 1}</td>` : ''}${cells}</tr>`
  }).join('')
  const variantClass = cfg.variant ?? 'striped'
  return `<div class="pdf-table-wrap"><table class="pdf-table ${esc(variantClass)}"><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table></div>`
}

export function columnsFromRows(rows: Record<string, unknown>[]): PdfColumnDef[] {
  if (!rows.length) return []
  return Object.keys(rows[0]).map((k) => ({ key: k, header: k, align: 'center' as const }))
}

export function simpleTableHtml(headers: string[], rows: (string | number)[][]): string {
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join('')
  const tr = rows.map((r) => `<tr>${r.map((v) => `<td>${fmtCell(v)}</td>`).join('')}</tr>`).join('')
  return `<div class="pdf-table-wrap"><table class="pdf-table striped"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`
}
