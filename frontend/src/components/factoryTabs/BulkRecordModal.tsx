import { useState, useMemo, useCallback, useEffect } from 'react'
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
  Check,
  ChevronDown,
  Info,
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
  toJalali,
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

  // همگام‌سازی کلیدهای ورودی در صورت بارگذاری ناهمگام اسکیما
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

  // وضعیت مودال چسباندن از اکسل
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

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

  // پردازش و تبدیل داده‌های اکسل
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

      // ۱. بررسی تاریخ شمسی
      if (cols[cIdx]) {
        const raw = normalizePersianDigits(cols[cIdx]).trim()
        const parts = parseJalaliSlash(raw)
        if (parts) {
          const dStr = formatJalaliSlash(parts[0], parts[1], parts[2])
          r.date_from = dStr
          r.date_to = dStr
          cIdx++
        } else if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
          const j = toJalali(raw)
          if (j) {
            const dStr = formatJalaliSlash(j[0], j[1], j[2])
            r.date_from = dStr
            r.date_to = dStr
            cIdx++
          }
        }
      }

      // ۲. بررسی ساعت
      if (hourMode !== 'disabled' && cols[cIdx]) {
        const h = normalizePersianDigits(cols[cIdx]).trim()
        if (/^\d{1,2}:\d{2}$/.test(h)) {
          r.hour = h.length === 4 ? `0${h}` : h
          cIdx++
        }
      }

      // ۳. پر کردن ورودی‌ها به ترتیب
      inputDefs.forEach((inp) => {
        if (cols[cIdx] !== undefined) {
          const rawVal = normalizePersianDigits(cols[cIdx]).trim()
          r.inputs[inp.key] = inp.type === 'number' ? (isNaN(Number(rawVal)) ? rawVal : Number(rawVal)) : rawVal
          cIdx++
        }
      })

      parsedRows.push(r)
    })

    if (parsedRows.length > 0) {
      setRows(parsedRows)
      setPasteModalOpen(false)
      setPasteText('')
      notify(`${parsedRows.length} ردیف با موفقیت از اکسل وارد و به تاریخ شمسی اسلش‌دار تبدیل شد`)
    }
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
      return `ردیف ${index + 1}: تاریخ وارد شده «${row.date_from}» نامعتبر است. لطفاً تاریخ شمسی با اسلش وارد کنید (مثال: 1403/08/30)`
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

      // تبدیل تاریخ شمسی اسلش‌دار کاربر به میلادی استاندارد برای فیلد دیتابیس جنگو
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
      notify(`تمام ${successCount} رکورد با موفقیت در سیستم ثبت شدند`)
      onSuccess()
      onClose()
    } else {
      notify(`${successCount} رکورد با موفقیت ثبت شد، ولی ${failCount} رکورد با خطا مواجه شد. ردیف‌های خطا را بررسی کنید.`, 'error')
      onSuccess()
    }
  }

  const linesList = schema?.lines?.length ? schema.lines : (selectedFactory?.lines ?? [])
  const contractorsList = schema?.contractor?.options?.length ? schema.contractor.options : (selectedFactory?.contractors ?? [])
  const outputsList = (tab.outputs && tab.outputs.length > 0) ? tab.outputs : (schema?.outputs ?? [])

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
            <div className="flex flex-wrap items-center gap-2.5 lg:col-span-8">
              <span className="text-xs font-extrabold text-slate-700 dark:text-slate-300">تنظیم همگانی:</span>

              {/* تاریخ شمسی مشترک */}
              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-xs dark:border-slate-700 dark:bg-slate-800">
                <span className="px-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">تاریخ شمسی:</span>
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
                    className="input !h-8 !w-32 !px-1.5 !py-0 text-xs font-medium"
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
                    className="input !h-8 !w-32 !px-1.5 !py-0 text-xs font-medium"
                    value={fillContractor}
                    onChange={(e) => setFillContractor(e.target.value)}
                  >
                    <option value="">انتخاب پیمانکار...</option>
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
                    className="input !h-8 !w-24 !px-1 !py-0 text-center font-mono text-xs font-bold"
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

            {/* بخش کلیدهای کنترل ردیف و اکسل */}
            <div className="flex flex-wrap items-center justify-end gap-1.5 lg:col-span-4">
              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className="btn-secondary !h-8.5 !px-3 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                title="چسباندن متن کپی‌شده از اکسل با تاریخ شمسی"
              >
                <ClipboardPaste className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>چسباندن از اکسل</span>
              </button>
              <button
                type="button"
                onClick={() => addRows(1)}
                className="btn-ghost !h-8.5 !px-2.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                title="افزودن ۱ ردیف جدید"
              >
                <Plus className="h-3.5 w-3.5" /> ۱+
              </button>
              <button
                type="button"
                onClick={() => addRows(5)}
                className="btn-ghost !h-8.5 !px-2.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                title="افزودن ۵ ردیف جدید"
              >
                <Plus className="h-3.5 w-3.5" /> ۵+
              </button>
              <button
                type="button"
                onClick={() => addRows(10)}
                className="btn-ghost !h-8.5 !px-2.5 text-xs font-bold border border-slate-200 bg-white hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
                title="افزودن ۱۰ ردیف جدید"
              >
                <Plus className="h-3.5 w-3.5" /> ۱۰+
              </button>
              <button
                type="button"
                onClick={() => setRows([createEmptyRow()])}
                className="btn-ghost !h-8.5 !px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                title="پاک‌سازی همه ردیف‌ها و شروع مجدد"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* راهنمای سریع فرمت تاریخ */}
          <div className="flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 border border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/60">
            <Info className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              <strong>راهنمای تاریخ شمسی:</strong> تاریخ‌ها را دقیقاً به صورت شمسی و با علامت اسلش (<strong>/</strong>) وارد کنید (مثال: <code className="font-mono font-bold bg-white/70 dark:bg-black/30 px-1 rounded">1403/08/30</code>). سیستم به طور خودکار آن را شناسایی کرده، مقادیر خروجی را به صورت زنده محاسبه نموده و دقیقاً بدون هیچ خطایی در پایگاه‌داده ذخیره خواهد کرد.
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
                  <th className="min-w-[145px] px-3 py-3 font-extrabold text-slate-700 dark:text-slate-200">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-brand-600 dark:text-brand-400" />
                      <span>تاریخ شمسی (با /) *</span>
                    </div>
                  </th>

                  {/* تا تاریخ */}
                  {!isDaily && (
                    <th className="min-w-[145px] px-3 py-3 font-extrabold text-slate-700 dark:text-slate-200">
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

                  {/* ستون‌های ورودی‌های تعریف‌شده (با رنگ آبی مشخص) */}
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

                  {/* ستون‌های خروجی‌های محاسبه‌شده زنده (با رنگ سبز زمردی مشخص) */}
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

                      {/* تاریخ شمسی */}
                      <td className="px-2 py-2">
                        <div className="relative">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="1403/08/30"
                            className={`w-full h-9 rounded-lg border px-2.5 text-center font-mono text-xs font-bold transition focus:ring-2 ${
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
                          />
                        </div>
                      </td>

                      {/* تا تاریخ شمسی (برای تب‌های بازه‌ای) */}
                      {!isDaily && (
                        <td className="px-2 py-2">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="1403/08/30"
                            className="w-full h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-center font-mono text-xs font-bold text-slate-800 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                            value={row.date_to}
                            onChange={(e) => {
                              const val = normalizePersianDigits(e.target.value)
                              updateRow(rIdx, { date_to: val })
                            }}
                          />
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

      {/* مودال چسباندن از اکسل */}
      <Modal
        open={pasteModalOpen}
        onClose={() => setPasteModalOpen(false)}
        title="چسباندن داده‌ها از اکسل (Paste from Excel)"
        subtitle="متن کپی‌شده از سلول‌های اکسل را اینجا پیست کنید (ستون اول: تاریخ شمسی مانند 1403/08/30)"
        size="lg"
        footer={
          <div className="flex w-full items-center justify-between">
            <span className="text-xs text-slate-500">
              {pasteText.trim().split(/\r?\n/).filter(Boolean).length} خط آماده پردازش
            </span>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={() => setPasteModalOpen(false)}>
                انصراف
              </button>
              <button className="btn-primary" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
                درون‌ریزی و اعمال به جدول
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl bg-blue-50 p-3 text-xs text-blue-800 dark:bg-blue-950/40 dark:text-blue-200">
            <strong>ترتیب مورد انتظار ستون‌های اکسل:</strong>
            <p className="mt-1 font-mono text-[11px] dir-ltr text-left">
              [تاریخ شمسی مانند 1403/08/30] {hourMode !== 'disabled' ? '· [ساعت]' : ''} · [ورودی ۱] · [ورودی ۲] ...
            </p>
          </div>
          <textarea
            className="input h-52 w-full font-mono text-xs leading-relaxed"
            dir="ltr"
            placeholder={'1403/08/30\t150\t24.5\n1403/08/30\t180\t28.0'}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
        </div>
      </Modal>
    </>
  )
}
