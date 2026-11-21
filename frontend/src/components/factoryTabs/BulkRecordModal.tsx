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
  Info,
  Check,
} from 'lucide-react'
import Modal from '../ui/Modal'
import { useToast } from '../ui/Toast'
import { useFactory } from '../../store/FactoryContext'
import { createFactoryTabRecord, getFactoryTabSchema } from '../../api/factoryTabs'
import type { FactoryTabBrief, FactoryTabSchema, FactoryTabRecordPayload } from '../../types'
import {
  formatDate,
  formatNumber,
  round2,
  todayJalali,
  jalaliSlashToIso,
  parseJalaliSlash,
  formatJalaliSlash,
  normalizePersianDigits,
  gregorianToJalali,
  jalaliToGregorian,
  jalaliDaysInMonth,
  PERSIAN_MONTHS,
} from '../../utils'
import { computeRowOutputs } from '../../utils/formulaEvaluator'

interface Props {
  open: boolean
  onClose: () => void
  tab: FactoryTabBrief
  schema: FactoryTabSchema | null
  onSuccess: () => void
}

interface BulkRow {
  id: string
  date_from: string // تاریخ شمسی با اسلش (مثال: 1403/08/30)
  date_to: string // تاریخ شمسی با اسلش (مثال: 1403/08/30)
  hour: string
  line: string
  contractor: string
  inputs: Record<string, string | number>
  status: 'idle' | 'pending' | 'success' | 'error'
  error?: string
}

let nextId = 1
const genId = () => `row_${Date.now()}_${nextId++}`

/**
 * تبدیل هر نوع فرمت تاریخ ورودی از اکسل به تاریخ استاندارد شمسی با اسلش (1403/08/30)
 */
function parseExcelDate(val: unknown): string | null {
  if (val === null || val === undefined || val === '') return null

  // در صورتی که اکسل عدد سریالی ذخیره کرده باشد (Serial Date Number)
  if (typeof val === 'number') {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30))
    const jsDate = new Date(excelEpoch.getTime() + val * 86400000)
    if (!isNaN(jsDate.getTime())) {
      const gy = jsDate.getUTCFullYear()
      const gm = jsDate.getUTCMonth() + 1
      const gd = jsDate.getUTCDate()
      const [jy, jm, jd] = gregorianToJalali(gy, gm, gd)
      return formatJalaliSlash(jy, jm, jd)
    }
  }

  const str = normalizePersianDigits(String(val)).trim()

  // بررسی تطابق با شمسی (اسلش یا خط‌تیره)
  const p = parseJalaliSlash(str)
  if (p) {
    return formatJalaliSlash(p[0], p[1], p[2])
  }

  // بررسی میلادی ISO یا با اسلش
  const m = str.match(/^(\d{2,4})[-/.](\d{1,2})[-/.](\d{1,2})$/)
  if (m) {
    let y = Number(m[1])
    const mth = Number(m[2])
    const d = Number(m[3])
    if (y < 100) y = 1400 + y
    if (y > 1900 && y < 2100) {
      const [jy, jm, jd] = gregorianToJalali(y, mth, d)
      return formatJalaliSlash(jy, jm, jd)
    } else if (y >= 1300 && y <= 1500) {
      return formatJalaliSlash(y, mth, d)
    }
  }

  return null
}

