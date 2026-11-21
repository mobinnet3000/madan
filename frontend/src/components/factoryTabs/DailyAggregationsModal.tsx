import { useMemo } from 'react'
import {
  SlidersHorizontal,
  RotateCcw,
  Check,
  Sigma,
  TrendingUp,
  ArrowUp,
  ArrowDown,
  Clock,
  EyeOff,
  Info,
  Sparkles,
} from 'lucide-react'
import Modal from '../ui/Modal'
import type { FactoryTabBrief } from '../../types'

export type AggregationMode = 'sum' | 'avg' | 'max' | 'min' | 'last' | 'none'

export interface AggregationModeInfo {
  key: AggregationMode
  label: string
  shortLabel: string
  description: string
  icon: typeof Sigma
  activeClass: string
}

export const AGGREGATION_MODES: AggregationModeInfo[] = [
  {
    key: 'sum',
    label: 'مجموع (جمع)',
    shortLabel: 'مجموع',
    description: 'جمع مقادیر رکوردهای آن روز',
    icon: Sigma,
    activeClass: 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-500/30',
  },
  {
    key: 'avg',
    label: 'میانگین',
    shortLabel: 'میانگین',
    description: 'میانگین حسابی مقادیر رکوردهای آن روز',
    icon: TrendingUp,
    activeClass: 'bg-sky-600 text-white shadow-sm ring-2 ring-sky-500/30',
  },
  {
    key: 'max',
    label: 'بیشینه (حداکثر)',
    shortLabel: 'بیشینه',
    description: 'بیشترین مقدار ثبت‌شده در طول روز',
    icon: ArrowUp,
    activeClass: 'bg-amber-600 text-white shadow-sm ring-2 ring-amber-500/30',
  },
  {
    key: 'min',
    label: 'کمینه (حداقل)',
    shortLabel: 'کمینه',
    description: 'کمترین مقدار ثبت‌شده در طول روز',
    icon: ArrowDown,
    activeClass: 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-500/30',
  },
  {
    key: 'last',
    label: 'آخرین مقدار',
    shortLabel: 'آخرین',
    description: 'مقدار آخرین نوبت ثبت‌شده در آن روز',
    icon: Clock,
    activeClass: 'bg-purple-600 text-white shadow-sm ring-2 ring-purple-500/30',
  },
  {
    key: 'none',
    label: 'عدم نمایش',
    shortLabel: 'مخفی',
    description: 'عدم نمایش در سطر خلاصه روزانه',
    icon: EyeOff,
    activeClass: 'bg-slate-700 text-white shadow-sm ring-2 ring-slate-600/40',
  },
]

export function getDefaultAggMode(key: string, name?: string, unit?: string): AggregationMode {
  const text = `${key} ${name || ''} ${unit || ''}`.toLowerCase()
  if (
    text.includes('درصد') ||
    text.includes('عیار') ||
    text.includes('رطوبت') ||
    text.includes('راندمان') ||
    text.includes('نرخ') ||
    text.includes('دما') ||
    text.includes('فشار') ||
    text.includes('سرعت') ||
    text.includes('چگالی') ||
    text.includes('%') ||
    text.includes('pct') ||
    text.includes('percent') ||
    text.includes('rate') ||
    text.includes('ratio') ||
    text.includes('grade') ||
    text.includes('recovery') ||
    text.includes('moisture') ||
    text.includes('temp') ||
    text.includes('speed') ||
    text.includes('pressure') ||
    text.includes('density')
  ) {
    return 'avg'
  }
  return 'sum'
}

interface DailyAggregationsModalProps {
  open: boolean
  onClose: () => void
  tab: FactoryTabBrief | null
  extraOutputKeys?: string[]
  customAggModes: Record<string, AggregationMode>
  onSetMode: (key: string, mode: AggregationMode) => void
  onReset: () => void
}

