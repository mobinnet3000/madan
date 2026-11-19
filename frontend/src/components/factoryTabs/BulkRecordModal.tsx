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
} from 'lucide-react'
import Modal from '../ui/Modal'
import JalaliDateInput from '../ui/JalaliDateInput'
import { useToast } from '../ui/Toast'
import { useFactory } from '../../store/FactoryContext'
import { createFactoryTabRecord, getFactoryTabSchema } from '../../api/factoryTabs'
import type { FactoryTabBrief, FactoryTabSchema, FactoryTabRecordPayload } from '../../types'
import { formatDate, formatNumber, todayISO, round2, classNames } from '../../utils'
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
  date_from: string
  date_to: string
  hour: string
  line: string
  contractor: string
  inputs: Record<string, string | number>
  status: 'idle' | 'pending' | 'success' | 'error'
  error?: string
}

let nextId = 1
const genId = () => `row_${Date.now()}_${nextId++}`

export default function BulkRecordModal({ open, onClose, tab, schema: propSchema, onSuccess }: Props) {
  const { notify } = useToast()
  const { selectedFactory } = useFactory()
  const [loadedSchema, setLoadedSchema] = useState<FactoryTabSchema | null>(propSchema)

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

  const linesList = useMemo(() => {
    return schema?.lines?.length ? schema.lines : (selectedFactory?.lines ?? [])
  }, [schema?.lines, selectedFactory?.lines])

  const contractorsList = useMemo(() => {
    return schema?.contractor?.options?.length ? schema.contractor.options : (selectedFactory?.contractors ?? [])
  }, [schema?.contractor?.options, selectedFactory?.contractors])

  const outputsList = useMemo(() => {
    return (tab.outputs && tab.outputs.length > 0) ? tab.outputs : (schema?.outputs ?? [])
  }, [tab.outputs, schema?.outputs])

  // --- Fixed vs Per-Row Settings ---
  // Line
  const [isLineFixed, setIsLineFixed] = useState(false)
  const [fixedLineId, setFixedLineId] = useState<string>('')

  // Contractor
  const [isContractorFixed, setIsContractorFixed] = useState(false)
  const [fixedContractorId, setFixedContractorId] = useState<string>('')

  // Date
  const [isDateFixed, setIsDateFixed] = useState(true)
  const [fixedDate, setFixedDate] = useState<string>(todayISO())

  // Hour
  const [isHourFixed, setIsHourFixed] = useState(false)
  const [fixedHour, setFixedHour] = useState<string>('')

  // Automatically select first line / contractor as default when fixed is toggled
  useEffect(() => {
    if (isLineFixed && !fixedLineId && linesList.length > 0) {
      setFixedLineId(String(linesList[0].id))
    }
  }, [isLineFixed, fixedLineId, linesList])

  useEffect(() => {
    if (isContractorFixed && !fixedContractorId && contractorsList.length > 0) {
      setFixedContractorId(String(contractorsList[0].id))
    }
  }, [isContractorFixed, fixedContractorId, contractorsList])

  const createEmptyRow = useCallback(
    (defaultDate = todayISO(), defaultLine = '', defaultContractor = ''): BulkRow => {
      const inputsInit: Record<string, string | number> = {}
      ;(schema?.inputs ?? []).forEach((inp) => {
        inputsInit[inp.key] = ''
      })
      return {
        id: genId(),
        date_from: isDateFixed && fixedDate ? fixedDate : defaultDate,
        date_to: isDateFixed && fixedDate ? fixedDate : defaultDate,
        hour: isHourFixed && fixedHour ? fixedHour : '',
        line: isLineFixed && fixedLineId ? fixedLineId : defaultLine,
        contractor: isContractorFixed && fixedContractorId ? fixedContractorId : defaultContractor,
        inputs: inputsInit,
        status: 'idle',
      }
    },
    [schema, isDateFixed, fixedDate, isHourFixed, fixedHour, isLineFixed, fixedLineId, isContractorFixed, fixedContractorId],
  )

  const [rows, setRows] = useState<BulkRow[]>(() => [createEmptyRow(), createEmptyRow(), createEmptyRow()])

  // Sync inputs keys if schema loads asynchronously
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

  // Excel / Paste Modal states
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Add rows
  const addRows = (count: number) => {
    const last = rows[rows.length - 1]
    const defDate = isDateFixed && fixedDate ? fixedDate : (last ? last.date_from : todayISO())
    const defLine = isLineFixed && fixedLineId ? fixedLineId : (last ? last.line : '')
    const defContractor = isContractorFixed && fixedContractorId ? fixedContractorId : (last ? last.contractor : '')
    const newRows: BulkRow[] = []
    for (let i = 0; i < count; i++) {
      newRows.push(createEmptyRow(defDate, defLine, defContractor))
    }
    setRows((prev) => [...prev, ...newRows])
  }

  // Duplicate a row
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

  // Remove a row
  const removeRow = (idx: number) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow()])
      return
    }
    setRows((prev) => prev.filter((_, i) => i !== idx))
  }

  // Update a row field
  const updateRow = (idx: number, patch: Partial<BulkRow>) => {
    setRows((prev) => {
      const copy = [...prev]
      copy[idx] = { ...copy[idx], ...patch }
      return copy
    })
  }

  // Update a specific input in a row
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

  // Copy a specific field down to all rows below
  const copyDownField = (fromIdx: number, field: 'line' | 'contractor' | 'date_from' | 'hour' | string) => {
    const sourceVal = field === 'line' ? rows[fromIdx].line
      : field === 'contractor' ? rows[fromIdx].contractor
      : field === 'date_from' ? rows[fromIdx].date_from
      : field === 'hour' ? rows[fromIdx].hour
      : rows[fromIdx].inputs[field]

    setRows((prev) => {
      return prev.map((r, i) => {
        if (i <= fromIdx) return r
        if (field === 'line') return { ...r, line: sourceVal as string }
        if (field === 'contractor') return { ...r, contractor: sourceVal as string }
        if (field === 'date_from') return { ...r, date_from: sourceVal as string, date_to: isDaily ? sourceVal as string : r.date_to }
        if (field === 'hour') return { ...r, hour: sourceVal as string }
        return {
          ...r,
          inputs: { ...r.inputs, [field]: sourceVal },
        }
      })
    })
    notify('مقدار این ستون به تمام ردیف‌های پایین اعمال شد', 'success')
  }

  // Check if an input is disabled for a row due to line condition
  const isInputConditionDisabled = (inp: { conditions?: { lines?: number[] } }, rowLine: string) => {
    const condLines = inp.conditions?.lines
    if (!condLines || condLines.length === 0) return false
    const lineId = Number(rowLine)
    if (!lineId || !condLines.includes(lineId)) return true
    return false
  }

  // Effective row values considering fixed switches
  const getEffectiveLine = (row: BulkRow) => (isLineFixed ? fixedLineId : row.line)
  const getEffectiveContractor = (row: BulkRow) => (isContractorFixed ? fixedContractorId : row.contractor)
  const getEffectiveDate = (row: BulkRow) => (isDateFixed ? fixedDate : row.date_from)
  const getEffectiveHour = (row: BulkRow) => (isHourFixed ? fixedHour : row.hour)

  // Validation function
  const validateRow = (row: BulkRow, index: number): string | null => {
    const effectiveDate = getEffectiveDate(row)
    const effectiveLine = getEffectiveLine(row)
    const effectiveContractor = getEffectiveContractor(row)
    const effectiveHour = getEffectiveHour(row)

    if (!effectiveDate) return `ردیف ${index + 1}: تاریخ الزامی است.`
    if (lineMode === 'required' && !effectiveLine) return `ردیف ${index + 1}: انتخاب خط تولید الزامی است.`
    if (contractorMode === 'required' && !effectiveContractor) return `ردیف ${index + 1}: انتخاب پیمانکار الزامی است.`
    if (hourMode === 'required' && !effectiveHour) return `ردیف ${index + 1}: ساعت ثبت الزامی است.`

    for (const inp of schema?.inputs ?? []) {
      const isCondDisabled = isInputConditionDisabled(inp, effectiveLine)
      if (inp.required && !isCondDisabled) {
        const v = row.inputs[inp.key]
        if (v === '' || v === null || v === undefined) {
          return `ردیف ${index + 1}: ورودی «${inp.name}» الزامی است.`
        }
      }
    }
    return null
  }

  // Submit all rows to backend
  const handleSubmitAll = async () => {
    // 1. Validate fixed values first
    if (isDateFixed && !fixedDate) {
      notify('لطفاً تاریخ ثابت را در کادر تنظیمات سراسری وارد کنید.', 'error')
      return
    }
    if (isLineFixed && lineMode === 'required' && !fixedLineId) {
      notify('لطفاً خط تولید ثابت را انتخاب کنید.', 'error')
      return
    }
    if (isContractorFixed && contractorMode === 'required' && !fixedContractorId) {
      notify('لطفاً پیمانکار ثابت را انتخاب کنید.', 'error')
      return
    }

    // 2. Validate each row
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

      const effLine = getEffectiveLine(row)
      const effContractor = getEffectiveContractor(row)
      const effDate = getEffectiveDate(row)
      const effHour = getEffectiveHour(row)

      // Build payload
      const cleanedInputs: Record<string, any> = {}

      for (const inp of schema?.inputs ?? []) {
        const isCondDisabled = isInputConditionDisabled(inp, effLine)
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

      const payload: FactoryTabRecordPayload = {
        tab: tab.id,
        line_id: lineMode !== 'disabled' && effLine ? Number(effLine) : null,
        contractor_id: contractorMode !== 'disabled' && effContractor ? Number(effContractor) : null,
        date_from: effDate,
        date_to: isDaily ? effDate : (isDateFixed ? effDate : (row.date_to || effDate)),
        inputs: cleanedInputs,
      }
      if (hourMode !== 'disabled' && effHour) {
        payload.hour = effHour
      }

      try {
        await createFactoryTabRecord(payload)
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
      notify(`تمام ${successCount} رکورد با موفقیت ثبت شدند`, 'success')
      onSuccess()
      onClose()
    } else {
      notify(`${successCount} رکورد با موفقیت ثبت شد، ولی ${failCount} رکورد با خطا مواجه شد.`, 'error')
      onSuccess()
    }
  }

  // Direct Excel File Upload
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

      // Detect header row (first non-empty row)
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

      // Map headers to input fields and system fields
      const inputDefs = schema?.inputs ?? []
      const headerMap: { colIdx: number; target: string; isInput: boolean }[] = []

      headers.forEach((h, colIdx) => {
        const norm = h.toLowerCase().replace(/[\s\-_]/g, '')
        // Date check
        if (norm.includes('تاریخ') || norm === 'date' || norm === 'datefrom') {
          headerMap.push({ colIdx, target: 'date_from', isInput: false })
          return
        }
        // Hour check
        if (norm.includes('ساعت') || norm === 'hour' || norm === 'time') {
          headerMap.push({ colIdx, target: 'hour', isInput: false })
          return
        }
        // Line check
        if (norm.includes('خط') || norm === 'line') {
          headerMap.push({ colIdx, target: 'line', isInput: false })
          return
        }
        // Contractor check
        if (norm.includes('پیمانکار') || norm === 'contractor') {
          headerMap.push({ colIdx, target: 'contractor', isInput: false })
          return
        }

        // Match with schema inputs by name or key
        const matchedInput = inputDefs.find((inp) => {
          const inpNormName = inp.name.toLowerCase().replace(/[\s\-_]/g, '')
          const inpNormKey = inp.key.toLowerCase().replace(/[\s\-_]/g, '')
          return norm === inpNormName || norm === inpNormKey || norm.includes(inpNormName) || inpNormName.includes(norm)
        })

        if (matchedInput) {
          headerMap.push({ colIdx, target: matchedInput.key, isInput: true })
        }
      })

      // If headers didn't match any inputs, fallback to column order matching
      const parsedRows: BulkRow[] = []

      dataRows.forEach((rowCells) => {
        const r = createEmptyRow()

        if (headerMap.length > 0) {
          // Map by matched headers
          headerMap.forEach(({ colIdx, target, isInput }) => {
            const rawVal = rowCells[colIdx]
            if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') return

            const valStr = String(rawVal).trim()

            if (!isInput) {
              if (target === 'date_from' && !isDateFixed) {
                // normalize date
                const d = valStr.replace(/\//g, '-')
                if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
                  r.date_from = d
                  r.date_to = d
                }
              } else if (target === 'hour' && !isHourFixed) {
                if (/^\d{1,2}:\d{2}$/.test(valStr)) {
                  r.hour = valStr.length === 4 ? `0${valStr}` : valStr
                }
              } else if (target === 'line' && !isLineFixed) {
                // Find line by name or id
                const matched = linesList.find((l) => String(l.name).trim() === valStr || String(l.id) === valStr)
                if (matched) r.line = String(matched.id)
              } else if (target === 'contractor' && !isContractorFixed) {
                // Find contractor by name or id
                const matched = contractorsList.find((c) => String(c.name).trim() === valStr || String(c.id) === valStr)
                if (matched) r.contractor = String(matched.id)
              }
            } else {
              const inpDef = inputDefs.find((i) => i.key === target)
              if (inpDef?.type === 'number') {
                const cleanNum = Number(String(rawVal).replace(/[^\d.-]/g, ''))
                r.inputs[target] = isNaN(cleanNum) ? '' : cleanNum
              } else {
                r.inputs[target] = valStr
              }
            }
          })
        } else {
          // Fallback sequential mapping
          let cIdx = 0
          if (!isDateFixed && rowCells[cIdx]) {
            const d = String(rowCells[cIdx]).trim().replace(/\//g, '-')
            if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
              r.date_from = d
              r.date_to = d
              cIdx++
            }
          }
          if (!isHourFixed && hourMode !== 'disabled' && rowCells[cIdx]) {
            const h = String(rowCells[cIdx]).trim()
            if (/^\d{1,2}:\d{2}$/.test(h)) {
              r.hour = h.length === 4 ? `0${h}` : h
              cIdx++
            }
          }
          if (!isLineFixed && lineMode !== 'disabled' && rowCells[cIdx]) {
            const lVal = String(rowCells[cIdx]).trim()
            const matched = linesList.find((l) => String(l.name).trim() === lVal || String(l.id) === lVal)
            if (matched) {
              r.line = String(matched.id)
              cIdx++
            }
          }
          if (!isContractorFixed && contractorMode !== 'disabled' && rowCells[cIdx]) {
            const cVal = String(rowCells[cIdx]).trim()
            const matched = contractorsList.find((c) => String(c.name).trim() === cVal || String(c.id) === cVal)
            if (matched) {
              r.contractor = String(matched.id)
              cIdx++
            }
          }

          inputDefs.forEach((inp) => {
            if (rowCells[cIdx] !== undefined) {
              const val = String(rowCells[cIdx]).trim()
              if (inp.type === 'number') {
                const num = Number(val.replace(/[^\d.-]/g, ''))
                r.inputs[inp.key] = isNaN(num) ? '' : num
              } else {
                r.inputs[inp.key] = val
              }
              cIdx++
            }
          })
        }

        parsedRows.push(r)
      })

      if (parsedRows.length > 0) {
        setRows(parsedRows)
        notify(`${parsedRows.length} سطر از فایل اکسل با موفقیت وارد شد`, 'success')
      }
    } catch (err: any) {
      notify(`خطا در پردازش فایل اکسل: ${err.message || 'نامشخص'}`, 'error')
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Paste handler
  const handlePasteSubmit = () => {
    if (!pasteText.trim()) return
    const lines = pasteText
      .trim()
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)

    if (lines.length === 0) return

    const inputDefs = schema?.inputs ?? []
    const parsedRows: BulkRow[] = []

    lines.forEach((line) => {
      const cols = line.includes('\t') ? line.split('\t') : line.split(',')
      const r = createEmptyRow()
      let cIdx = 0

      // Try Date
      if (!isDateFixed && cols[cIdx]) {
        const d = cols[cIdx].trim().replace(/\//g, '-')
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          r.date_from = d
          r.date_to = d
          cIdx++
        }
      }

      // Try Hour
      if (!isHourFixed && hourMode !== 'disabled' && cols[cIdx]) {
        const h = cols[cIdx].trim()
        if (/^\d{1,2}:\d{2}$/.test(h)) {
          r.hour = h.length === 4 ? `0${h}` : h
          cIdx++
        }
      }

      // Try Line
      if (!isLineFixed && lineMode !== 'disabled' && cols[cIdx]) {
        const lineStr = cols[cIdx].trim()
        const matched = linesList.find((l) => String(l.name) === lineStr || String(l.id) === lineStr)
        if (matched) {
          r.line = String(matched.id)
          cIdx++
        }
      }

      // Try Contractor
      if (!isContractorFixed && contractorMode !== 'disabled' && cols[cIdx]) {
        const contStr = cols[cIdx].trim()
        const matched = contractorsList.find((c) => String(c.name) === contStr || String(c.id) === contStr)
        if (matched) {
          r.contractor = String(matched.id)
          cIdx++
        }
      }

      // Fill inputs in order
      inputDefs.forEach((inp) => {
        if (cols[cIdx] !== undefined) {
          const val = cols[cIdx].trim()
          if (inp.type === 'number') {
            const num = Number(val.replace(/[^\d.-]/g, ''))
            r.inputs[inp.key] = isNaN(num) ? '' : num
          } else {
            r.inputs[inp.key] = val
          }
          cIdx++
        }
      })

      parsedRows.push(r)
    })

    if (parsedRows.length > 0) {
      setRows(parsedRows)
      setPasteModalOpen(false)
      setPasteText('')
      notify(`${parsedRows.length} ردیف با موفقیت جایگذاری شد`, 'success')
    }
  }

  // Download Sample Excel Template
  const handleDownloadTemplate = async () => {
    try {
      const XLSX = await import('xlsx')
      const headers: string[] = []
      const sampleRow: Record<string, string | number> = {}

      if (!isDateFixed) {
        headers.push('تاریخ (مثال: 1405-05-15)')
        sampleRow['تاریخ (مثال: 1405-05-15)'] = todayISO()
      }
      if (!isHourFixed && hourMode !== 'disabled') {
        headers.push('ساعت (مثال: 10:30)')
        sampleRow['ساعت (مثال: 10:30)'] = '08:00'
      }
      if (!isLineFixed && lineMode !== 'disabled') {
        headers.push('خط تولید')
        sampleRow['خط تولید'] = linesList[0]?.name || ''
      }
      if (!isContractorFixed && contractorMode !== 'disabled') {
        headers.push('پیمانکار')
        sampleRow['پیمانکار'] = contractorsList[0]?.name || ''
      }

      ;(schema?.inputs ?? []).forEach((inp) => {
        const colTitle = `${inp.name}${inp.unit ? ` (${inp.unit})` : ''}`
        headers.push(colTitle)
        sampleRow[colTitle] = inp.type === 'number' ? 100 : (inp.options?.[0] || 'نمونه')
      })

      const ws = XLSX.utils.json_to_sheet([sampleRow], { header: headers })
      ws['!cols'] = headers.map(() => ({ wch: 22 }))

      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'قالب اکسل')
      XLSX.writeFile(wb, `قالب_ورود_گروهی_${tab.name.replace(/\s+/g, '_')}.xlsx`)
      notify('قالب اکسل با موفقیت دانلود شد', 'success')
    } catch (e: any) {
      notify(`خطا در دانلود قالب: ${e.message}`, 'error')
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={submitting ? () => {} : onClose}
        title={`ورود و ثبت گروهی رکوردها — «${tab.name}»`}
        subtitle="امکان تنظیم مقادیر ثابت (سراسری)، ایمپورت مستقیم اکسل و انتخاب کشویی پیمانکار یا خط تولید در جدول"
        size="full"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 text-xs text-ink-600 dark:text-slate-300">
              <div className="flex items-center gap-1.5 rounded-lg bg-ink-100/70 px-2.5 py-1 font-bold text-ink-800 dark:bg-slate-800 dark:text-slate-200">
                <TableProperties className="h-4 w-4 text-brand-600" />
                <span>مجموع: {formatNumber(rows.length)} ردیف</span>
              </div>
              {submitting && (
                <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 font-semibold animate-pulse">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>در حال ثبت ردیف {progress.current} از {progress.total}...</span>
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
                    <span>تأیید و ثبت نهایی {formatNumber(rows.length)} رکورد</span>
                  </>
                )}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-4">
          {/* نوار تنظیمات ابعاد و مقادیر ثابت / سراسری (Presets & Fixed Modes) */}
          <div className="rounded-2xl border border-slate-200 bg-gradient-to-b from-white to-slate-50/70 p-4 shadow-xs dark:border-slate-800 dark:from-slate-900 dark:to-slate-900/80">
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 mb-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-950/60 dark:text-brand-400">
                  <Pin className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-ink-800 dark:text-slate-100">
                    تنظیمات سراسری و مقادیر ثابت
                  </h4>
                  <p className="text-[11px] text-ink-500 dark:text-slate-400">
                    اگر موردی مانند خط تولید یا تاریخ برای تمام داده‌ها یکسان است، آن را «ثابت» کنید تا جدول خلوت‌تر و ثبت سریع‌تر شود.
                  </p>
                </div>
              </div>

              {/* دکمه‌های کار با اکسل و عملیات کلی */}
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
                  title="بارگذاری فایل اکسل به طور مستقیم"
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

            {/* کنترل‌های ثابت در برابر جدولی */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {/* تاریخ */}
              <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>تاریخ رکوردها</span>
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
                    انتخاب مجزا در هر ردیف جدول
                  </div>
                )}
              </div>

              {/* خط تولید */}
              {lineMode !== 'disabled' && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-slate-400" />
                      <span>خط تولید {lineMode === 'required' ? '*' : ''}</span>
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
                        <option value="">{lineMode === 'required' ? 'انتخاب خط تولید ثابت...' : 'بدون خط تولید (اختیاری)'}</option>
                        {linesList.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="mt-1 flex h-9 items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800/40">
                      انتخاب در ستون جدول (کشویی)
                    </div>
                  )}
                </div>
              )}

              {/* پیمانکار */}
              {contractorMode !== 'disabled' && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Wrench className="h-3.5 w-3.5 text-slate-400" />
                      <span>پیمانکار {contractorMode === 'required' ? '*' : ''}</span>
                    </span>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setIsContractorFixed(true)}
                        className={classNames(
                          'px-2 py-0.5 rounded-md font-medium transition',
                          isContractorFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        )}
                      >
                        ثابت برای همه
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsContractorFixed(false)}
                        className={classNames(
                          'px-2 py-0.5 rounded-md font-medium transition',
                          !isContractorFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        )}
                      >
                        در هر ردیف
                      </button>
                    </div>
                  </div>
                  {isContractorFixed ? (
                    <div className="mt-1">
                      <select
                        className="input !h-9 w-full text-xs font-medium cursor-pointer"
                        value={fixedContractorId}
                        onChange={(e) => setFixedContractorId(e.target.value)}
                      >
                        <option value="">{contractorMode === 'required' ? 'انتخاب پیمانکار ثابت...' : 'بدون پیمانکار (اختیاری)'}</option>
                        {contractorsList.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="mt-1 flex h-9 items-center justify-center rounded-lg bg-emerald-50 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      انتخاب مجزا برای هر ردیف در جدول
                    </div>
                  )}
                </div>
              )}

              {/* ساعت */}
              {hourMode !== 'disabled' && (
                <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-2.5 dark:border-slate-800 dark:bg-slate-850">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-ink-700 dark:text-slate-200 flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                      <span>ساعت ثبت</span>
                    </span>
                    <div className="inline-flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800 text-[11px]">
                      <button
                        type="button"
                        onClick={() => setIsHourFixed(true)}
                        className={classNames(
                          'px-2 py-0.5 rounded-md font-medium transition',
                          isHourFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        )}
                      >
                        ثابت
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsHourFixed(false)}
                        className={classNames(
                          'px-2 py-0.5 rounded-md font-medium transition',
                          !isHourFixed ? 'bg-white text-brand-600 shadow-xs dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 hover:text-slate-800 dark:text-slate-400'
                        )}
                      >
                        در هر ردیف
                      </button>
                    </div>
                  </div>
                  {isHourFixed ? (
                    <div className="mt-1">
                      <input
                        type="time"
                        className="input !h-9 w-full text-center text-xs font-mono font-medium"
                        value={fixedHour}
                        onChange={(e) => setFixedHour(e.target.value)}
                      />
                    </div>
                  ) : (
                    <div className="mt-1 flex h-9 items-center justify-center rounded-lg bg-slate-50 text-[11px] text-slate-500 dark:bg-slate-800/40">
                      ثبت مجزا در ردیف‌ها
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* نوار مدیریت تعداد ردیف‌ها و اکشن‌های سریع */}
          <div className="flex flex-wrap items-center justify-between gap-3 px-1">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-ink-600 dark:text-slate-400">افزودن سطر جدید:</span>
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

          {/* جدول اصلی ورود داده‌ها (Data Grid) */}
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/80 text-right font-bold text-slate-700 dark:border-slate-800 dark:bg-slate-800/90 dark:text-slate-200">
                  <th className="w-12 px-2 py-3 text-center">#</th>

                  {/* ستون تاریخ (تنها زمانی نمایش داده می‌شود که ثابت نباشد) */}
                  {!isDateFixed && (
                    <th className="min-w-[140px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span>تاریخ *</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'date_from')}
                          title="کپی کردن تاریخ ردیف اول به تمام ردیف‌ها"
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {!isDaily && !isDateFixed && (
                    <th className="min-w-[140px] px-3 py-3">تا تاریخ</th>
                  )}

                  {/* ستون ساعت */}
                  {hourMode !== 'disabled' && !isHourFixed && (
                    <th className="min-w-[110px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span>ساعت {hourMode === 'required' ? '*' : ''}</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'hour')}
                          title="کپی کردن ساعت ردیف اول به تمام ردیف‌ها"
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {/* ستون خط تولید (اگر ثابت نباشد) */}
                  {lineMode !== 'disabled' && !isLineFixed && (
                    <th className="min-w-[170px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span>خط تولید {lineMode === 'required' ? '*' : ''}</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'line')}
                          title="کپی کردن خط تولید ردیف اول به تمام ردیف‌ها"
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {/* ستون پیمانکار (اگر ثابت نباشد) */}
                  {contractorMode !== 'disabled' && !isContractorFixed && (
                    <th className="min-w-[170px] px-3 py-3">
                      <div className="flex items-center justify-between">
                        <span className="text-emerald-700 dark:text-emerald-400">پیمانکار {contractorMode === 'required' ? '*' : ''}</span>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, 'contractor')}
                          title="کپی کردن پیمانکار ردیف اول به تمام ردیف‌ها"
                          className="text-slate-400 hover:text-emerald-600 transition"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </th>
                  )}

                  {/* ستون‌های ورودی‌های تعریف‌شده */}
                  {(schema?.inputs ?? []).map((inp) => (
                    <th key={inp.key} className="min-w-[150px] px-3 py-3 font-semibold">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1">
                          <span>{inp.name}</span>
                          {inp.required && <span className="text-rose-500 font-bold">*</span>}
                          {inp.unit && <span className="text-[10px] text-slate-500">({inp.unit})</span>}
                        </div>
                        <button
                          type="button"
                          onClick={() => copyDownField(0, inp.key)}
                          title={`کپی مقدار ردیف اول «${inp.name}» به پایین`}
                          className="text-slate-400 hover:text-brand-600 transition"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                      </div>
                    </th>
                  ))}

                  {/* ستون‌های خروجی‌های محاسباتی */}
                  {outputsList.map((out) => (
                    <th
                      key={out.key}
                      className="min-w-[130px] px-3 py-3 text-brand-700 dark:text-brand-400 bg-brand-50/50 dark:bg-brand-950/20"
                    >
                      <div className="flex items-center gap-1 font-semibold">
                        <Sparkles className="h-3 w-3 text-brand-500" />
                        <span>{out.name}</span>
                        {out.unit && <span className="text-[10px] opacity-75">({out.unit})</span>}
                      </div>
                    </th>
                  ))}

                  <th className="w-24 px-2 py-3 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row, rIdx) => {
                  const effectiveLineId = isLineFixed ? (fixedLineId ? Number(fixedLineId) : null) : (row.line ? Number(row.line) : null)
                  const computedOutputs = computeRowOutputs(outputsList, row.inputs, effectiveLineId)

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
                      {/* ستون شماره ردیف و نشانگر وضعیت */}
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

                      {/* تاریخ در هر ردیف */}
                      {!isDateFixed && (
                        <td className="px-2 py-2 align-middle">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="1405-05-15"
                            className="input !h-9 w-full text-center text-xs font-mono font-medium focus:ring-1 focus:ring-brand-500"
                            value={row.date_from}
                            onChange={(e) =>
                              updateRow(rIdx, {
                                date_from: e.target.value,
                                date_to: isDaily ? e.target.value : row.date_to,
                              })
                            }
                          />
                        </td>
                      )}

                      {!isDaily && !isDateFixed && (
                        <td className="px-2 py-2 align-middle">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="1405-05-15"
                            className="input !h-9 w-full text-center text-xs font-mono font-medium focus:ring-1 focus:ring-brand-500"
                            value={row.date_to}
                            onChange={(e) => updateRow(rIdx, { date_to: e.target.value })}
                          />
                        </td>
                      )}

                      {/* ساعت در هر ردیف */}
                      {hourMode !== 'disabled' && !isHourFixed && (
                        <td className="px-2 py-2 align-middle">
                          <input
                            type="time"
                            className="input !h-9 w-full text-center text-xs font-mono font-medium focus:ring-1 focus:ring-brand-500"
                            value={row.hour}
                            onChange={(e) => updateRow(rIdx, { hour: e.target.value })}
                          />
                        </td>
                      )}

                      {/* خط تولید در هر ردیف (انتخاب کشویی راحت) */}
                      {lineMode !== 'disabled' && !isLineFixed && (
                        <td className="px-2 py-2 align-middle">
                          <select
                            className="input !h-9 w-full text-xs font-medium cursor-pointer focus:ring-1 focus:ring-brand-500"
                            value={row.line}
                            onChange={(e) => updateRow(rIdx, { line: e.target.value })}
                          >
                            <option value="">{lineMode === 'required' ? 'انتخاب خط...' : 'بدون خط تولید'}</option>
                            {linesList.map((l) => (
                              <option key={l.id} value={l.id}>
                                {l.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* پیمانکار در هر ردیف (انتخاب کشویی راحت) */}
                      {contractorMode !== 'disabled' && !isContractorFixed && (
                        <td className="px-2 py-2 align-middle">
                          <select
                            className="input !h-9 w-full text-xs font-medium cursor-pointer border-emerald-300/80 bg-emerald-50/20 text-emerald-950 focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-200"
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

                      {/* فیلدهای ورودی طبق فرم تب */}
                      {(schema?.inputs ?? []).map((inp) => {
                        const effectiveLineStr = isLineFixed ? fixedLineId : row.line
                        const isCondDisabled = isInputConditionDisabled(inp, effectiveLineStr)
                        const val = isCondDisabled ? 0 : (row.inputs[inp.key] ?? '')

                        return (
                          <td key={inp.key} className="px-2 py-2 align-middle">
                            {isCondDisabled ? (
                              <div
                                className="flex h-9 w-full items-center justify-center rounded-xl border border-slate-200 bg-slate-100/70 text-[11px] text-slate-400 dark:border-slate-800 dark:bg-slate-800/40"
                                title="غیرفعال برای خط تولید انتخابی"
                              >
                                ۰ (غیرفعال)
                              </div>
                            ) : inp.type === 'select' ? (
                              <select
                                className="input !h-9 w-full text-xs font-medium cursor-pointer focus:ring-1 focus:ring-brand-500"
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
                                placeholder={inp.unit || '—'}
                                className="input !h-9 w-full text-xs font-medium text-left px-2.5 focus:ring-1 focus:ring-brand-500"
                                value={val}
                                onChange={(e) => updateRowInput(rIdx, inp.key, e.target.value)}
                              />
                            )}
                          </td>
                        )
                      })}

                      {/* ستون‌های خروجی‌های فرمول و محاسبات زنده */}
                      {outputsList.map((out) => {
                        const effectiveLineStr = isLineFixed ? fixedLineId : row.line
                        const outVal = computedOutputs[out.key]
                        const isCondDisabled = isInputConditionDisabled(out, effectiveLineStr)

                        return (
                          <td
                            key={out.key}
                            className="px-3 py-2 align-middle bg-brand-50/30 dark:bg-brand-950/15"
                          >
                            <div className="flex items-center gap-1.5 justify-end">
                              <span
                                className={classNames(
                                  'font-mono text-xs font-bold',
                                  outVal !== null && outVal !== undefined
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : 'text-slate-400 dark:text-slate-500'
                                )}
                              >
                                {isCondDisabled ? '۰' : outVal !== null && outVal !== undefined ? formatNumber(outVal, 2) : '—'}
                              </span>
                              {out.unit && <span className="text-[10px] text-slate-400">{out.unit}</span>}
                            </div>
                          </td>
                        )
                      })}

                      {/* دکمه‌های عملیات هر سطر */}
                      <td className="px-2 py-2 text-center align-middle">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRow(rIdx)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800 transition"
                            title="تکثیر این سطر"
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
        title="چسباندن متن از اکسل (Paste)"
        subtitle="ردیف‌های مورد نظر را در فایل اکسل کپی کرده و در کادر زیر پیست نمایید"
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
                hourMode !== 'disabled' && !isHourFixed ? 'ساعت' : null,
                lineMode !== 'disabled' && !isLineFixed ? 'خط تولید' : null,
                contractorMode !== 'disabled' && !isContractorFixed ? 'پیمانکار' : null,
                ...(schema?.inputs ?? []).map((i) => i.name),
              ]
                .filter(Boolean)
                .join(' ⟵ ')}
            </p>
          </div>
          <textarea
            dir="ltr"
            rows={8}
            className="input w-full font-mono text-xs leading-relaxed"
            placeholder={`1405-05-15\t08:00\t120\t45\n1405-05-15\t09:00\t135\t50`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
        </div>
      </Modal>
    </>
  )
}
