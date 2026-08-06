import { useState } from 'react'
import { motion } from 'framer-motion'
import { Layers, Clock, AlertTriangle, ChevronDown, Info, Factory as FactoryIcon, Settings2 } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { Loading, EmptyState } from '../components/ui/States'
import LineFlow from '../components/LineFlow'
import AttributeEditor from '../components/AttributeEditor'
import { saveLineAttributes, saveDeviceAttributes } from '../api/production'
import { useToast } from '../components/ui/Toast'
import { formatNumber } from '../utils'
import { LINE_TYPE_LABELS, LINE_TYPE_STYLE } from '../constants'
import type { LineType, ProductionLine, Device } from '../types'

export default function Lines() {
  const { selectedFactory, loading, reload } = useFactory()
  const { notify } = useToast()
  const [openAttrs, setOpenAttrs] = useState<Record<number, boolean>>({})
  const [editLine, setEditLine] = useState<ProductionLine | null>(null)
  const [editDevice, setEditDevice] = useState<Device | null>(null)
  const [saving, setSaving] = useState(false)

  if (loading) return <Loading />
  if (!selectedFactory)
    return (
      <EmptyState
        title="کارخانه‌ای انتخاب نشده"
        description="لطفاً از بالا یک کارخانه انتخاب کنید یا در پنل ادمین بسازید."
      />
    )

  const factory = selectedFactory

  // گروه‌بندی خطوط بر اساس نوع
  const groups: { type: LineType; lines: ProductionLine[] }[] = []
  ;(['crushing', 'processing', 'conveying', 'other'] as LineType[]).forEach((t) => {
    const lines = factory.lines.filter((l) => l.line_type === t)
    if (lines.length) groups.push({ type: t, lines })
  })

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-xl font-extrabold text-ink-900">مدل‌سازی خط فرآوری</h1>
        <p className="text-sm text-ink-500">
          نمایش سلسله‌مراتب کارخانه، خطوط خردایش/فرآوری و چیدمان دستگاه‌ها
        </p>
      </div>

      {/* کارت اطلاعات کارخانه */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="card grid grid-cols-1 gap-4 p-5 md:grid-cols-3"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <FactoryIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xs text-ink-400">نام کارخانه</div>
            <div className="font-bold text-ink-800">{factory.name}</div>
            {factory.address && (
              <div className="mt-0.5 text-xs text-ink-500">{factory.address}</div>
            )}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-400">
            <Clock className="h-3.5 w-3.5" /> شیفت‌های کاری
          </div>
          <div className="flex flex-wrap gap-2">
            {factory.shifts.map((s) => (
              <span key={s.id} className="chip">
                {s.name} · {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}
              </span>
            ))}
            {factory.shifts.length === 0 && <span className="text-xs text-ink-400">—</span>}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-ink-400">
            <AlertTriangle className="h-3.5 w-3.5" /> علل خرابی مرجع
          </div>
          <div className="flex flex-wrap gap-2">
            {factory.failure_reasons.map((f) => (
              <span key={f.id} className="badge bg-rose-50 text-rose-600">
                {f.title}
              </span>
            ))}
            {factory.failure_reasons.length === 0 && (
              <span className="text-xs text-ink-400">—</span>
            )}
          </div>
        </div>
      </motion.div>

      {factory.lines.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-10 w-10" />}
          title="خط فرآوری تعریف نشده است"
          description="از طریق پنل ادمین Django خطوط تولید و دستگاه‌ها را تعریف کنید."
        />
      ) : (
        <div className="space-y-8">
          {groups.map((group) => {
            const style = LINE_TYPE_STYLE[group.type]
            return (
              <section key={group.type}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${style.dot}`} />
                  <h2 className="text-base font-bold text-ink-800">
                    خطوط {LINE_TYPE_LABELS[group.type]}
                  </h2>
                  <span className="chip">{group.lines.length} خط</span>
                </div>
                <div className="space-y-5">
                  {group.lines.map((line, idx) => {
                    const attrs = Object.entries(line.attributes_values || {})
                    const isOpen = openAttrs[line.id] ?? false
                    return (
                      <motion.div
                        key={line.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        className="card overflow-hidden"
                      >
                        <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-500 to-amber-500 text-xs font-bold text-white">
                              {line.id}
                            </span>
                            <div>
                              <div className="text-sm font-bold text-ink-800">{line.name}</div>
                              <div className="text-[11px] text-ink-400">
                                الگو: {line.template_name}
                              </div>
                            </div>
                          </div>
                          {attrs.length > 0 && (
                            <button
                              onClick={() =>
                                setOpenAttrs((p) => ({ ...p, [line.id]: !p[line.id] }))
                              }
                              className="flex items-center gap-1 text-xs font-medium text-brand-600 hover:text-brand-700"
                            >
                              <Info className="h-3.5 w-3.5" /> ویژگی‌های فنی
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                              />
                            </button>
                          )}
                          <button
                            onClick={() => setEditLine(line)}
                            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-slate-800"
                            title="ویرایش مقادیر ویژگی‌ها"
                          >
                            <Settings2 className="h-3.5 w-3.5" /> ویرایش ویژگی‌ها
                          </button>
                        </div>

                        {isOpen && attrs.length > 0 && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            className="flex flex-wrap gap-2 border-b border-ink-100 bg-ink-50/60 px-4 py-3"
                          >
                            {attrs.map(([k, v]) => {
                              const unit = line.attribute_defs.find((d) => d.name === k)?.unit || ''
                              return (
                                <span key={k} className="inline-flex items-center gap-1 chip">
                                  <span className="text-ink-400">{k}:</span>
                                  <span className="font-semibold text-ink-700">{formatNumber(v as number)}</span>
                                  {unit && <span className="text-[10px] text-ink-400">{unit}</span>}
                                </span>
                              )
                            })}
                          </motion.div>
                        )}

                        <div className="p-4">
                          <LineFlow line={line} onEditDevice={setEditDevice} />
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <AttributeEditor
        open={editLine != null}
        title={editLine?.name || ''}
        defs={editLine?.attribute_defs ?? []}
        values={editLine?.attributes_values ?? {}}
        saving={saving}
        onClose={() => setEditLine(null)}
        onSave={async (vals) => {
          if (!editLine) return
          setSaving(true)
          try {
            await saveLineAttributes(editLine.id, vals)
            notify('ویژگی‌های فنی خط ذخیره شد')
            setEditLine(null)
            reload()
          } catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
          finally { setSaving(false) }
        }}
      />

      <AttributeEditor
        open={editDevice != null}
        title={`${editDevice?.code ? editDevice.code + ' - ' : ''}${editDevice?.name || ''}`}
        defs={editDevice?.attribute_defs ?? []}
        values={editDevice?.attributes_values ?? {}}
        saving={saving}
        onClose={() => setEditDevice(null)}
        onSave={async (vals) => {
          if (!editDevice) return
          setSaving(true)
          try {
            await saveDeviceAttributes(editDevice.id, vals)
            notify('ویژگی‌های فنی دستگاه ذخیره شد')
            setEditDevice(null)
            reload()
          } catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
          finally { setSaving(false) }
        }}
      />
    </div>
  )
}
