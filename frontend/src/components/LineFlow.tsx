import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Cpu, ImageOff, Settings2 } from 'lucide-react'
import type { ProductionLine, Device } from '../types'
import { formatNumber } from '../utils'
import { LINE_TYPE_STYLE, LINE_TYPE_LABELS } from '../constants'

function imgUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/media/')) return path
  if (path.startsWith('media/')) return `/${path}`
  if (path.startsWith('/')) return path
  return `/media/${path}`
}

function DeviceImage({ device }: { device: Device }) {
  const [err, setErr] = useState(false)
  const src = useMemo(() => imgUrl(device.image), [device.image])
  if (src && !err) {
    return (
      <img
        src={src}
        alt={device.name}
        onError={() => setErr(true)}
        className="aspect-[3/2] w-full bg-slate-50 object-contain dark:bg-slate-700/30"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex aspect-[3/2] w-full items-center justify-center rounded-lg bg-gradient-to-br from-ink-100 to-ink-200 text-ink-300">
      <ImageOff className="h-6 w-6" />
    </div>
  )
}

function groupByOrder(devices: Device[]): Device[][] {
  const g = new Map<number, Device[]>()
  for (const d of devices) g.set(d.order ?? 0, [...(g.get(d.order ?? 0) ?? []), d])
  return [...g.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v)
}

function DeviceNode({ device, index, onEdit }: { device: Device; index: number; onEdit?: (d: Device) => void }) {
  const attrs = Object.entries(device.attributes_values || {})
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      className="group relative flex min-h-[220px] w-48 shrink-0 flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm hover:shadow-xl hover:ring-2 hover:ring-brand-200"
    >
      <DeviceImage device={device} />
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-ink-100 text-[11px] font-bold text-ink-500">
            {index + 1}
          </span>
          <div className="flex items-center gap-1">
            <span className="badge bg-ink-100 text-ink-500">
              <Cpu className="h-3 w-3" /> دستگاه
            </span>
            {onEdit && (
              <button
                onClick={() => onEdit(device)}
                className="rounded-md p-1 text-ink-300 opacity-0 transition hover:bg-brand-50 hover:text-brand-600 group-hover:opacity-100"
                title="ویرایش ویژگی‌های فنی"
              >
                <Settings2 className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        <div className="min-h-[40px]">
          <div className="truncate text-sm font-bold text-ink-800" title={device.name}>
            {device.name}
          </div>
          <div className="text-[11px] text-ink-400">
            {device.code ? `${device.code} · ` : ''}{device.template_name}
          </div>
        </div>

        <div className="mt-2 flex min-h-[54px] flex-col justify-start space-y-1 border-t border-ink-100 pt-2">
          {attrs.length === 0 && (
            <div className="text-[11px] text-ink-400">ویژگی ثبت نشده</div>
          )}
          {attrs.slice(0, 3).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between text-[11px]">
              <span className="text-ink-500">{k}</span>
              <span className="font-semibold text-ink-700">{formatNumber(v)}</span>
            </div>
          ))}
          {attrs.length > 3 && (
            <div className="text-[10px] text-ink-400">+{attrs.length - 3} مورد دیگر</div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function LineFlow({ line, onEditDevice }: { line: ProductionLine; onEditDevice?: (d: Device) => void }) {
  const devices = [...line.devices].sort((a, b) => a.order - b.order)
  const style = LINE_TYPE_STYLE[line.line_type]

  return (
    <div className="rounded-2xl border border-ink-200 bg-ink-50/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${style.dot}`} />
          <h4 className="text-sm font-bold text-ink-800">{line.name}</h4>
          <span className={`badge ${style.badge}`}>{LINE_TYPE_LABELS[line.line_type]}</span>
          <span className="chip">{line.template_name}</span>
        </div>
        <span className="text-xs text-ink-400">
          {devices.length} دستگاه · مسیر فرآوری
        </span>
      </div>

      {line.description && (
        <p className="mb-3 text-xs text-ink-500">{line.description}</p>
      )}

      {devices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-ink-300 py-8 text-center text-xs text-ink-400">
          دستگاهی در این خط تعریف نشده است
        </div>
      ) : (
        <div className="flex items-start gap-0 overflow-x-auto pb-2">
          {groupByOrder(devices).map((level, li, arr) => (
            <div key={li} className="flex items-center">
              <div className="flex flex-col gap-3">
                {level.map((d) => {
                  const idx = devices.indexOf(d)
                  return <DeviceNode key={d.id} device={d} index={idx} onEdit={onEditDevice} />
                })}
              </div>
              {li < arr.length - 1 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex w-10 shrink-0 items-center justify-center text-ink-300">
                  <svg width="36" height="20" viewBox="0 0 36 20" fill="none"><path d="M36 10 H8" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" /><path d="M10 4 L2 10 L10 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
