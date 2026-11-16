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
} from 'lucide-react'
import Modal from '../ui/Modal'
import JalaliDateInput from '../ui/JalaliDateInput'
import { useToast } from '../ui/Toast'
import { useFactory } from '../../store/FactoryContext'
import { createFactoryTabRecord, getFactoryTabSchema } from '../../api/factoryTabs'
import type { FactoryTabBrief, FactoryTabSchema, FactoryTabRecordPayload } from '../../types'
import { formatDate, formatNumber, todayISO, round2 } from '../../utils'
import { tabOutputLabel } from '../../utils/outputLabels'
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

  const createEmptyRow = useCallback(
    (defaultDate = todayISO(), defaultLine = '', defaultContractor = ''): BulkRow => {
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

  // Quick fill toolbar state
  const [fillDate, setFillDate] = useState(todayISO())
  const [fillLine, setFillLine] = useState('')
  const [fillContractor, setFillContractor] = useState('')
  const [fillHour, setFillHour] = useState('')

  // Paste dialog state
  const [pasteModalOpen, setPasteModalOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')

  // Add rows
  const addRows = (count: number) => {
    const last = rows[rows.length - 1]
    const defDate = last ? last.date_from : todayISO()
    const defLine = last ? last.line : ''
    const defContractor = last ? last.contractor : ''
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

  // Apply batch fills
  const applyDateToAll = () => {
    if (!fillDate) return
    setRows((prev) => prev.map((r) => ({ ...r, date_from: fillDate, date_to: fillDate })))
    notify('تاریخ برای همه ردیف‌ها اعمال شد')
  }

  const applyLineToAll = () => {
    if (!fillLine) return
    setRows((prev) => prev.map((r) => ({ ...r, line: fillLine })))
    notify('خط تولید برای همه ردیف‌ها اعمال شد')
  }

  const applyContractorToAll = () => {
    if (!fillContractor) return
    setRows((prev) => prev.map((r) => ({ ...r, contractor: fillContractor })))
    notify('پیمانکار برای همه ردیف‌ها اعمال شد')
  }

  const applyHourToAll = () => {
    if (!fillHour) return
    setRows((prev) => prev.map((r) => ({ ...r, hour: fillHour })))
    notify('ساعت برای همه ردیف‌ها اعمال شد')
  }

  // Paste from Excel handler
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
      // Split by tab or comma
      const cols = line.includes('\t') ? line.split('\t') : line.split(',')
      const r = createEmptyRow()
      let cIdx = 0

      // Try Date
      if (cols[cIdx]) {
        const d = cols[cIdx].trim().replace(/\//g, '-')
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
          r.date_from = d
          r.date_to = d
          cIdx++
        }
      }

      // Try Hour
      if (hourMode !== 'disabled' && cols[cIdx]) {
        const h = cols[cIdx].trim()
        if (/^\d{1,2}:\d{2}$/.test(h)) {
          r.hour = h.length === 4 ? `0${h}` : h
          cIdx++
        }
      }

      // Fill inputs in order
      inputDefs.forEach((inp) => {
        if (cols[cIdx] !== undefined) {
          const val = cols[cIdx].trim()
          r.inputs[inp.key] = inp.type === 'number' ? (isNaN(Number(val)) ? val : Number(val)) : val
          cIdx++
        }
      })

      parsedRows.push(r)
    })

    if (parsedRows.length > 0) {
      setRows(parsedRows)
      setPasteModalOpen(false)
      setPasteText('')
      notify(`${parsedRows.length} ردیف از متن اکسل کپی و جایگذاری شد`)
    }
  }

  // Check if an input is disabled for a row due to line condition
  const isInputConditionDisabled = (inp: { conditions?: { lines?: number[] } }, rowLine: string) => {
    const condLines = inp.conditions?.lines
    if (!condLines || condLines.length === 0) return false
    const lineId = Number(rowLine)
    if (!lineId || !condLines.includes(lineId)) return true
    return false
  }

  // Validation function
  const validateRow = (row: BulkRow, index: number): string | null => {
    if (!row.date_from) return `ردیف ${index + 1}: تاریخ الزامی است.`
    if (lineMode === 'required' && !row.line) return `ردیف ${index + 1}: انتخاب خط تولید الزامی است.`
    if (contractorMode === 'required' && !row.contractor) return `ردیف ${index + 1}: انتخاب پیمانکار الزامی است.`
    if (hourMode === 'required' && !row.hour) return `ردیف ${index + 1}: ساعت ثبت الزامی است.`

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

  // Submit all rows to backend
  const handleSubmitAll = async () => {
    // 1. Validate
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

      // Build payload
      const cleanedInputs: Record<string, any> = {}
      const rowLineId = row.line ? Number(row.line) : null

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

      const payload: FactoryTabRecordPayload = {
        tab: tab.id,
        line_id: lineMode !== 'disabled' && row.line ? Number(row.line) : null,
        contractor_id: contractorMode !== 'disabled' && row.contractor ? Number(row.contractor) : null,
        date_from: row.date_from,
        date_to: isDaily ? row.date_from : row.date_to || row.date_from,
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
        const errMsg = e?.response?.data?.errors?.detail || e?.message || 'خطا در ثبت'
        updateRow(i, { status: 'error', error: errMsg })
      }
    }

    setSubmitting(false)

    if (failCount === 0) {
      notify(`تمام ${successCount} رکورد با موفقیت در دیتابیس ثبت شدند`)
      onSuccess()
      onClose()
    } else {
      notify(`${successCount} رکورد با موفقیت ثبت شد، ولی ${failCount} رکورد با خطا مواجه شد.`, 'error')
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
        title="ورود گروهی رکوردها (مدیر ارشد)"
        subtitle={`ثبت چندگانه رکوردها برای تب «${tab.name}»`}
        size="full"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs text-ink-500 dark:text-slate-400">
              <span className="font-bold text-ink-700 dark:text-slate-200">{formatNumber(rows.length)} ردیف</span>
              {submitting && (
                <span className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> در حال ثبت رکورد {progress.current} از {progress.total}...
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={onClose} disabled={submitting}>
                انصراف
              </button>
              <button className="btn-primary" onClick={handleSubmitAll} disabled={submitting || rows.length === 0}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>در حال ذخیره...</span>
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
          {/* نوار ابزار تنظیمات گروهی */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink-100 bg-ink-50/70 p-3 dark:border-slate-800 dark:bg-slate-850">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-bold text-ink-700 dark:text-slate-200">تنظیم سریع همگانی:</span>

              {/* تاریخ مشترک */}
              <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-xs dark:bg-slate-800">
                <span className="px-1 text-slate-400">تاریخ:</span>
                <input
                  type="text"
                  dir="ltr"
                  placeholder="1405-05-15"
                  className="input !h-7 !w-24 !px-1.5 !py-0 text-center text-xs"
                  value={fillDate}
                  onChange={(e) => setFillDate(e.target.value)}
                />
                <button
                  type="button"
                  onClick={applyDateToAll}
                  className="btn-ghost !h-7 !px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-400"
                >
                  اعمال به همه
                </button>
              </div>

              {/* خط تولید مشترک */}
              {lineMode !== 'disabled' && (
                <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-xs dark:bg-slate-800">
                  <span className="px-1 text-slate-400">خط:</span>
                  <select
                    className="input !h-7 !w-28 !px-1.5 !py-0 text-xs"
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
                    className="btn-ghost !h-7 !px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400"
                  >
                    اعمال به همه
                  </button>
                </div>
              )}

              {/* پیمانکار مشترک */}
              {contractorMode !== 'disabled' && (
                <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-xs dark:bg-slate-800">
                  <span className="px-1 text-slate-400">پیمانکار:</span>
                  <select
                    className="input !h-7 !w-28 !px-1.5 !py-0 text-xs"
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
                    className="btn-ghost !h-7 !px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400"
                  >
                    اعمال به همه
                  </button>
                </div>
              )}

              {/* ساعت مشترک */}
              {hourMode !== 'disabled' && (
                <div className="flex items-center gap-1 rounded-xl bg-white p-1 shadow-xs dark:bg-slate-800">
                  <span className="px-1 text-slate-400">ساعت:</span>
                  <input
                    type="time"
                    className="input !h-7 !w-20 !px-1 !py-0 text-xs text-center"
                    value={fillHour}
                    onChange={(e) => setFillHour(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={applyHourToAll}
                    disabled={!fillHour}
                    className="btn-ghost !h-7 !px-2 text-[11px] font-semibold text-brand-600 hover:bg-brand-50 disabled:opacity-40 dark:text-brand-400"
                  >
                    اعمال به همه
                  </button>
                </div>
              )}
            </div>

            {/* کلیدهای افزودن و چسباندن از اکسل */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setPasteModalOpen(true)}
                className="btn-secondary !h-8 !px-2.5 text-xs font-semibold"
                title="چسباندن متن کپی‌شده از اکسل"
              >
                <ClipboardPaste className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>چسباندن از اکسل</span>
              </button>
              <button
                type="button"
                onClick={() => addRows(1)}
                className="btn-ghost !h-8 !px-2 text-xs font-semibold"
                title="افزودن ۱ ردیف"
              >
                <Plus className="h-3.5 w-3.5" /> ۱ ردیف
              </button>
              <button
                type="button"
                onClick={() => addRows(5)}
                className="btn-ghost !h-8 !px-2 text-xs font-semibold"
                title="افزودن ۵ ردیف"
              >
                <Plus className="h-3.5 w-3.5" /> ۵ ردیف
              </button>
              <button
                type="button"
                onClick={() => addRows(10)}
                className="btn-ghost !h-8 !px-2 text-xs font-semibold"
                title="افزودن ۱۰ ردیف"
              >
                <Plus className="h-3.5 w-3.5" /> ۱۰ ردیف
              </button>
              <button
                type="button"
                onClick={() => setRows([createEmptyRow()])}
                className="btn-ghost !h-8 !px-2 text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                title="پاک‌سازی همه ردیف‌ها"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* جدول ورود داده‌ها */}
          <div className="overflow-x-auto rounded-2xl border border-ink-100 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-ink-100 bg-ink-50/80 text-right font-bold text-ink-600 dark:border-slate-800 dark:bg-slate-800/80 dark:text-slate-300">
                  <th className="w-10 px-2 py-2.5 text-center">#</th>
                  <th className="w-28 px-2 py-2.5">تاریخ *</th>
                  {!isDaily && <th className="w-28 px-2 py-2.5">تا تاریخ</th>}
                  {hourMode !== 'disabled' && <th className="w-20 px-2 py-2.5">ساعت</th>}
                  {lineMode !== 'disabled' && (
                    <th className="w-32 px-2 py-2.5">خط تولید {lineMode === 'required' ? '*' : ''}</th>
                  )}
                  {contractorMode !== 'disabled' && (
                    <th className="w-32 px-2 py-2.5">پیمانکار {contractorMode === 'required' ? '*' : ''}</th>
                  )}

                  {/* ستون‌های ورودی‌های تعریف‌شده */}
                  {(schema?.inputs ?? []).map((inp) => (
                    <th key={inp.key} className="min-w-[120px] px-2 py-2.5">
                      <div className="flex items-center gap-1">
                        <span>{inp.name}</span>
                        {inp.required && <span className="text-rose-500">*</span>}
                        {inp.unit && <span className="text-[10px] text-ink-400">({inp.unit})</span>}
                      </div>
                    </th>
                  ))}

                  {/* ستون‌های خروجی‌های محاسبه‌شده زنده */}
                  {outputsList.map((out) => (
                    <th key={out.key} className="min-w-[110px] px-2 py-2.5 text-brand-700 dark:text-brand-400 bg-brand-50/40 dark:bg-brand-950/20">
                      <div className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3" />
                        <span>{out.name}</span>
                        {out.unit && <span className="text-[10px] opacity-75">({out.unit})</span>}
                      </div>
                    </th>
                  ))}

                  <th className="w-20 px-2 py-2.5 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-ink-100 dark:divide-slate-800">
                {rows.map((row, rIdx) => {
                  const rowLineId = row.line ? Number(row.line) : null
                  const computedOutputs = computeRowOutputs(outputsList, row.inputs, rowLineId)

                  return (
                    <tr
                      key={row.id}
                      className={`transition ${
                        row.status === 'success'
                          ? 'bg-emerald-50/40 dark:bg-emerald-950/20'
                          : row.status === 'error'
                          ? 'bg-rose-50/40 dark:bg-rose-950/20'
                          : 'hover:bg-ink-50/30 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      {/* ستون شماره و وضعیت */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {row.status === 'pending' ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-600" />
                          ) : row.status === 'success' ? (
                            <span title="ثبت شد"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /></span>
                          ) : row.status === 'error' ? (
                            <span title={row.error || 'خطا در ثبت'}><AlertCircle className="h-3.5 w-3.5 text-rose-600" /></span>
                          ) : (
                            <span className="font-mono text-ink-400 dark:text-slate-500">{rIdx + 1}</span>
                          )}
                        </div>
                      </td>

                      {/* تاریخ */}
                      <td className="px-1.5 py-1.5">
                        <input
                          type="text"
                          dir="ltr"
                          placeholder="1405-05-15"
                          className="input !h-8 !px-1.5 !py-0 text-center text-xs"
                          value={row.date_from}
                          onChange={(e) => updateRow(rIdx, { date_from: e.target.value, date_to: isDaily ? e.target.value : row.date_to })}
                        />
                      </td>

                      {/* تا تاریخ */}
                      {!isDaily && (
                        <td className="px-1.5 py-1.5">
                          <input
                            type="text"
                            dir="ltr"
                            placeholder="1405-05-15"
                            className="input !h-8 !px-1.5 !py-0 text-center text-xs"
                            value={row.date_to}
                            onChange={(e) => updateRow(rIdx, { date_to: e.target.value })}
                          />
                        </td>
                      )}

                      {/* ساعت */}
                      {hourMode !== 'disabled' && (
                        <td className="px-1.5 py-1.5">
                          <input
                            type="time"
                            className="input !h-8 !px-1 !py-0 text-xs text-center"
                            value={row.hour}
                            onChange={(e) => updateRow(rIdx, { hour: e.target.value })}
                          />
                        </td>
                      )}

                      {/* خط تولید */}
                      {lineMode !== 'disabled' && (
                        <td className="px-1.5 py-1.5">
                          <select
                            className="input !h-8 !px-1.5 !py-0 text-xs"
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
                        <td className="px-1.5 py-1.5">
                          <select
                            className="input !h-8 !px-1.5 !py-0 text-xs"
                            value={row.contractor}
                            onChange={(e) => updateRow(rIdx, { contractor: e.target.value })}
                          >
                            <option value="">{contractorMode === 'required' ? 'انتخاب...' : 'بدون پیمانکار'}</option>
                            {contractorsList.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                          </select>
                        </td>
                      )}

                      {/* فیلدهای ورودی */}
                      {(schema?.inputs ?? []).map((inp) => {
                        const isCondDisabled = isInputConditionDisabled(inp, row.line)
                        const val = isCondDisabled ? 0 : row.inputs[inp.key] ?? ''

                        return (
                          <td key={inp.key} className="px-1.5 py-1.5">
                            {isCondDisabled ? (
                              <div
                                className="flex h-8 w-full items-center justify-center rounded-xl border border-ink-100 bg-ink-100/60 text-[11px] text-ink-400 dark:border-slate-800 dark:bg-slate-800/40"
                                title="غیرفعال برای خط تولید انتخابی (مقدار صفر لحاظ می‌شود)"
                              >
                                ۰ (غیرفعال)
                              </div>
                            ) : inp.type === 'select' ? (
                              <select
                                className="input !h-8 !px-1.5 !py-0 text-xs"
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
                                className="input !h-8 !px-2 !py-0 text-xs"
                                value={val}
                                onChange={(e) => updateRowInput(rIdx, inp.key, e.target.value)}
                              />
                            )}
                          </td>
                        )
                      })}

                      {/* ستون‌های خروجی‌های محاسبه‌شده زنده */}
                      {outputsList.map((out) => {
                        const outVal = computedOutputs[out.key]
                        const isCondDisabled = isInputConditionDisabled(out, row.line)

                        return (
                          <td key={out.key} className="px-2 py-1.5 bg-brand-50/20 dark:bg-brand-950/10">
                            <div className="flex items-center gap-1">
                              <span
                                className={`font-mono text-xs font-bold ${
                                  outVal !== null && outVal !== undefined
                                    ? 'text-brand-600 dark:text-brand-400'
                                    : 'text-ink-400 dark:text-slate-500'
                                }`}
                              >
                                {isCondDisabled ? '۰' : outVal !== null && outVal !== undefined ? formatNumber(outVal, 2) : '—'}
                              </span>
                              {out.unit && <span className="text-[10px] text-ink-400">{out.unit}</span>}
                            </div>
                          </td>
                        )
                      })}

                      {/* عملیات ردیف */}
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => duplicateRow(rIdx)}
                            className="rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800"
                            title="تکثیر این ردیف"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => removeRow(rIdx)}
                            className="rounded-lg p-1 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50"
                            title="حذف ردیف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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
        title="چسباندن داده‌ها از نرم‌افزار اکسل (Paste from Excel)"
        subtitle="داده‌های کپی‌شده از اکسل یا فایل متنی را در کادر زیر جایگذاری (Paste) کنید."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-ghost" onClick={() => setPasteModalOpen(false)}>
              انصراف
            </button>
            <button className="btn-primary" onClick={handlePasteSubmit} disabled={!pasteText.trim()}>
              <ClipboardPaste className="h-4 w-4" />
              <span>جایگذاری در جدول</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-ink-600 dark:text-slate-300">
            ردیف‌های مورد نظر را در اکسل انتخاب و Copy کنید و سپس در کادر زیر Paste نمایید. ترتیب ستون‌ها:
            <span className="font-bold text-brand-600 dark:text-brand-400">
              {' '}تاریخ {hourMode !== 'disabled' ? '← ساعت ' : ''}← ورودی‌های تب
            </span>
          </p>
          <textarea
            dir="ltr"
            rows={8}
            className="input w-full font-mono text-xs"
            placeholder={`1405-05-15\t10:30\t25\t2\t10\n1405-05-15\t11:30\t30\t3\t12`}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
          />
        </div>
      </Modal>
    </>
  )
}
