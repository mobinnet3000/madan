import type { PdfPageConfig, PdfStyleConfig } from './types'

export const DEFAULT_STYLE: PdfStyleConfig = {
  fontFamily: "'Vazirmatn', Tahoma, sans-serif",
  fontSize: '7.5px',
  lineHeight: '1.45',
  primaryColor: '#0f2040',
  textColor: '#1e293b',
  borderColor: '#d7deea',
  headerBg: '#0f2040',
  headerColor: '#ffffff',
  kpiBg: '#f8fafc',
  tableStripedBg: '#f3f6fb',
}

export const DEFAULT_PAGE: PdfPageConfig = {
  size: 'A4',
  orientation: 'portrait',
  margins: { top: '0', right: '0', bottom: '0', left: '0' },
  headerHeight: '11mm',
  footerHeight: '7mm',
}

export function buildPageCss(page: PdfPageConfig, style: PdfStyleConfig): string {
  return `
  @page {
    size: ${page.size} ${page.orientation};
    margin: 15mm 8mm 13mm 8mm;
  }
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{height:auto}
  body{
    font-family:${style.fontFamily};
    font-size:${style.fontSize};
    line-height:${style.lineHeight};
    color:${style.textColor};
    direction:rtl;
    background:#e9edf3;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  .pdf-sheet{
    width:210mm;
    min-height:297mm;
    margin:6mm auto;
    padding:8mm;
    background:#fff;
    box-shadow:0 2px 14px rgba(15,32,64,.14);
  }
  .pdf-header{
    height:${page.headerHeight};
    background:linear-gradient(135deg,${style.headerBg} 0%,#1b3a6b 55%,#2c4f82 100%);
    color:${style.headerColor};
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:6px;
    padding:2.2mm 4mm;
    border:1px solid #0b162c;
    border-bottom:2px solid #c9a227;
    border-radius:9px;
    -webkit-print-color-adjust:exact;
    print-color-adjust:exact;
  }
  .pdf-hd-right{display:flex;align-items:center;gap:6px;min-width:0}
  .pdf-logo{width:9mm;height:9mm;border-radius:6px;background:#fff;color:${style.primaryColor};display:flex;align-items:center;justify-content:center;font-weight:800;font-size:10px;flex-shrink:0}
  .pdf-logo img{width:100%;height:100%;object-fit:contain;border-radius:6px}
  .pdf-accent-dot{width:2.4mm;height:2.4mm;border-radius:50%;background:#c9a227;flex-shrink:0}
  .pdf-hd-title{font-size:10px;font-weight:800;line-height:1.2;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pdf-hd-sub{font-size:6px;color:rgba(255,255,255,.92);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:.8mm}
  .pdf-hd-left{display:flex;align-items:center;gap:4px;flex-shrink:0}
  .pdf-hd-date{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:999px;padding:1mm 3.5mm;font-size:6px;white-space:nowrap}
  .pdf-hd-chip{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.25);color:#fff;border-radius:999px;padding:.8mm 3mm;font-size:5.5px;white-space:nowrap;max-width:52mm;overflow:hidden;text-overflow:ellipsis}
  .pdf-footer{
    height:${page.footerHeight};
    background:linear-gradient(180deg,#ffffff 0%,#eef2f8 100%);
    border:1px solid ${style.borderColor};
    border-radius:9px;
    display:flex;
    align-items:center;
    justify-content:space-between;
    gap:6px;
    padding:1.8mm 4mm;
    font-size:6px;
    color:#3c4c63;
  }
  .pdf-ft-right{display:flex;align-items:center;gap:5px;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .pdf-ft-dot{width:1.8mm;height:1.8mm;border-radius:50%;background:${style.primaryColor};flex-shrink:0}
  .pdf-ft-date{color:#8a97ab}
  .pdf-page-pill{background:${style.headerBg};color:#fff;border-radius:999px;padding:1.2mm 4mm;font-size:6.5px;font-weight:800;white-space:nowrap;flex-shrink:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pdf-body{padding:2px 0 4px 0}
  .pdf-bd--table .pdf-section.table-section{margin-bottom:0}
  .pdf-cover{border:1px solid #e2e8f0;border-radius:10px;background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);padding:9px 12px;margin-bottom:7px;text-align:center}
  .pdf-cover-title{font-size:13px;font-weight:800;color:${style.primaryColor};margin-bottom:2px}
  .pdf-cover-sub{font-size:7.5px;color:#475569;margin-bottom:4px}
  .pdf-cover-meta{font-size:6.5px;color:#64748b;line-height:1.8}
  .pdf-section{margin:6px 0}
  .pdf-section.kpi-section,.pdf-section.filter-section{break-inside:avoid;page-break-inside:avoid}
  .pdf-section.chart-section{break-inside:avoid;page-break-inside:avoid}
  .pdf-section.table-section{break-inside:auto;page-break-inside:auto}
  .pdf-section-head{margin-bottom:6px;border-right:3px solid ${style.primaryColor};padding-right:6px}
  .pdf-section-title{font-size:8px;font-weight:800;color:${style.primaryColor}}
  .pdf-section-sub{font-size:6.5px;color:#64748b;margin-top:1px}
  .pdf-divider{height:1px;background:${style.borderColor};margin:6px 0}
  .pdf-kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin:6px 0}
  .pdf-kpi-card{border:1px solid ${style.borderColor};border-radius:8px;padding:6px 5px;background:${style.kpiBg};text-align:center;break-inside:avoid}
  .pdf-kpi-label{font-size:5.5px;color:#64748b;margin-bottom:2px;white-space:nowrap}
  .pdf-kpi-value{font-size:11px;font-weight:800;color:${style.primaryColor};line-height:1.1}
  .pdf-kpi-suffix{font-size:6px;color:#475569}
  .pdf-chip{display:inline-flex;align-items:center;gap:3px;background:#f1f5f9;border:1px solid ${style.borderColor};color:#334155;border-radius:999px;padding:1.5px 6px;font-size:6px;margin:1px;white-space:nowrap}
  .pdf-chip-label{font-weight:700;color:${style.primaryColor}}
  .pdf-chip-wrap{display:flex;flex-wrap:wrap;gap:2px;margin:4px 0}
  .pdf-table-wrap{border:1px solid ${style.borderColor};border-radius:7px;overflow:hidden;margin:6px 0}
  .pdf-table{width:100%;border-collapse:collapse;table-layout:fixed}
  .pdf-table th{background:${style.headerBg};color:${style.headerColor};font-size:6px;font-weight:800;padding:3.5px 4px;text-align:center;white-space:nowrap}
  .pdf-table td{font-size:6px;padding:2.6px 4px;text-align:center;border-top:1px solid #e6ebf2;color:${style.textColor};word-break:break-word;overflow-wrap:anywhere;line-height:1.35}
  .pdf-table thead{display:table-header-group}
  .pdf-table tfoot{display:table-footer-group}
  .pdf-table tr{break-inside:avoid;page-break-inside:avoid}
  .pdf-table tr:nth-child(even) td{background:${style.tableStripedBg}}
  .pdf-empty{border:1px dashed ${style.borderColor};border-radius:8px;padding:12px;text-align:center;background:#f8fafc}
  .pdf-empty-title{font-size:8.5px;font-weight:700;color:${style.primaryColor};margin-bottom:2px}
  .pdf-empty-desc{font-size:6px;color:#64748b}
  .pdf-chart-wrap{border:1px solid ${style.borderColor};border-radius:8px;padding:8px;margin:6px 0;background:#fff;break-inside:avoid}
  .pdf-chart-title{font-size:7.5px;font-weight:800;color:${style.primaryColor};margin-bottom:2px}
  .pdf-chart-sub{font-size:5.5px;color:#94a3b8;margin-bottom:6px}
  .pdf-chart-bars{display:flex;align-items:flex-end;gap:5px;min-height:92px;padding:5px 3px 0;border-radius:6px;background:linear-gradient(180deg,#fbfdff 0%,#f4f7fc 100%);border:1px solid #eef2f8}
  .pdf-chart-legend{display:flex;flex-wrap:wrap;gap:6px;margin-top:5px;font-size:5.5px;color:#64748b}
  .pdf-chart-legend i{width:9px;height:9px;border-radius:3px;display:inline-block}
  @media print{
    html,body{background:#fff !important}
    body{margin:0}
    a{color:inherit;text-decoration:none}
    .pdf-sheet{margin:0;box-shadow:none;border-radius:0;page-break-inside:auto}
    thead{display:table-header-group}
    tfoot{display:table-footer-group}
    tr{break-inside:avoid;page-break-inside:avoid}
  }
`
}

export function themeCssVars(style: PdfStyleConfig): string {
  return `:root{--pdf-primary:${style.primaryColor};--pdf-text:${style.textColor};--pdf-border:${style.borderColor};--pdf-header-bg:${style.headerBg};}`
}

export const PRINT_RESET = `@media print{html,body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}`
