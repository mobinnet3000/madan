import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  Plus,
  Trash2,
  Copy,
  CheckCircle2,
  AlertCircle,
  Loader2,
  TableProperties,
  ClipboardPaste,
  Sparkles,
  RotateCcw,
  Layers,
  Wrench,
  Clock,
  Calendar,
  X,
  FileSpreadsheet,
  Download,
  Upload,
  ArrowDown,
  Pin,
  ListFilter,
  Check,
  ChevronDown,
  Info,
  Maximize2,
  Cpu,
  FileText,
  Percent,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { useToast } from '../ui/Toast'
import { useFactory } from '../../store/FactoryContext'
import { createLog } from '../../api/logs'
import type { ProductionLine, Device, FailureReason, Shift, DeviceLogPayload } from '../../types'
import { formatDate, formatNumber, todayISO, round2, classNames, shiftHours, formatHours, parseHoursHM } from '../../utils'

interface Props {
  open: boolean
  onClose: () => void
  onSuccess: () => void
}

interface BulkDowntimeRow {
  id: string
  date: string
  line_id: string
  shift_id: string
  device_id: string
  failure_cause_id: string
  downtime_hours: string // e.g. "1:30" or "1.5"
  failure_description: string
  repair_description: string
  status: 'idle' | 'pending' | 'success' | 'error'
  error?: string
}

let nextId = 1
const genId = () => `dt_row_${Date.now()}_${nextId++}`

