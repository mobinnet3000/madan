import { useState } from 'react'
import { FileText, Eye, Download } from 'lucide-react'
import { buildPdfHtml, previewPdf, printPdf } from '../utils/pdf/renderer'
import { buildDowntimeReport } from '../templates/pdf/reports/downtimeReport'
import { DEFAULT_PAGE, DEFAULT_STYLE } from '../utils/pdf/styles'

export default function PdfTestPage() {
  const [busy, setBusy] = useState(false)
  const sampleRows = [
    { date: '2026-01-10', line: 'خط ۱', shift: 'صبح', device: 'سنگ‌شکن', cause: 'برق', downtime_hours: 2.5, runtime_hours: 5.5, efficiency: 68 },
    { date: '2026-01-11', line: 'خط ۲', shift: 'عصر', device: 'آسیاب', cause: 'مکانیک', downtime_hours: 1, runtime_hours: 7, efficiency: 82 },
    { date: '2026-01-12', line: 'خط ۱', shift: 'شب', device: 'نوار', cause: 'برق', downtime_hours: 3, runtime_hours: 5, efficiency: 42 },
  ]
  const build = () => buildDowntimeReport({ title: 'نمونه گزارش توقفات', factoryName: 'کارخانه نمونه', factoryAddress: '—', dateFrom: '2026-01-10', dateTo: '2026-01-12', rows: sampleRows, chips: [{ label: 'خط', value: 'همه' }, { label: 'بازه', value: '۲۰۲۶/۰۱/۱۰ تا ۲۰۲۶/۰۱/۱۲' }] })

  const onPreview = () => { previewPdf(build()) }
  const onPrint = () => { setBusy(true); printPdf(build()); setTimeout(() => setBusy(false), 800) }
  const onHtml = () => {
    const html = buildPdfHtml(build())
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'pdf-test.html'; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return (
    <div className="space-y-6">
      <div className="card p-5">
        <h1 className="text-lg font-extrabold text-ink-900 dark:text-white">PDF Test Page</h1>
        <p className="text-sm text-ink-500">پیش‌نمایش سیستم PDF با هدر ۲۶mm / فوتر ۱۳mm و @page ثابت</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={onPreview}><Eye className="h-4 w-4" /> پیش‌نمایش</button>
          <button className="btn-ghost" onClick={onPrint} disabled={busy}><FileText className="h-4 w-4" /> چاپ PDF</button>
          <button className="btn-ghost" onClick={onHtml}><Download className="h-4 w-4" /> دانلود HTML</button>
        </div>
      </div>
      <div className="card p-5">
        <h2 className="text-sm font-bold text-ink-700 dark:text-slate-200">نمونه داده</h2>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-ink-50 text-xs text-ink-500"><th className="px-3 py-2">تاریخ</th><th className="px-3 py-2">خط</th><th className="px-3 py-2">توقف</th><th className="px-3 py-2">راندمان</th></tr></thead>
            <tbody>{sampleRows.map((r, i) => <tr key={i} className="border-t"><td className="px-3 py-2">{r.date}</td><td className="px-3 py-2">{r.line}</td><td className="px-3 py-2">{r.downtime_hours}</td><td className="px-3 py-2">{r.efficiency}٪</td></tr>)}</tbody>
          </table>
        </div>
        <div className="mt-4 rounded-lg bg-ink-50 p-3 text-xs text-ink-500 dark:bg-slate-800">Page: {DEFAULT_PAGE.size} {DEFAULT_PAGE.orientation} — header {DEFAULT_PAGE.headerHeight} / footer {DEFAULT_PAGE.footerHeight}</div>
      </div>
    </div>
  )
}