export default function BulkRecordModal({ open, onClose, tab, schema: propSchema, onSuccess }: Props) {
  const { notify } = useToast()
  const { selectedFactory } = useFactory()
  const [loadedSchema, setLoadedSchema] = useState<FactoryTabSchema | null>(propSchema)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (propSchema) {
      setLoadedSchema(propSchema)
    } else if (open && tab?.id) {
      getFactoryTabSchema(tab.id).then(setLoadedSchema).catch(() => {})
    }
  }, [open, tab?.id, propSchema])

  const schema = loadedSchema || propSchema

  const isDaily = tab.record_type === 'daily'
  const lineMode = tab.line_mode || (tab.require_line ? 'required' : 'optional')
  const contractorMode = tab.contractor_mode || (tab.contractor_required ? 'required' : 'optional')
  const hourMode = tab.hour_mode || (isDaily ? 'optional' : 'disabled')

  const linesList = schema?.lines?.length ? schema.lines : (selectedFactory?.lines ?? [])
  const contractorsList = schema?.contractor?.options?.length ? schema.contractor.options : (selectedFactory?.contractors ?? [])
  const outputsList = (tab.outputs && tab.outputs.length > 0) ? tab.outputs : (schema?.outputs ?? [])

  const createEmptyRow = useCallback(
    (defaultDate = todayJalali(), defaultLine = '', defaultContractor = ''): BulkRow => {
      const inputsInit: Record<string, string | number> = {}
      ;(schema?.inputs ?? []).forEach((inp) => {
        inputsInit[inp.key] = ''
      })
      return {
        id: genId(),
        date_from: defaultDate,
        date_to: defaultDate,
        hour: '',
        line: defaultLine,
        contractor: defaultContractor,
        inputs: inputsInit,
        status: 'idle',
      }
    },
    [schema],
  )

  const [rows, setRows] = useState<BulkRow[]>(() => [
    createEmptyRow(),
    createEmptyRow(),
    createEmptyRow(),
  ])

  // همگام‌سازی کلیدهای ورودی در صورت بارگذاری اسکیما
  useEffect(() => {
    if (!schema?.inputs?.length) return
    setRows((prev) =>
      prev.map((r) => {
        let changed = false
        const nextInputs = { ...r.inputs }
        schema.inputs.forEach((inp) => {
          if (nextInputs[inp.key] === undefined) {
            nextInputs[inp.key] = ''
            changed = true
          }
        })
        return changed ? { ...r, inputs: nextInputs } : r
      }),
    )
  }, [schema])

  const [submitting, setSubmitting] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })

  // وضعیت نوار تنظیمات سریع
  const [fillDate, setFillDate] = useState(() => todayJalali())
  const [fillLine, setFillLine] = useState('')
  const [fillContractor, setFillContractor] = useState('')
  const [fillHour, setFillHour] = useState('')

  // وضعیت مودال اکسل
  const [excelModalOpen, setExcelModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // وضعیت باز شدن تقویم برای یک ردیف خاص
  const [rowCalendarTarget, setRowCalendarTarget] = useState<{
    rowIdx: number
    field: 'date_from' | 'date_to'
    jy: number
    jm: number
    jd: number
  } | null>(null)

  // افزودن ردیف‌های جدید
  const addRows = (count: number) => {
    const last = rows[rows.length - 1]
    const defDate = last ? last.date_from : todayJalali()
    const defLine = last ? last.line : ''
    const defContractor = last ? last.contractor : ''
    const newRows: BulkRow[] = []
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow(defDate, defLine, defContractor))
    }
    setRows((prev) => [...prev, ...newRows])
  }

  // کپی / تکثیر ردیف
  const duplicateRow = (idx: number) => {
    const target = rows[idx]
    if (!target) return
    const duplicated: BulkRow = {
      ...target,
      id: genId(),
      inputs: { ...target.inputs },
      status: 'idle',
      error: undefined,
    }
    setRows((prev) => {
      const copy = [...prev]
      copy.splice(idx + 1, 0, duplicated)
      return copy
    })
  }

  // حذف ردیف
  const removeRow = (idx: number) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow()])
      return
    }
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  // به‌روزرسانی فیلد ردیف
  const updateRow = (idx: number, patch: Partial<BulkRow>) => {
    setRows((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], ...patch }
      return copy
    })
  }

  // به‌روزرسانی ورودی خاص در یک ردیف
  const updateRowInput = (idx: number, key: string, val: string | number) => {
    setRows((prev) => {
      const copy = [...prev]
      copy[idx] = {
        ...copy[idx],
        inputs: { ...copy[idx].inputs, [key]: val },
      }
      return copy
    })
  }

  // اعمال تاریخ به همه ردیف‌ها
  const applyDateToAll = () => {
    if (!fillDate.trim()) {
      notify('لطفاً ابتدا تاریخ شمسی را وارد کنید', 'error')
      return
    }
    const iso = jalaliSlashToIso(fillDate)
    if (!iso) {
      notify('فرمت تاریخ نامعتبر است. فرمت صحیح: سال/ماه/روز با اسلش (مثال: 1403/08/30)', 'error')
      return
    }
    const p = parseJalaliSlash(fillDate)!
    const formatted = formatJalaliSlash(p[0], p[1], p[2])
    setRows((prev) => prev.map((r) => ({ ...r, date_from: formatted, date_to: formatted })))
    notify(`تاریخ «${formatted}» برای تمام ردیف‌ها اعمال شد`)
  }

  // اعمال خط تولید به همه ردیف‌ها
  const applyLineToAll = () => {
    if (!fillLine) return
    setRows((prev) => prev.map((r) => ({ ...r, line: fillLine })))
    notify('خط تولید برای تمام ردیف‌ها اعمال شد')
  }

  // اعمال پیمانکار به همه ردیف‌ها
  const applyContractorToAll = () => {
    if (!fillContractor) return
    setRows((prev) => prev.map((r) => ({ ...r, contractor: fillContractor })))
    notify('پیمانکار برای تمام ردیف‌ها اعمال شد')
  }

  // اعمال ساعت به همه ردیف‌ها
  const applyHourToAll = () => {
    if (!fillHour) return
    setRows((prev) => prev.map((r) => ({ ...r, hour: fillHour })))
    notify('ساعت برای تمام ردیف‌ها اعمال شد')
  }

  // ۱. دانلود قالب اکسل پیش‌فرض (Download Sample Template)
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx')
      const headers: string[] = ['تاریخ شمسی (مثال: 1403/08/30)']

      if (!isDaily) {
        headers.push('تا تاریخ شمسی')
      }
      if (hourMode !== 'disabled') {
        headers.push('ساعت (مثال: 08:30)')
      }
      if (lineMode !== 'disabled') {
        headers.push('خط تولید')
      }
      if (contractorMode !== 'disabled') {
        headers.push('پیمانکار')
      }

      const inputDefs = schema?.inputs ?? []
      inputDefs.forEach((inp) => {
        headers.push(inp.unit ? `${inp.name} (${inp.unit})` : inp.name)
      })

      // ساخت ۳ ردیف نمونه با تاریخ شمسی واقعی
      const sampleRows: (string | number)[][] = [
        headers,
        [
          todayJalali(),
          ...(!isDaily ? [todayJalali()] : []),
          ...(hourMode !== 'disabled' ? ['08:00'] : []),
          ...(lineMode !== 'disabled' ? [linesList[0]?.name || 'خط ۱'] : []),
          ...(contractorMode !== 'disabled' ? [contractorsList[0]?.name || 'پیمانکار ۱'] : []),
          ...inputDefs.map((inp, i) => (inp.type === 'number' ? 100 + i * 20 : inp.options?.[0] || 'نمونه')),
        ],
        [
          '1403/08/30',
          ...(!isDaily ? ['1403/08/30'] : []),
          ...(hourMode !== 'disabled' ? ['14:30'] : []),
          ...(lineMode !== 'disabled' ? [linesList[0]?.name || 'خط ۱'] : []),
          ...(contractorMode !== 'disabled' ? [contractorsList[0]?.name || 'پیمانکار ۱'] : []),
          ...inputDefs.map((inp, i) => (inp.type === 'number' ? 150 + i * 15 : inp.options?.[0] || 'نمونه')),
        ],
        [
          '1403/08/29',
          ...(!isDaily ? ['1403/08/29'] : []),
          ...(hourMode !== 'disabled' ? ['20:00'] : []),
          ...(lineMode !== 'disabled' ? [linesList[1]?.name || linesList[0]?.name || 'خط ۱'] : []),
          ...(contractorMode !== 'disabled' ? [contractorsList[0]?.name || 'پیمانکار ۱'] : []),
          ...inputDefs.map((inp, i) => (inp.type === 'number' ? 200 + i * 25 : inp.options?.[0] || 'نمونه')),
        ],
      ]

      const ws = XLSX.utils.aoa_to_sheet(sampleRows)
      ws['!cols'] = headers.map(() => ({ wch: 24 }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'ورود داده‌ها')
      XLSX.writeFile(wb, `قالب_ورود_گروهی_${tab.name}.xlsx`)
      notify('قالب اکسل پیش‌فرض با موفقیت دانلود شد')
    } catch (e: any) {
      notify(`خطا در ایجاد قالب اکسل: ${e.message}`, 'error')
    }
  }

  // ۲. پردازش آرایه‌ی دوبعدی سطرهای اکسل و اعمال به جدول
  const processExcelRows = (dataRows: (string | number)[][], headerRow?: string[]) => {
    if (!dataRows || dataRows.length === 0) {
      notify('سطر داده‌ای برای پردازش یافت نشد', 'error')
      return
    }

    const inputDefs = schema?.inputs ?? []
    const parsedRows: BulkRow[] = []

    // نقشه‌برداری ستون‌ها در صورت وجود سرستون
    let colDateIdx = 0
    let colDateToIdx = isDaily ? -1 : 1
    let colHourIdx = hourMode !== 'disabled' ? (isDaily ? 1 : 2) : -1
    let colLineIdx = lineMode !== 'disabled' ? (hourMode !== 'disabled' ? (isDaily ? 2 : 3) : isDaily ? 1 : 2) : -1
    let colContractorIdx = contractorMode !== 'disabled' ? (colLineIdx >= 0 ? colLineIdx + 1 : 2) : -1

    if (headerRow && headerRow.length > 0) {
      headerRow.forEach((h, idx) => {
        const text = String(h).trim().toLowerCase()
        if (text.includes('تا تاریخ') || text.includes('date_to') || text.includes('end')) {
          colDateToIdx = idx
        } else if (text.includes('تاریخ') || text.includes('date')) {
          colDateIdx = idx
        } else if (text.includes('ساعت') || text.includes('hour') || text.includes('time')) {
          colHourIdx = idx
        } else if (text.includes('خط') || text.includes('line')) {
          colLineIdx = idx
        } else if (text.includes('پیمانکار') || text.includes('contractor')) {
          colContractorIdx = idx
        }
      })
    }

    dataRows.forEach((rowCells) => {
      if (rowCells.every((c) => String(c).trim() === '')) return

      const r = createEmptyRow()

      // استخراج تاریخ شروع
      const rawDate = rowCells[colDateIdx]
      const parsedDate = parseExcelDate(rawDate)
      if (parsedDate) {
        r.date_from = parsedDate
        r.date_to = parsedDate
      }

      // استخراج تا تاریخ
      if (!isDaily && colDateToIdx >= 0 && rowCells[colDateToIdx]) {
        const parsedDateTo = parseExcelDate(rowCells[colDateToIdx])
        if (parsedDateTo) {
          r.date_to = parsedDateTo
        }
      }

      // استخراج ساعت
      if (hourMode !== 'disabled' && colHourIdx >= 0 && rowCells[colHourIdx] !== undefined) {
        const rawH = normalizePersianDigits(String(rowCells[colHourIdx])).trim()
        if (/^\d{1,2}:\d{2}$/.test(rawH)) {
          r.hour = rawH.length === 4 ? `0${rawH}` : rawH
        } else if (/^\d{1,2}$/.test(rawH)) {
          const numH = Number(rawH)
          if (numH >= 0 && numH <= 23) {
            r.hour = `${numH < 10 ? '0' : ''}${numH}:00`
          }
        }
      }

      // استخراج خط تولید
      if (lineMode !== 'disabled' && colLineIdx >= 0 && rowCells[colLineIdx] !== undefined) {
        const cellLine = String(rowCells[colLineIdx]).trim()
        const matchedLine = linesList.find(
          (l) => l.name.trim() === cellLine || String(l.id) === cellLine || cellLine.includes(l.name),
        )
        if (matchedLine) {
          r.line = String(matchedLine.id)
        }
      }

      // استخراج پیمانکار
      if (contractorMode !== 'disabled' && colContractorIdx >= 0 && rowCells[colContractorIdx] !== undefined) {
        const cellContractor = String(rowCells[colContractorIdx]).trim()
        const matchedContractor = contractorsList.find(
          (c) => c.name.trim() === cellContractor || String(c.id) === cellContractor || cellContractor.includes(c.name),
        )
        if (matchedContractor) {
          r.contractor = String(matchedContractor.id)
        }
      }

      // استخراج فیلدهای ورودی
      let inputColStart = Math.max(colDateIdx, colDateToIdx, colHourIdx, colLineIdx, colContractorIdx) + 1
      inputDefs.forEach((inp, inpIdx) => {
        let cellVal: any = undefined

        // جستجو بر اساس سرستون
        if (headerRow && headerRow.length > 0) {
          const headerIdx = headerRow.findIndex(
            (h) => h.includes(inp.name) || inp.name.includes(h) || h.toLowerCase().includes(inp.key.toLowerCase()),
          )
          if (headerIdx >= 0) {
            cellVal = rowCells[headerIdx]
          }
        }

        // اگر از روی سرستون پیدا نشد، از روی ترتیب ستون‌ها
        if (cellVal === undefined && rowCells[inputColStart + inpIdx] !== undefined) {
          cellVal = rowCells[inputColStart + inpIdx]
        }

        if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
          const rawStr = normalizePersianDigits(String(cellVal)).trim()
          r.inputs[inp.key] = inp.type === 'number' ? (isNaN(Number(rawStr)) ? rawStr : Number(rawStr)) : rawStr
        }
      })

      parsedRows.push(r)
    })

    if (parsedRows.length > 0) {
      setRows(parsedRows)
      setExcelModalOpen(false)
      setPasteText('')
      notify(`${parsedRows.length} ردیف با موفقیت وارد و تاریخ‌ها به فرمت شمسی اسلش‌دار تطبیق داده شدند`)
    } else {
      notify('هیچ ردیف معتبری شناسایی نشد', 'error')
    }
  }

  // ۳. بارگذاری فایل اکسل (.xlsx / .xls / .csv)
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
      const rawData: (string | number)[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })

      if (!rawData || rawData.length === 0) {
        notify('فایل اکسل خالی است', 'error')
        return
      }

      let headerRowIdx = 0
      while (headerRowIdx < rawData.length && rawData[headerRowIdx].every((cell) => !String(cell).trim())) {
        headerRowIdx++
      }

      const headers = rawData[headerRowIdx].map((h) => String(h || '').trim())
      const dataRows = rawData.slice(headerRowIdx + 1).filter((r) => r.some((c) => String(c).trim() !== ''))

      processExcelRows(dataRows, headers)
    } catch (err: any) {
      notify(`خطا در خواندن فایل اکسل: ${err.message}`, 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ۴. پردازش متن کپی‌شده از اکسل (Paste Text)
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return
    const lines = pasteText
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) return

    const rowsArray = lines.map((line) => (line.includes('\t') ? line.split('\t') : line.split(',')))

    // بررسی آیا سطر اول عنوان ستون‌ها است
    const firstRowText = rowsArray[0].join(' ')
    const hasHeader =
      firstRowText.includes('تاریخ') ||
      firstRowText.includes('date') ||
      firstRowText.includes('خط') ||
      firstRowText.includes('پیمانکار')

    const headers = hasHeader ? rowsArray[0].map(String) : undefined
    const dataRows = hasHeader ? rowsArray.slice(1) : rowsArray

    processExcelRows(dataRows, headers)
  }

  // بررسی شرط خط تولید برای فیلد
  const isInputConditionDisabled = (inp: { conditions?: { lines?: number[] } }, rowLine: string) => {
    const condLines = inp.conditions?.lines
    if (!condLines || condLines.length === 0) return false
    const lineId = Number(rowLine)
    if (!lineId || !condLines.includes(lineId)) return true
    return false
  }

  // اعتبارسنجی یک ردیف قبل از ارسال
  const validateRow = (row: BulkRow, index: number): string | null => {
    if (!row.date_from || !row.date_from.trim()) {
      return `ردیف ${index + 1}: وارد کردن تاریخ شمسی الزامی است.`
    }
    const isoFrom = jalaliSlashToIso(row.date_from)
    if (!isoFrom) {
      return `ردیف ${index + 1}: تاریخ شمسی وارد شده «${row.date_from}» نامعتبر است. فرمت معتبر: سال/ماه/روز (مثال: 1403/08/30)`
    }

    if (!isDaily && row.date_to) {
      const isoTo = jalaliSlashToIso(row.date_to)
      if (!isoTo) {
        return `ردیف ${index + 1}: فیلد «تا تاریخ» نامعتبر است (مثال معتبر: 1403/08/30)`
      }
    }

    if (lineMode === 'required' && !row.line) {
      return `ردیف ${index + 1}: انتخاب خط تولید الزامی است.`
    }
    if (contractorMode === 'required' && !row.contractor) {
      return `ردیف ${index + 1}: انتخاب پیمانکار الزامی است.`
    }
    if (hourMode === 'required' && !row.hour) {
      return `ردیف ${index + 1}: وارد کردن ساعت ثبت الزامی است.`
    }

    for (const inp of schema?.inputs ?? []) {
      const isCondDisabled = isInputConditionDisabled(inp, row.line)
      if (inp.required && !isCondDisabled) {
        const v = row.inputs[inp.key]
        if (v === '' || v === null || v === undefined) {
          return `ردیف ${index + 1}: ورودی «${inp.name}» الزامی است.`
        }
      }
    }
    return null
  }

  // ثبت دسته‌ای ردیف‌ها در بک‌اند
  const handleSubmitAll = async () => {
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

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      updateRow(i, { status: 'pending', error: undefined })
      setProgress({ current: i + 1, total: rows.length })

      const cleanedInputs: Record<string, any> = {}
      for (const inp of schema?.inputs ?? []) {
        const isCondDisabled = isInputConditionDisabled(inp, row.line)
        if (isCondDisabled) {
          cleanedInputs[inp.key] = 0
        } else {
          const raw = row.inputs[inp.key]
          if (raw === '' || raw === null || raw === undefined) {
            if (inp.required) cleanedInputs[inp.key] = inp.type === 'number' ? 0 : ''
          } else if (inp.type === 'number') {
            cleanedInputs[inp.key] = Number(raw) || 0
          } else {
            cleanedInputs[inp.key] = raw
          }
        }
      }

      // تبدیل تاریخ شمسی اسلش‌دار کاربر به میلادی استاندارد YYYY-MM-DD برای دیتابیس جنگو
      const isoFrom = jalaliSlashToIso(row.date_from)!
      const isoTo = isDaily ? isoFrom : (jalaliSlashToIso(row.date_to) || isoFrom)

      const payload: FactoryTabRecordPayload = {
        tab: tab.id,
        line_id: lineMode !== 'disabled' && row.line ? Number(row.line) : null,
        contractor_id: contractorMode !== 'disabled' && row.contractor ? Number(row.contractor) : null,
        date_from: isoFrom,
        date_to: isoTo,
        inputs: cleanedInputs,
      }
      if (hourMode !== 'disabled' && row.hour) {
        payload.hour = row.hour
      }

      try {
        await createFactoryTabRecord(payload)
        updateRow(i, { status: 'success', error: undefined })
        successCount++
      } catch (e: any) {
        failCount++
        const errMsg =
          e?.response?.data?.errors?.detail ||
          e?.response?.data?.detail ||
          (typeof e?.response?.data === 'string' ? e.response.data : null) ||
          e?.message ||
          'خطا در ثبت'
        updateRow(i, { status: 'error', error: typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg) })
      }
    }

    setSubmitting(false)

    if (failCount === 0) {
      notify(`تمام ${successCount} رکورد با موفقیت در دیتابیس ثبت شدند`)
      onSuccess()
      onClose()
    } else {
      notify(`${successCount} رکورد با موفقیت ثبت شد، ولی ${failCount} رکورد با خطا مواجه شد. ردیف‌های خطا را بررسی کنید.`, 'error')
      onSuccess()
    }
  }

  // انتخاب تاریخ از تقویم شناور ردیف
  const pickCalendarDate = (jy: number, jm: number, jd: number) => {
    if (!rowCalendarTarget) return
    const formatted = formatJalaliSlash(jy, jm, jd)
    const { rowIdx, field } = rowCalendarTarget
    if (field === 'date_from') {
      updateRow(rowIdx, {
        date_from: formatted,
        date_to: isDaily ? formatted : rows[rowIdx]?.date_to,
      })
    } else {
      updateRow(rowIdx, { date_to: formatted })
    }
    setRowCalendarTarget(null)
  }

  const openRowCalendar = (rowIdx: number, field: 'date_from' | 'date_to') => {
    const curVal = rows[rowIdx]?.[field] || todayJalali()
    const p = parseJalaliSlash(curVal) || [1403, 8, 30]
    setRowCalendarTarget({
      rowIdx,
      field,
      jy: p[0],
      jm: p[1],
      jd: p[2],
    })
  }

  return (
    <>
      <Modal
        open={open}
        onClose={submitting ? () => {} : onClose}
        title="ورود گروهی رکوردها (مدیریت ارشد)"
        subtitle={`ثبت چندگانه رکورد با تاریخ شمسی اسلش‌دار (/) برای تب «${tab.name}»`}
        size="full"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <span className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 font-bold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                <TableProperties className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                {formatNumber(rows.length)} ردیف آماده ثبت
              </span>
              {submitting && (
                <span className="flex items-center gap-2 font-bold text-brand-600 dark:text-brand-400 animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  در حال ثبت رکورد {progress.current} از {progress.total}...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost !h-10 !px-4 text-sm" onClick={onClose} disabled={submitting}>
                انصراف
              </button>
              <button
                className="btn-primary !h-10 !px-5 text-sm font-bold shadow-md hover:shadow-lg disabled:opacity-50"
                onClick={handleSubmitAll}
                disabled={submitting || rows.length === 0}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>در حال ذخیره در دیتابیس...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    <span>ثبت نهایی {formatNumber(rows.length)} رکورد</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* نوار ابزار تنظیمات سریع همگانی و ابزارهای اکسل */}
          <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/60 lg:grid-cols-12 lg:items-center">
            {/* بخش تنظیم سریع فیلدهای مشترک */}
            <div className="flex flex-wrap items-center gap-2.5 lg:col-span-7">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">تنظیم همگانی:</span>

              {/* تاریخ شمسی مشترک */}
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                <span className="px-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">تاریخ:</span>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="1403/08/30"
                  className="input !h-8 !w-28 !px-2 !py-0 text-center font-mono text-xs font-bold text-slate-800 dark:text-slate-100"
                  value={fillDate}
                  onChange={(e) => setFillDate(normalizePersianDigits(e.target.value))}
                />
                <button
                  type="button"
                  onClick={() => setFillDate(todayJalali())}
                  className="btn-ghost !h-8 !px-2 text-[11px] font-bold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  title="تنظیم به تاریخ امروز"
                >
                  امروز
                </button>
                <button
                  type="button"
                  onClick={applyDateToAll}
                  className="btn-primary !h-8 !px-2.5 text-xs font-bold"
                  title="اعمال این تاریخ به تمام ردیف‌ها"
                >
                  اعمال به همه
                </button>
              </div>

              {/* خط تولید مشترک */}
              {lineMode !== 'disabled' && (
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                  <span className="px-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">خط:</span>
                  <select
                    className="input !h-8 !w-28 !px-1.5 !py-0 text-xs font-medium"
                    value={fillLine}
                    onChange={(e) => setFillLine(e.target.value)}
                  >
                    <option value="">انتخاب خط...</option>
                    {linesList.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applyLineToAll}
                    disabled={!fillLine}
                    className="btn-ghost !h-8 !px-2 text-xs font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400"
                  >
                    اعمال
                  </button>
                </div>
              )}

              {/* پیمانکار مشترک */}
              {contractorMode !== 'disabled' && (
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                  <span className="px-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">پیمانکار:</span>
                  <select
                    className="input !h-8 !w-28 !px-1.5 !py-0 text-xs font-medium"
                    value={fillContractor}
                    onChange={(e) => setFillContractor(e.target.value)}
                  >
                    <option value="">انتخاب...</option>
                    {contractorsList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={applyContractorToAll}
                    disabled={!fillContractor}
                    className="btn-ghost !h-8 !px-2 text-xs font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400"
                  >
                    اعمال
                  </button>
                </div>
              )}

              {/* ساعت مشترک */}
              {hourMode !== 'disabled' && (
                <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                  <span className="px-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">ساعت:</span>
                  <input
                    type="time"
                    className="input !h-8 !w-20 !px-1 !py-0 text-center font-mono text-xs font-bold"
                    value={fillHour}
                    onChange={(e) => setFillHour(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={applyHourToAll}
                    disabled={!fillHour}
                    className="btn-ghost !h-8 !px-2 text-xs font-bold text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400"
                  >
                    اعمال
                  </button>
                </div>
              )}
            </div>

            {/* بخش امکانات اکسل و کنترل ردیف‌ها */}
            <div className="flex flex-wrap items-center justify-end gap-1.5 lg:col-span-5">
              {/* کلید دانلود قالب اکسل پیش‌فرض */}
              <button
                type="button"
                onClick={handleDownloadTemplate}
                className="btn-ghost !h-8.5 !px-2.5 text-xs font-bold border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50"
                title="دانلود قالب اکسل نمونه با فرمت صحیح تاریخ شمسی اسلش‌دار و سرستون‌ها"
              >
                <Download className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>قالب اکسل پیش‌فرض</span>
              </button>

              {/* ورودی مخفی فایل اکسل */}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx, .xls, .csv"
                className="hidden"
                onChange={handleFileUpload}
              />

              {/* کلید آپلود مستقیم فایل اکسل */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost !h-8.5 !px-2.5 text-xs font-bold border border-sky-300 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300 dark:hover:bg-sky-900/50"
                title="بارگذاری مستقیم فایل اکسل (.xlsx / .xls)"
              >
                <Upload className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                <span>بارگذاری فایل اکسل</span>
              </button>

              {/* کلید باز کردن مودال پیست از اکسل */}
              <button
                type="button"
                onClick={() => setExcelModalOpen(true)}
                className="btn-secondary !h-8.5 !px-2.5 text-xs font-bold text-brand-700 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-slate-800"
                title="چسباندن متن کپی‌شده از سلول‌های اکسل"
              >
                <ClipboardPaste className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
                <span>پیست از اکسل</span>
              </button>

              <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

              <button
                type="button"
                onClick={() => addRows(1)}
                className="btn-ghost !h-8.5 !px-2 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                title="افزودن ۱ ردیف جدید"
              >
                <Plus className="h-3.5 w-3.5" /> ۱+
              </button>
              <button
                type="button"
                onClick={() => addRows(5)}
                className="btn-ghost !h-8.5 !px-2 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                title="افزودن ۵ ردیف جدید"
              >
                <Plus className="h-3.5 w-3.5" /> ۵+
              </button>
              <button
                type="button"
                onClick={() => setRows([createEmptyRow()])}
                className="btn-ghost !h-8.5 !px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                title="پاک‌سازی همه ردیف‌ها و شروع مجدد"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* راهنمای تاریخ شمسی با اسلش */}
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>ورود تاریخ شمسی با اسلش (/):</strong> تاریخ‌ها را به شکل شمسی با علامت اسلش وارد کنید (مثال: <code className="font-mono font-bold bg-white/70 dark:bg-black/30 px-1 rounded">1403/08/30</code>). سیستم به طور خودکار تاریخ‌های واردشده از اکسل، پیست یا تایپ دستی را با اسلش تطبیق داده و خروجی‌ها را محاسبه می‌کند.
            </span>
          </div>

          {/* جدول اصلی ورود داده‌ها */}
          <div className="max-h-[64vh] overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-right text-xs">
              <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100/95 shadow-xs backdrop-blur-md dark:border-slate-800 dark:bg-slate-850/95">
                <tr>
                  {/* شماره ردیف و وضعیت */}
                  <th className="w-12 px-2 py-3 text-center font-extrabold text-slate-600 dark:text-slate-300">#</th>

                  {/* ستون تاریخ شمسی */}
                  <th className="min-w-[155px] px-3 py-3 font-extrabold text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>تاریخ شمسی (با /) *</span>
                    </div>
                  </th>

                  {/* تا تاریخ */}
                  {!isDaily && (
                    <th className="min-w-[155px] px-3 py-3 font-extrabold text-slate-700 dark:text-slate-200">
                      <span>تا تاریخ شمسی</span>
                    </th>
                  )}

                  {/* ساعت */}
                  {hourMode !== 'disabled' && (
                    <th className="min-w-[100px] px-2.5 py-3 font-extrabold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3.5 w-3.5 text-slate-500" />
                        <span>ساعت {hourMode === 'required' ? '*' : ''}</span>
                      </div>
                    </th>
                  )}

                  {/* خط تولید */}
                  {lineMode !== 'disabled' && (
                    <th className="min-w-[160px] px-3 py-3 font-extrabold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1">
                        <Layers className="h-3.5 w-3.5 text-slate-500" />
                        <span>خط تولید {lineMode === 'required' ? '*' : ''}</span>
                      </div>
                    </th>
                  )}

                  {/* پیمانکار */}
                  {contractorMode !== 'disabled' && (
                    <th className="min-w-[160px] px-3 py-3 font-extrabold text-slate-700 dark:text-slate-200">
                      <div className="flex items-center gap-1">
                        <Wrench className="h-3.5 w-3.5 text-slate-500" />
                        <span>پیمانکار {contractorMode === 'required' ? '*' : ''}</span>
                      </div>
                    </th>
                  )}

                  {/* ستون‌های ورودی‌های تعریف‌شده (آبی) */}
                  {(schema?.inputs ?? []).map((inp) => (
                    <th
                      key={inp.key}
                      className="min-w-[140px] px-3 py-3 font-extrabold text-sky-900 bg-sky-50/70 border-x border-sky-100 dark:bg-sky-950/30 dark:text-sky-200 dark:border-sky-900/40"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="truncate" title={inp.name}>{inp.name}</span>
                        {inp.required && <span className="text-rose-500 font-bold">*</span>}
                        {inp.unit && (
                          <span className="rounded bg-sky-100 px-1 py-0.5 text-[10px] font-semibold text-sky-700 dark:bg-sky-900/60 dark:text-sky-300">
                            {inp.unit}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}

                  {/* ستون‌های خروجی‌های محاسبه‌شده زنده (سبز زمردی) */}
                  {outputsList.map((out) => (
                    <th
                      key={out.key}
                      className="min-w-[130px] px-3 py-3 font-extrabold text-emerald-900 bg-emerald-50/80 border-x border-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-900/40"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 truncate">
                          <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate" title={out.name}>{out.name}</span>
                        </div>
                        {out.unit && (
                          <span className="rounded bg-emerald-100 px-1 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300">
                            {out.unit}
                          </span>
                        )}
                      </div>
                    </th>
                  ))}

                  {/* عملیات */}
                  <th className="w-20 px-2 py-3 text-center font-extrabold text-slate-600 dark:text-slate-300">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800 font-medium">
                {rows.map((row, rIdx) => {
                  const rowLineId = row.line ? Number(row.line) : null
                  const computedOutputs = computeRowOutputs(outputsList, row.inputs, rowLineId)
                  const isDateValid = Boolean(jalaliSlashToIso(row.date_from))

                  return (
                    <tr
                      key={row.id}
                      className={`transition ${
                        row.status === 'success'
                          ? 'bg-emerald-50/60 dark:bg-emerald-950/30'
                          : row.status === 'error'
                          ? 'bg-rose-50/60 dark:bg-rose-950/30'
                          : rIdx % 2 === 1
                          ? 'bg-slate-50/40 dark:bg-slate-850/40'
                          : 'bg-white dark:bg-slate-900'
                      } hover:bg-brand-50/40 dark:hover:bg-slate-800/50`}
                    >
                      {/* ستون شماره و وضعیت */}
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {row.status === 'pending' ? (
                            <Loader2 className="h-4 w-4 animate-spin text-brand-600" />
                          ) : row.status === 'success' ? (
                            <span title="با موفقیت در دیتابیس ثبت شد">
                              <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            </span>
                          ) : row.status === 'error' ? (
                            <span title={row.error || 'خطا در ثبت رکورد'}>
                              <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                            </span>
                          ) : (
                            <span className="font-mono text-xs font-bold text-slate-400 dark:text-slate-500">
                              {rIdx + 1}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* تاریخ شمسی با اسلش */}
                      <td className="px-2 py-2">
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="1403/08/30"
                            className={`w-full h-9 rounded-lg border px-2 text-center font-mono text-xs font-bold transition focus:ring-2 ${
                              !isDateValid
                                ? 'border-rose-300 bg-rose-50/40 text-rose-800 focus:border-rose-500 focus:ring-rose-200 dark:border-rose-700 dark:bg-rose-950/30 dark:text-rose-300'
                                : 'border-slate-300 bg-white text-slate-800 focus:border-brand-500 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                            }`}
                            value={row.date_from}
                            onChange={(e) => {
                              const val = normalizePersianDigits(e.target.value)
                              updateRow(rIdx, {
                                date_from: val,
                                date_to: isDaily ? val : row.date_to,
                              })
                            }}
                            onBlur={() => {
                              const p = parseJalaliSlash(row.date_from)
                              if (p) {
                                const formatted = formatJalaliSlash(p[0], p[1], p[2])
                                updateRow(rIdx, {
                                  date_from: formatted,
                                  date_to: isDaily ? formatted : row.date_to,
                                })
                              }
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => openRowCalendar(rIdx, 'date_from')}
                            className="btn-ghost !h-9 !w-8 !min-w-[32px] !p-0 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                            title="انتخاب روز از تقویم"
                          >
                            <Calendar className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* تا تاریخ شمسی (برای تب‌های بازه‌ای) */}
                      {!isDaily && (
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              dir="ltr"
                              placeholder="1403/08/30"
                              className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-center font-mono text-xs font-bold text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                              value={row.date_to}
                              onChange={(e) => {
                                const val = normalizePersianDigits(e.target.value)
                                updateRow(rIdx, { date_to: val })
                              }}
                              onBlur={() => {
                                const p = parseJalaliSlash(row.date_to)
                                if (p) {
                                  updateRow(rIdx, { date_to: formatJalaliSlash(p[0], p[1], p[2]) })
                                }
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => openRowCalendar(rIdx, 'date_to')}
                              className="btn-ghost !h-9 !w-8 !min-w-[32px] !p-0 text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                              title="انتخاب روز از تقویم"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      )}

                      {/* ساعت */}
                      {hourMode !== 'disabled' && (
                        <td className="px-2 py-2">
                          <input
                            type="time"
                            className="w-full h-9 rounded-lg border border-slate-300 bg-white px-1.5 text-center font-mono text-xs font-bold text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            value={row.hour}
                            onChange={(e) => updateRow(rIdx, { hour: e.target.value })}
                          />
                        </td>
                      )}

                      {/* خط تولید */}
                      {lineMode !== 'disabled' && (
                        <td className="px-2 py-2">
                          <select
                            className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            value={row.line}
                            onChange={(e) => updateRow(rIdx, { line: e.target.value })}
                          >
                            <option value="">{lineMode === 'required' ? 'انتخاب خط...' : 'بدون خط'}</option>
                            {linesList.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* پیمانکار */}
                      {contractorMode !== 'disabled' && (
                        <td className="px-2 py-2">
                          <select
                            className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            value={row.contractor}
                            onChange={(e) => updateRow(rIdx, { contractor: e.target.value })}
                          >
                            <option value="">{contractorMode === 'required' ? 'انتخاب پیمانکار...' : 'بدون پیمانکار'}</option>
                            {contractorsList.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* ورودی‌های داینامیک */}
                      {(schema?.inputs ?? []).map((inp) => {
                        const isCondDisabled = isInputConditionDisabled(inp, row.line)
                        const val = isCondDisabled ? 0 : row.inputs[inp.key] ?? ''

                        return (
                          <td key={inp.key} className="px-2 py-2 bg-sky-50/20 dark:bg-sky-950/10">
                            {isCondDisabled ? (
                              <div
                                className="flex h-9 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 bg-slate-100 text-xs font-semibold text-slate-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-500"
                                title="این ورودی برای خط تولید انتخابی غیرفعال است و مقدار صفر ثبت خواهد شد"
                              >
                                غیرفعال (۰)
                              </div>
                            ) : inp.type === 'select' ? (
                              <select
                                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-medium text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                value={String(val)}
                                onChange={(e) => updateRowInput(rIdx, inp.key, e.target.value)}
                              >
                                <option value="">انتخاب...</option>
                                {(inp.options ?? []).map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type={inp.type === 'number' ? 'number' : 'text'}
                                step="any"
                                placeholder={inp.unit ? `مقدار (${inp.unit})` : 'مقدار'}
                                className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-left font-mono text-xs font-medium text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                                value={val}
                                onChange={(e) => updateRowInput(rIdx, inp.key, e.target.value)}
                              />
                            )}
                          </td>
                        )
                      })}

                      {/* خروجی‌های داینامیک محاسبه‌شده زنده */}
                      {outputsList.map((out) => {
                        const outVal = computedOutputs[out.key]
                        const isCondDisabled = isInputConditionDisabled(out, row.line)

                        return (
                          <td key={out.key} className="px-2 py-2 bg-emerald-50/30 dark:bg-emerald-950/20">
                            <div className="flex h-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/70 px-2.5 font-mono text-xs font-extrabold text-emerald-800 shadow-2xs dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-300">
                              <span>
                                {isCondDisabled
                                  ? '۰'
                                  : outVal !== null && outVal !== undefined
                                  ? formatNumber(outVal, 2)
                                  : '—'}
                              </span>
                              {out.unit && <span className="mr-1 text-[10px] font-normal opacity-75">{out.unit}</span>}
                            </div>
                          </td>
                        )
                      })}

                      {/* کلیدهای عملیات ردیف */}
                      <td className="px-2 py-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRow(rIdx)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"
                            title="تکثیر این ردیف"
                          >
                            <Copy className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(rIdx)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40"
                            title="حذف این ردیف"
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

      {/* مودال تقویم شناور برای انتخاب تاریخ یک ردیف */}
      {rowCalendarTarget && (
        <Modal
          open={true}
          onClose={() => setRowCalendarTarget(null)}
          title="انتخاب تاریخ شمسی"
          subtitle={`ردیف ${rowCalendarTarget.rowIdx + 1} — فرمت ذخیره: سال/ماه/روز`}
          size="md"
        >
          <div className="space-y-3 p-1">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                {PERSIAN_MONTHS[rowCalendarTarget.jm - 1]} {rowCalendarTarget.jy}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="btn-ghost !h-7 !px-2 text-xs"
                  onClick={() => {
                    let nextM = rowCalendarTarget.jm - 1
                    let nextY = rowCalendarTarget.jy
                    if (nextM < 1) {
                      nextM = 12
                      nextY--
                    }
                    setRowCalendarTarget((prev) => (prev ? { ...prev, jy: nextY, jm: nextM } : null))
                  }}
                >
                  ماه قبل
                </button>
                <button
                  type="button"
                  className="btn-ghost !h-7 !px-2 text-xs"
                  onClick={() => {
                    let nextM = rowCalendarTarget.jm + 1
                    let nextY = rowCalendarTarget.jy
                    if (nextM > 12) {
                      nextM = 1
                      nextY++
                    }
                    setRowCalendarTarget((prev) => (prev ? { ...prev, jy: nextY, jm: nextM } : null))
                  }}
                >
                  ماه بعد
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 text-center font-mono text-xs">
              {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((w) => (
                <div key={w} className="py-1 font-bold text-slate-400">
                  {w}
                </div>
              ))}
              {(() => {
                const [gy, gm, gd] = jalaliToGregorian(rowCalendarTarget.jy, rowCalendarTarget.jm, 1)
                const dow = new Date(Date.UTC(gy, gm - 1, gd)).getUTCDay()
                const offset = dow === 6 ? 0 : dow + 1
                const daysInMonth = jalaliDaysInMonth(rowCalendarTarget.jy, rowCalendarTarget.jm)
                const cells = []
                for (let i = 0; i < offset; i++) cells.push(<div key={`empty-${i}`} />)
                for (let d = 1; d <= daysInMonth; d++) {
                  const isSel = d === rowCalendarTarget.jd
                  cells.push(
                    <button
                      key={d}
                      type="button"
                      onClick={() => pickCalendarDate(rowCalendarTarget.jy, rowCalendarTarget.jm, d)}
                      className={`h-8 rounded-lg font-bold transition ${
                        isSel
                          ? 'bg-brand-600 text-white'
                          : 'hover:bg-slate-100 text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      {d}
                    </button>,
                  )
                }
                return cells
              })()}
            </div>

            <div className="flex items-center justify-between border-t pt-2 text-xs">
              <button
                type="button"
                className="btn-ghost !h-7 !px-2 text-brand-600 font-bold"
                onClick={() => {
                  const p = parseJalaliSlash(todayJalali()) || [1403, 8, 30]
                  pickCalendarDate(p[0], p[1], p[2])
                }}
              >
                امروز
              </button>
              <button
                type="button"
                className="btn-ghost !h-7 !px-2 text-slate-500"
                onClick={() => setRowCalendarTarget(null)}
              >
                بستن
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* مودال چسباندن و بارگذاری اکسل */}
      <Modal
        open={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        title="چسباندن داده‌ها از اکسل یا بارگذاری فایل"
        subtitle="متن کپی‌شده از سلول‌های اکسل را اینجا پیست کنید یا فایل اکسل خود را انتخاب نمایید"
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-slate-500">
              {pasteText.trim().split(/\r?\n/).filter(Boolean).length} خط آماده پردازش
            </span>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={() => setExcelModalOpen(false)}>
                انصراف
              </button>
              <button className="btn-primary" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
                درون‌ریزی متن به جدول
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:border-emerald-800/60">
            <div>
              <span className="font-bold">پیشنهاد:</span> از دکمه «دانلود قالب اکسل پیش‌فرض» استفاده کنید تا سرستون‌ها و فرمت تاریخ شمسی با اسلش دقیقاً منطبق باشد.
            </div>
            <button
              type="button"
              onClick={handleDownloadTemplate}
              className="btn-secondary !h-7.5 !px-2.5 text-xs font-bold border-emerald-400 bg-white text-emerald-800 hover:bg-emerald-100"
            >
              <Download className="h-3.5 w-3.5" /> دانلود قالب اکسل نمونه
            </button>
          </div>

          <div>
            <label className="label mb-1">چسباندن متن سلول‌های اکسل (Ctrl+V):</label>
            <textarea
              className="input h-48 w-full font-mono text-xs leading-relaxed"
              dir="ltr"
              placeholder={'1403/08/30\t08:00\t150\t24.5\n1403/08/30\t14:00\t180\t28.0'}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </>
  )
}