export default function BulkDowntimeModal({ open, onClose, onSuccess }: Props) {
  const { notify } = useToast()
  const { selectedFactory } = useFactory()

  const linesList = useMemo(() => selectedFactory?.lines ?? [], [selectedFactory?.lines])
  const failureCausesList = useMemo(() => selectedFactory?.failure_reasons ?? [], [selectedFactory?.failure_reasons])

  // --- Fixed vs Per-Row Settings ---
  // Line
  const [isLineFixed, setIsLineFixed] = useState(true)
  const [fixedLineId, setFixedLineId] = useState<string>('')

  // Shift
  const [isShiftFixed, setIsShiftFixed] = useState(true)
  const [fixedShiftId, setFixedShiftId] = useState<string>('')

  // Date
  const [isDateFixed, setIsDateFixed] = useState(true)
  const [fixedDate, setFixedDate] = useState<string>(todayISO())

  // Cause
  const [isCauseFixed, setIsCauseFixed] = useState(false)
  const [fixedCauseId, setFixedCauseId] = useState<string>('')

  // Set default fixed line & shift when opening
  useEffect(() => {
    if (linesList.length > 0 && !fixedLineId) {
      setFixedLineId(String(linesList[0].id))
    }
  }, [linesList, fixedLineId])

  const selectedFixedLine = useMemo(() => {
    return linesList.find((l) => l.id === Number(fixedLineId))
  }, [linesList, fixedLineId])

  const availableShifts = useMemo(() => {
    if (isLineFixed && selectedFixedLine?.shifts?.length) {
      return selectedFixedLine.shifts
    }
    return selectedFactory?.shifts ?? []
  }, [isLineFixed, selectedFixedLine, selectedFactory?.shifts])

  useEffect(() => {
    if (availableShifts.length > 0 && !fixedShiftId) {
      setFixedShiftId(String(availableShifts[0].id))
    }
  }, [availableShifts, fixedShiftId])

  const createEmptyRow = useCallback(
    (defaultDate = todayISO(), defaultLine = '', defaultShift = '', defaultCause = ''): BulkDowntimeRow => {
      return {
        id: genId(),
        date: isDateFixed && fixedDate ? fixedDate : defaultDate,
        line_id: isLineFixed && fixedLineId ? fixedLineId : defaultLine,
        shift_id: isShiftFixed && fixedShiftId ? fixedShiftId : defaultShift,
        device_id: '',
        failure_cause_id: isCauseFixed && fixedCauseId ? fixedCauseId : defaultCause,
        downtime_hours: '0:30',
        failure_description: '',
        repair_description: '',
        status: 'idle',
      }
    },
    [isDateFixed, fixedDate, isLineFixed, fixedLineId, isShiftFixed, fixedShiftId, isCauseFixed, fixedCauseId]
  )

  const [rows, setRows] = useState<BulkDowntimeRow[]>(() => [createEmptyRow(), createEmptyRow(), createEmptyRow()])
  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Quick Add Rows
  const addRows = (count: number) => {
    const last = rows[rows.length - 1]
    const defDate = isDateFixed && fixedDate ? fixedDate : (last ? last.date : todayISO())
    const defLine = isLineFixed && fixedLineId ? fixedLineId : (last ? last.line_id : (linesList[0]?.id ? String(linesList[0].id) : ''))
    const defShift = isShiftFixed && fixedShiftId ? fixedShiftId : (last ? last.shift_id : (availableShifts[0]?.id ? String(availableShifts[0].id) : ''))
    const defCause = isCauseFixed && fixedCauseId ? fixedCauseId : (last ? last.failure_cause_id : '')

    const newRows: BulkDowntimeRow[] = []
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow(defDate, defLine, defShift, defCause))
    }
    setRows((prev) => [...prev, ...newRows])
  }

  const duplicateRow = (idx: number) => {
    const target = rows[idx]
    if (!target) return
    const duplicated: BulkDowntimeRow = {
      ...target,
      id: genId(),
      status: 'idle',
      error: undefined,
    }
    setRows((prev) => {
      const copy = [...prev]
      copy.splice(idx + 1, 0, duplicated)
      return copy
    })
  }

  const removeRow = (idx: number) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow()])
      return
    }
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const updateRow = (idx: number, patch: Partial<BulkDowntimeRow>) => {
    setRows((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], ...patch }
      return copy
    })
  }

  const copyDownField = (fromIdx: number, field: keyof BulkDowntimeRow) => {
    const sourceVal = rows[fromIdx][field]
    setRows((prev) =>
      prev.map((r, i) => (i <= fromIdx ? r : { ...r, [field]: sourceVal }))
    )
    notify('مقدار این ستون به تمامی ردیف‌های پایین اعمال شد', 'success')
  }

  // Helper to get devices for a specific row
  const getLineDevices = (lineId: string): Device[] => {
    const line = linesList.find((l) => l.id === Number(lineId))
    return line?.devices ?? []
  }

  const getEffectiveLineId = (row: BulkDowntimeRow) => (isLineFixed ? fixedLineId : row.line_id)
  const getEffectiveShiftId = (row: BulkDowntimeRow) => (isShiftFixed ? fixedShiftId : row.shift_id)
  const getEffectiveDate = (row: BulkDowntimeRow) => (isDateFixed ? fixedDate : row.date)
  const getEffectiveCauseId = (row: BulkDowntimeRow) => (isCauseFixed ? fixedCauseId : row.failure_cause_id)

  // Live Summary Calculations
  const stats = useMemo(() => {
    let totalDowntimeMinutes = 0
    let validRowsCount = 0

    rows.forEach((r) => {
      const hours = parseHoursHM(r.downtime_hours)
      totalDowntimeMinutes += hours * 60
      if (hours > 0) validRowsCount++
    })

    const totalHours = totalDowntimeMinutes / 60
    return {
      totalRows: rows.length,
      validRowsCount,
      totalHours,
      formattedTotalHours: formatHours(totalHours),
    }
  }, [rows])

  // Row validation
  const validateRow = (row: BulkDowntimeRow, index: number): string | null => {
    const date = getEffectiveDate(row)
    const line = getEffectiveLineId(row)
    const shift = getEffectiveShiftId(row)
    const downHours = parseHoursHM(row.downtime_hours)

    if (!date) return `ردیف ${index + 1}: تاریخ ثبت الزامی است.`
    if (!line) return `ردیف ${index + 1}: انتخاب خط تولید الزامی است.`
    if (!shift) return `ردیف ${index + 1}: انتخاب شیفت الزامی است.`
    if (downHours <= 0) return `ردیف ${index + 1}: زمان توقف باید بزرگتر از صفر باشد.`

    return null
  }

  // Submit all rows
  const handleSubmitAll = async () => {
    if (isDateFixed && !fixedDate) {
      notify('لطفاً تاریخ ثابت را در پنل بالا وارد کنید.', 'error')
      return
    }
    if (isLineFixed && !fixedLineId) {
      notify('لطفاً خط تولید ثابت را انتخاب کنید.', 'error')
      return
    }
    if (isShiftFixed && !fixedShiftId) {
      notify('لطفاً شیفت کاری ثابت را انتخاب کنید.', 'error')
      return
    }

    for (let i = 0; i < rows.length; i++) {
      const err = validateRow(rows[i], i)
      if (err) {
        notify(err, 'error')
        updateRow(i, { status: 'error', error: err })
        return
      }
    }

    setSubmitting(true)
    setProgress({ current: 0, total: rows.length })

    let successCount = 0
    let failCount = 0

    const allShifts = selectedFactory
      ? [...(selectedFactory.shifts ?? []), ...selectedFactory.lines.flatMap((l) => l.shifts ?? [])]
      : []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      updateRow(i, { status: 'pending', error: undefined })
      setProgress({ current: i + 1, total: rows.length })

      const lineId = Number(getEffectiveLineId(row))
      const shiftId = Number(getEffectiveShiftId(row))
      const date = getEffectiveDate(row)
      const causeId = getEffectiveCauseId(row) ? Number(getEffectiveCauseId(row)) : null
      const deviceId = row.device_id ? Number(row.device_id) : null
      const down = parseHoursHM(row.downtime_hours)

      const shiftObj = allShifts.find((s) => s.id === shiftId)
      const shiftLen = shiftHours(shiftObj?.start_time, shiftObj?.end_time) || 12
      const usefulRuntime = Math.max(0, round2(shiftLen - down))

      const payload: DeviceLogPayload = {
        line: lineId,
        shift: shiftId,
        date,
        device: deviceId,
        failure_cause: causeId,
        runtime_hours: usefulRuntime,
        downtime_hours: down,
        failure_description: row.failure_description || '',
        repair_description: row.repair_description || '',
      }

      try {
        await createLog(payload)
        updateRow(i, { status: 'success', error: undefined })
        successCount++
      } catch (e: any) {
        failCount++
        const errMsg = e?.response?.data?.errors?.detail || e?.response?.data?.detail || e?.message || 'خطا در ثبت'
        updateRow(i, { status: 'error', error: errMsg })
      }
    }

    setSubmitting(false)

    if (failCount === 0) {
      notify(`تمام ${successCount} ردیف توقف با موفقیت در دیتابیس ثبت شدند`, 'success')
      onSuccess()
      onClose()
    } else {
      notify(`${successCount} مورد با موفقیت ثبت شد، ولی ${failCount} مورد با خطا مواجه شد.`, 'error')
      onSuccess()
    }
  }

  // Direct Excel Import
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const XLSX = await import('xlsx')
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array' })
      const firstSheetName = wb.SheetNames[0]
      if (!firstSheetName) {
        notify('شیت قابل خواندنی در فایل اکسل یافت نشد', 'error')
        return
      }
      const sheet = wb.Sheets[firstSheetName]
      const rawData: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

      if (!rawData || rawData.length === 0) {
        notify('فایل اکسل خالی است', 'error')
        return
      }

      let headerRowIdx = 0
      while (headerRowIdx < rawData.length && rawData[headerRowIdx].every((cell) => !String(cell).trim())) {
        headerRowIdx++
      }

      if (headerRowIdx >= rawData.length) {
        notify('داده‌ای در فایل اکسل یافت نشد', 'error')
        return
      }

      const headers = rawData[headerRowIdx].map((h) => String(h || '').trim())
      const dataRows = rawData.slice(headerRowIdx + 1).filter((r) => r.some((c) => String(c).trim() !== ''))

      if (dataRows.length === 0) {
        notify('هیچ سطر داده‌ای بعد از عنوان‌ها در اکسل پیدا نشد', 'error')
        return
      }

      const allDevices = linesList.flatMap((l) => l.devices)
      const allShifts = [
        ...(selectedFactory?.shifts ?? []),
        ...linesList.flatMap((l) => l.shifts ?? []),
      ]

      const parsedRows: BulkDowntimeRow[] = []

      dataRows.forEach((rowCells) => {
        const r = createEmptyRow()

        headers.forEach((h, colIdx) => {
          const val = String(rowCells[colIdx] ?? '').trim()
          if (!val) return

          const norm = h.toLowerCase().replace(/[\s\-_]/g, '')

          if ((norm.includes('تاریخ') || norm === 'date') && !isDateFixed) {
            const d = val.replace(/\//g, '-')
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) r.date = d
          } else if ((norm.includes('خط') || norm === 'line') && !isLineFixed) {
            const matched = linesList.find((l) => String(l.name) === val || String(l.id) === val)
            if (matched) r.line_id = String(matched.id)
          } else if ((norm.includes('شیفت') || norm === 'shift') && !isShiftFixed) {
            const matched = allShifts.find((s) => String(s.name) === val || String(s.id) === val)
            if (matched) r.shift_id = String(matched.id)
          } else if (norm.includes('دستگاه') || norm === 'device') {
            const matched = allDevices.find((d) => String(d.name) === val || String(d.code) === val || String(d.id) === val)
            if (matched) r.device_id = String(matched.id)
          } else if (norm.includes('علت') || norm === 'cause') {
            const matched = failureCausesList.find((c) => String(c.title) === val || String(c.id) === val)
            if (matched) r.failure_cause_id = String(matched.id)
          } else if (norm.includes('توقف') || norm.includes('مدت') || norm === 'duration' || norm === 'downtime') {
            r.downtime_hours = val
          } else if (norm.includes('شرح') || norm.includes('خرابی') || norm === 'description') {
            r.failure_description = val
          } else if (norm.includes('تعمیر') || norm.includes('اقدام') || norm === 'repair') {
            r.repair_description = val
          }
        })

        parsedRows.push(r)
      })

      if (parsedRows.length > 0) {
        setRows(parsedRows)
        notify(`${parsedRows.length} سطر توقف از فایل اکسل وارد شد`, 'success')
      }
    } catch (err: any) {
      notify(`خطا در خواندن فایل اکسل: ${err.message}`, 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Paste Text Handler
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return
    const lines = pasteText.trim().split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    if (lines.length === 0) return

    const allDevices = linesList.flatMap((l) => l.devices)
    const allShifts = [
      ...(selectedFactory?.shifts ?? []),
      ...linesList.flatMap((l) => l.shifts ?? []),
    ]

    const parsedRows: BulkDowntimeRow[] = []

    lines.forEach((line) => {
      const cols = line.includes('\t') ? line.split('\t') : line.split(',')
      const r = createEmptyRow()
      let cIdx = 0

      // Date
      if (!isDateFixed && cols[cIdx]) {
        const d = cols[cIdx].trim().replace(/\//g, '-')
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          r.date = d
          cIdx++
        }
      }

      // Line
      if (!isLineFixed && cols[cIdx]) {
        const lStr = cols[cIdx].trim()
        const matched = linesList.find((l) => String(l.name) === lStr || String(l.id) === lStr)
        if (matched) {
          r.line_id = String(matched.id)
          cIdx++
        }
      }

      // Shift
      if (!isShiftFixed && cols[cIdx]) {
        const sStr = cols[cIdx].trim()
        const matched = allShifts.find((s) => String(s.name) === sStr || String(s.id) === sStr)
        if (matched) {
          r.shift_id = String(matched.id)
          cIdx++
        }
      }

      // Device
      if (cols[cIdx] !== undefined) {
        const devStr = cols[cIdx].trim()
        const matched = allDevices.find((d) => String(d.name) === devStr || String(d.code) === devStr || String(d.id) === devStr)
        if (matched) r.device_id = String(matched.id)
        cIdx++
      }

      // Cause
      if (!isCauseFixed && cols[cIdx] !== undefined) {
        const causeStr = cols[cIdx].trim()
        const matched = failureCausesList.find((c) => String(c.title) === causeStr || String(c.id) === causeStr)
        if (matched) r.failure_cause_id = String(matched.id)
        cIdx++
      }

      // Downtime Hours
      if (cols[cIdx] !== undefined) {
        r.downtime_hours = cols[cIdx].trim()
        cIdx++
      }

      // Failure Description
      if (cols[cIdx] !== undefined) {
        r.failure_description = cols[cIdx].trim()
        cIdx++
      }

      // Repair Description
      if (cols[cIdx] !== undefined) {
        r.repair_description = cols[cIdx].trim()
        cIdx++
      }

      parsedRows.push(r)
    })

    if (parsedRows.length > 0) {
      setRows(parsedRows)
      setPasteModalOpen(false)
      setPasteText('')
      notify(`${parsedRows.length} ردیف توقف از حافظه جایگذاری شد`, 'success')
    }
  }

  // Download Sample Template
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx')
      const headers: string[] = []
      const sampleRow: Record<string, string | number> = {}

      if (!isDateFixed) {
        headers.push('تاریخ')
        sampleRow['تاریخ'] = todayISO()
      }
      if (!isLineFixed) {
        headers.push('خط تولید')
        sampleRow['خط تولید'] = linesList[0]?.name || 'خط ۱'
      }
      if (!isShiftFixed) {
        headers.push('شیفت')
        sampleRow['شیفت'] = availableShifts[0]?.name || 'شیفت صبح'
      }

      headers.push('دستگاه')
      sampleRow['دستگاه'] = linesList[0]?.devices?.[0]?.name || 'سنگ شکن فکی'

      if (!isCauseFixed) {
        headers.push('علت خرابی')
        sampleRow['علت خرابی'] = failureCausesList[0]?.title || 'گیر مکانیکی'
      }

      headers.push('مدت توقف (ساعت)')
      sampleRow['مدت توقف (ساعت)'] = '1:30'

      headers.push('شرح خرابی')
      sampleRow['شرح خرابی'] = 'قفل شدن بار ورودی در فک'

      headers.push('شرح اقدامات')
      sampleRow['شرح اقدامات'] = 'تخلیه بار و راه‌اندازی مجدد'

      const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers })
      ws['!cols'] = headers.map(() => ({ wch: 22 }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'قالب توقفات')
      XLSX.writeFile(wb, `قالب_ورود_گروهی_توقفات_${todayISO()}.xlsx`)
      notify('قالب اکسل توقفات با موفقیت دانلود شد', 'success')
    } catch (e: any) {
      notify(`خطا در دانلود قالب: ${e.message}`, 'error')
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={submitting ? () => {} : onClose}
        title="ورود و ثبت گروهی توقفات خط تولید (Bulk Downtime)"
        subtitle="امکان تنظیم مقادیر ثابت، ورود لیست توقف‌ها، ایمپورت مستقیم اکسل و انتصاب دستگاه‌ها"
        size="full"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-ink-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5 rounded-lg bg-ink-100/70 px-2.5 py-1 font-bold text-ink-800 dark:bg-slate-800 dark:text-slate-200">
                <TableProperties className="h-4 w-4 text-brand-600" />
                <span>مجموع ردیف‌ها: {formatNumber(stats.totalRows)}</span>
              </div>
              <div className="flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 font-bold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                <Clock className="h-4 w-4" />
                <span>مجموع ساعات توقف: {stats.formattedTotalHours}</span>
              </div>
              {submitting && (
                <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال ذخیره ردیف {progress.current} از {progress.total}...</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !h-10 !px-4 text-sm font-medium" onClick={onClose} disabled={submitting}>
                انصراف
              </button>
              <button
                className="btn-primary !h-10 !px-6 text-sm font-bold shadow-md shadow-brand-500/20"
                onClick={handleSubmitAll}
                disabled={submitting || rows.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>در حال ذخیره‌سازی...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>تأیید و ثبت نهایی {formatNumber(rows.length)} توقف</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* نوار تنظیمات سراسری و مقادیر ثابت */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/80">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
                  <Pin className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-800 dark:text-slate-100">
                    تنظیمات سراسری و مقادیر ثابت توقفات
                  </h4>
                  <p className="text-[11px] text-ink-500 dark:text-slate-400">
                    برای ثبت سریع چندین توقف در یک روز، شیفت یا خط مشخص، مقادیر را ثابت بگذارید تا نیاز به انتخاب تکراری در جدول نباشد.
                  </p>
                </div>
              </div>

              {/* ابزارهای اکسل */}
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary !h-9 !px-3 text-xs font-semibold hover:border-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-400"
                  title="بارگذاری مستقیم فایل اکسل"
                >
                  <Upload className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>بارگذاری فایل اکسل</span>
                </button>

                <button
                  type="button"
                  onClick={() => setPasteModalOpen(true)}
                  className="btn-secondary !h-9 !px-3 text-xs font-semibold"
                  title="چسباندن متن کپی‌شده از اکسل"
                >
                  <ClipboardPaste className="h-3.5 w-3.5 text-brand-600" />
                  <span>چسباندن متن (Paste)</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="btn-ghost !h-9 !px-2.5 text-xs font-medium text-slate-600 dark:text-slate-300"
                  title="دانلود فایل نمونه اکسل جهت پر کردن داده‌ها"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>دانلود قالب اکسل</span>
                </button>
              </div>
            </div>

            {/* کنترل‌های سوییچ و مقادیر */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* تاریخ */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>تاریخ وقوع توقف</span>
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setIsDateFixed(true)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        isDateFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      ثابت برای همه
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsDateFixed(false)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        !isDateFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      در هر ردیف
                    </button>
                  </div>
                </div>
                {isDateFixed ? (
                  <div className="mt-1">
                    <input
                      type="text"
                      dir="ltr"
                      placeholder="1405-05-15"
                      className="input !h-9 w-full text-center text-xs font-mono font-medium focus:border-brand-500"
                      value={fixedDate}
                      onChange={(e) => setFixedDate(e.target.value)}
                    />
                  </div>
                ) : (
                  <div className="mt-1 flex h-9 items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800/40">
                    انتخاب مجزا در هر ردیف
                  </div>
                )}
              </div>

              {/* خط تولید */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Layers className="h-3.5 w-3.5 text-slate-400" />
                    <span>خط تولید *</span>
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setIsLineFixed(true)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        isLineFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      ثابت برای همه
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLineFixed(false)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        !isLineFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      در هر ردیف
                    </button>
                  </div>
                </div>
                {isLineFixed ? (
                  <div className="mt-1">
                    <select
                      className="input !h-9 w-full text-xs font-medium cursor-pointer"
                      value={fixedLineId}
                      onChange={(e) => setFixedLineId(e.target.value)}
                    >
                      <option value="">انتخاب خط تولید ثابت...</option>
                      {linesList.map((l) => (
                        <option key={l.id} value={l.id}>
                          {l.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-1 flex h-9 items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800/40">
                    انتخاب در هر سطر جدول
                  </div>
                )}
              </div>

              {/* شیفت کاری */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    <span>شیفت کاری *</span>
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setIsShiftFixed(true)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        isShiftFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      ثابت برای همه
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsShiftFixed(false)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        !isShiftFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      در هر ردیف
                    </button>
                  </div>
                </div>
                {isShiftFixed ? (
                  <div className="mt-1">
                    <select
                      className="input !h-9 w-full text-xs font-medium cursor-pointer"
                      value={fixedShiftId}
                      onChange={(e) => setFixedShiftId(e.target.value)}
                    >
                      <option value="">انتخاب شیفت ثابت...</option>
                      {availableShifts.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.start_time.slice(0, 5)} - {s.end_time.slice(0, 5)})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-1 flex h-9 items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800/40">
                    انتخاب در هر سطر جدول
                  </div>
                )}
              </div>

              {/* علت خرابی */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Wrench className="h-3.5 w-3.5 text-slate-400" />
                    <span>علت خرابی</span>
                  </span>
                  <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setIsCauseFixed(true)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        isCauseFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      ثابت
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCauseFixed(false)}
                      className={classNames(
                        'px-2 py-0.5 rounded-md font-medium transition',
                        !isCauseFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                      )}
                    >
                      در هر ردیف
                    </button>
                  </div>
                </div>
                {isCauseFixed ? (
                  <div className="mt-1">
                    <select
                      className="input !h-9 w-full text-xs font-medium cursor-pointer"
                      value={fixedCauseId}
                      onChange={(e) => setFixedCauseId(e.target.value)}
                    >
                      <option value="">انتخاب علت ثابت...</option>
                      {failureCausesList.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.title}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="mt-1 flex h-9 items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800/40">
                    انتخاب مجزا برای هر توقف
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ابزار مدیریت تعداد سطرها */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-600 dark:text-slate-400">افزودن سطر توقف جدید:</span>
              <button
                type="button"
                onClick={() => addRows(1)}
                className="btn-secondary !h-8 !px-2.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> ۱ ردیف
              </button>
              <button
                type="button"
                onClick={() => addRows(5)}
                className="btn-secondary !h-8 !px-2.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> ۵ ردیف
              </button>
              <button
                type="button"
                onClick={() => addRows(10)}
                className="btn-secondary !h-8 !px-2.5 text-xs font-semibold"
              >
                <Plus className="h-3.5 w-3.5" /> ۱۰ ردیف
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('آیا مایلید تمام ردیف‌های جدول ریست شوند؟')) {
                    setRows([createEmptyRow(), createEmptyRow(), createEmptyRow()])
                  }
                }}
                className="btn-ghost !h-8 !px-2 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                title="پاک‌سازی همه ردیف‌ها"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>پاک‌سازی جدول</span>
              </button>
            </div>
          </div>

          {/* جدول اصلی ثبت توقفات */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-right font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-200">
                  <th className="w-12 px-2 py-3 text-center">#</th>

                  {/* تاریخ */}
                  {!isDateFixed && (
                    <th className="min-w-[140px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span>تاریخ *</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'date')}
                          title="کپی تاریخ ردیف اول به پایین"
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {/* خط تولید */}
                  {!isLineFixed && (
                    <th className="min-w-[170px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span>خط تولید *</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'line_id')}
                          title="کپی خط ردیف اول به پایین"
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {/* شیفت */}
                  {!isShiftFixed && (
                    <th className="min-w-[150px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span>شیفت کاری *</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'shift_id')}
                          title="کپی شیفت ردیف اول به پایین"
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {/* دستگاه */}
                  <th className="min-w-[180px] px-3 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-brand-700 dark:text-brand-300">دستگاه / تجهیز</span>
                      <button
                        type="button"
                        onClick={() => copyDownField(0, 'device_id')}
                        title="کپی دستگاه ردیف اول به پایین"
                        className="text-slate-400 hover:text-brand-600 transition"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </th>

                  {/* علت خرابی */}
                  {!isCauseFixed && (
                    <th className="min-w-[170px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span>علت خرابی</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'failure_cause_id')}
                          title="کپی علت ردیف اول به پایین"
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {/* زمان توقف */}
                  <th className="min-w-[120px] px-3 py-3">
                    <div className="flex items-center justify-between">
                      <span className="text-rose-600 dark:text-rose-400">مدت توقف (HH:MM) *</span>
                      <button
                        type="button"
                        onClick={() => copyDownField(0, 'downtime_hours')}
                        title="کپی مدت توقف ردیف اول به پایین"
                        className="text-slate-400 hover:text-rose-600 transition"
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </th>

                  {/* شرح خرابی */}
                  <th className="min-w-[200px] px-3 py-3">
                    <span>شرح خرابی</span>
                  </th>

                  {/* شرح اقدامات / تعمیرات */}
                  <th className="min-w-[200px] px-3 py-3">
                    <span>اقدامات انجام‌شده / تعمیرات</span>
                  </th>

                  <th className="w-24 px-2 py-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row, rIdx) => {
                  const currentLineId = getEffectiveLineId(row)
                  const lineDevices = getLineDevices(currentLineId)

                  return (
                    <tr
                      key={row.id}
                      className={classNames(
                        'transition-colors duration-150',
                        row.status === 'success'
                          ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                          : row.status === 'error'
                          ? 'bg-rose-50/50 dark:bg-rose-950/20'
                          : rIdx % 2 === 0
                          ? 'bg-white dark:bg-slate-900'
                          : 'bg-slate-50/40 dark:bg-slate-850/40',
                        'hover:bg-brand-50/30 dark:hover:bg-slate-800/40'
                      )}
                    >
                      {/* شماره و وضعیت */}
                      <td className="px-2 py-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          {row.status === 'pending' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                          ) : row.status === 'success' ? (
                            <span title="ثبت با موفقیت انجام شد">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            </span>
                          ) : row.status === 'error' ? (
                            <span title={row.error || 'خطا در ثبت'}>
                              <AlertCircle className="h-4 w-4 text-rose-600" />
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-semibold text-slate-400 dark:text-slate-500">
                              {rIdx + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* تاریخ */}
                      {!isDateFixed && (
                        <td className="px-2 py-2 align-middle">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="1405-05-15"
                            className="input !h-9 w-full text-center text-xs font-mono font-medium focus:ring-1 focus:ring-brand-500"
                            value={row.date}
                            onChange={(e) => updateRow(rIdx, { date: e.target.value })}
                          />
                        </td>
                      )}

                      {/* خط تولید */}
                      {!isLineFixed && (
                        <td className="px-2 py-2 align-middle">
                          <select
                            className="input !h-9 w-full text-xs font-medium cursor-pointer focus:ring-1 focus:ring-brand-500"
                            value={row.line_id}
                            onChange={(e) => updateRow(rIdx, { line_id: e.target.value, device_id: '' })}
                          >
                            <option value="">انتخاب خط...</option>
                            {linesList.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* شیفت */}
                      {!isShiftFixed && (
                        <td className="px-2 py-2 align-middle">
                          <select
                            className="input !h-9 w-full text-xs font-medium cursor-pointer focus:ring-1 focus:ring-brand-500"
                            value={row.shift_id}
                            onChange={(e) => updateRow(rIdx, { shift_id: e.target.value })}
                          >
                            <option value="">انتخاب شیفت...</option>
                            {availableShifts.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* دستگاه (منوی کشویی هوشمند بر اساس خط انتخاب‌شده) */}
                      <td className="px-2 py-2 align-middle">
                        <select
                          className="input !h-9 w-full text-xs font-medium cursor-pointer border-brand-300/80 bg-brand-50/15 focus:ring-1 focus:ring-brand-500 dark:border-brand-800 dark:bg-brand-950/20"
                          value={row.device_id}
                          onChange={(e) => updateRow(rIdx, { device_id: e.target.value })}
                        >
                          <option value="">(کل خط / بدون دستگاه)</option>
                          {lineDevices.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.code ? `${d.code} - ${d.name}` : d.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* علت خرابی */}
                      {!isCauseFixed && (
                        <td className="px-2 py-2 align-middle">
                          <select
                            className="input !h-9 w-full text-xs font-medium cursor-pointer focus:ring-1 focus:ring-brand-500"
                            value={row.failure_cause_id}
                            onChange={(e) => updateRow(rIdx, { failure_cause_id: e.target.value })}
                          >
                            <option value="">(بدون علت / نامشخص)</option>
                            {failureCausesList.map((f) => (
                              <option key={f.id} value={f.id}>
                                {f.title}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* ساعت توقف */}
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="text"
                          dir="ltr"
                          placeholder="1:30"
                          className="input !h-9 w-full text-center text-xs font-mono font-bold tracking-wider text-rose-600 focus:ring-1 focus:ring-rose-500 dark:text-rose-400"
                          value={row.downtime_hours}
                          onChange={(e) => updateRow(rIdx, { downtime_hours: e.target.value })}
                        />
                      </td>

                      {/* شرح خرابی */}
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="text"
                          placeholder="توضیح مختصر نقص فنی..."
                          className="input !h-9 w-full text-xs focus:ring-1 focus:ring-brand-500"
                          value={row.failure_description}
                          onChange={(e) => updateRow(rIdx, { failure_description: e.target.value })}
                        />
                      </td>

                      {/* شرح اقدامات / تعمیرات */}
                      <td className="px-2 py-2 align-middle">
                        <input
                          type="text"
                          placeholder="اقدامات انجام شده، قطعات تعویض شده..."
                          className="input !h-9 w-full text-xs focus:ring-1 focus:ring-brand-500"
                          value={row.repair_description}
                          onChange={(e) => updateRow(rIdx, { repair_description: e.target.value })}
                        />
                      </td>

                      {/* دکمه‌های عملیات */}
                      <td className="px-2 py-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRow(rIdx)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800 transition"
                            title="تکثیر این توقف"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(rIdx)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50 transition"
                            title="حذف سطر"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </Modal>

      {/* مودال چسباندن داده‌ها از اکسل */}
      <Modal
        open={pasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
        title="چسباندن متن توقفات از اکسل (Paste)"
        subtitle="ردیف‌های مورد نظر را در اکسل کپی کرده و در کادر زیر پیست نمایید"
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost !h-9 text-xs font-medium" onClick={() => setPasteModalOpen(false)}>
              انصراف
            </button>
            <button className="btn-primary !h-9 text-xs font-bold" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
              <ClipboardPaste className="h-4 w-4" />
              <span>جایگذاری در جدول</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3.5">
          <div className="rounded-xl bg-brand-50/60 p-3 text-xs text-brand-900 dark:bg-brand-950/40 dark:text-brand-200">
            <div className="flex items-center gap-1.5 font-bold mb-1">
              <Info className="h-4 w-4 text-brand-600" />
              <span>راهنمای ترتیب ستون‌ها بر اساس تنظیمات فعلی شما:</span>
            </div>
            <p className="font-mono text-[11px] leading-relaxed">
              {[
                !isDateFixed ? 'تاریخ' : null,
                !isLineFixed ? 'خط تولید' : null,
                !isShiftFixed ? 'شیفت' : null,
                'دستگاه',
                !isCauseFixed ? 'علت خرابی' : null,
                'ساعت توقف',
                'شرح خرابی',
                'اقدامات / تعمیرات',
              ]
                .filter(Boolean)
                .join(' ⟵ ')}
            </p>
          </div>
          <textarea
            dir="ltr"
            rows={8}
            className="input w-full font-mono text-xs leading-relaxed"
            placeholder={`سنگ شکن فکی\tگیر مکانیکی\t1:30\tتراکم بار\tتخلیه سنگ\nنوار نقاله ۱\tبرقی\t0:45\tاورلود موتور\tریست رله`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
        </div>
      </Modal>
    </>
  )
}