export default function DailyAggregationsModal({
  open,
  onClose,
  tab,
  extraOutputKeys = [],
  customAggModes,
  onSetMode,
  onReset,
}: DailyAggregationsModalProps) {
  const outputList = useMemo(() => {
    const list: { key: string; name: string; unit: string; formula?: string }[] = []
    const seen = new Set<string>()

    if (tab?.outputs) {
      for (const o of tab.outputs) {
        list.push({
          key: o.key,
          name: o.name || o.key,
          unit: o.unit || '',
          formula: o.formula,
        })
        seen.add(o.key)
      }
    }

    for (const k of extraOutputKeys) {
      if (!seen.has(k)) {
        list.push({
          key: k,
          name: k,
          unit: '',
        })
        seen.add(k)
      }
    }

    return list
  }, [tab, extraOutputKeys])

  // Count summary
  const summaryCounts = useMemo(() => {
    const counts: Record<AggregationMode, number> = {
      sum: 0,
      avg: 0,
      max: 0,
      min: 0,
      last: 0,
      none: 0,
    }
    for (const item of outputList) {
      const mode = customAggModes[item.key] || getDefaultAggMode(item.key, item.name, item.unit)
      counts[mode] = (counts[mode] || 0) + 1
    }
    return counts
  }, [outputList, customAggModes])

  if (!open) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="تنظیم نحوه تجمیع خروجی‌ها در خلاصه روزانه"
      subtitle={tab?.name ? `تب «${tab.name}»` : undefined}
      size="lg"
    >
      <div className="space-y-4 text-xs">
        {/* توضیحات راهنما */}
        <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-3.5 text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200">
          <div className="flex items-start gap-2.5">
            <Info className="h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold leading-relaxed">
                هنگامی که در یک روز چند رکورد ثبت می‌شود، مقادیر فیلدهای خروجی در سطر خلاصه روز به صورت خودکار تجمیع می‌شوند.
              </p>
              <p className="text-[11px] text-sky-800/80 dark:text-sky-300/80 leading-relaxed">
                برای هر فیلد می‌توانید حالت دلخواه مانند <strong>جمع (مجموع)</strong>، <strong>میانگین</strong>، <strong>بیشینه (حداکثر)</strong>، <strong>کمینه (حداقل)</strong> یا <strong>آخرین مقدار</strong> را انتخاب کنید. همچنین با کلیک مستقیم روی هر برچسب در جدول نیز می‌توانید حالت آن را سریعاً تغییر دهید.
              </p>
            </div>
          </div>
        </div>

        {/* خلاصه وضعیت کنونی */}
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-2.5 dark:bg-slate-800/50">
          <span className="font-bold text-ink-600 dark:text-slate-300">وضعیت کنونی:</span>
          {AGGREGATION_MODES.map((m) => {
            const count = summaryCounts[m.key] || 0
            if (count === 0) return null
            const Icon = m.icon
            return (
              <span
                key={m.key}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 shadow-2xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                <Icon className="h-3 w-3 text-slate-500" />
                <span>{count} {m.shortLabel}</span>
              </span>
            )
          })}
        </div>

        {/* لیست خروجی‌ها */}
        <div className="max-h-[55vh] space-y-2.5 overflow-y-auto pr-1">
          {outputList.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-400 dark:border-slate-700">
              هیچ فیلد خروجی برای این تب تعریف نشده است.
            </div>
          ) : (
            outputList.map((item) => {
              const currentMode =
                customAggModes[item.key] || getDefaultAggMode(item.key, item.name, item.unit)

              return (
                <div
                  key={item.key}
                  className="rounded-2xl border border-ink-100 bg-white p-3 shadow-2xs transition hover:border-brand-200 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
                >
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-ink-800 dark:text-slate-100">
                        {item.name}
                      </span>
                      {item.unit && (
                        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          {item.unit}
                        </span>
                      )}
                      <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500">
                        ({item.key})
                      </span>
                    </div>
                    {item.formula && (
                      <span
                        className="rounded-md bg-amber-50 px-2 py-0.5 font-mono text-[10px] text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                        title={`فرمول: ${item.formula}`}
                      >
                        محاسباتی
                      </span>
                    )}
                  </div>

                  {/* دکمه‌های انتخاب حالت تجمیع */}
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {AGGREGATION_MODES.map((m) => {
                      const isSelected = currentMode === m.key
                      const Icon = m.icon
                      return (
                        <button
                          key={m.key}
                          type="button"
                          onClick={() => onSetMode(item.key, m.key)}
                          className={`flex items-center justify-center gap-1 rounded-xl px-2 py-1.5 text-[11px] font-bold transition ${
                            isSelected
                              ? m.activeClass
                              : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-300 dark:hover:bg-slate-800'
                          }`}
                          title={m.description}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span>{m.shortLabel}</span>
                          {isSelected && <Check className="mr-0.5 h-3 w-3 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* پاورقی دکمه‌ها */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onReset}
            className="btn-ghost !h-8 !px-3 text-xs font-semibold text-slate-600 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400 flex items-center gap-1.5"
            title="بازگشت به پیش‌فرض هوشمند (درصدها و عیارها به میانگین، مقادیر دیگر به جمع)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>بازنشانی به پیش‌فرض هوشمند</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="btn-primary !h-8 !px-5 text-xs font-bold"
          >
            تأیید و بازگشت
          </button>
        </div>
      </div>
    </Modal>
  )
}
