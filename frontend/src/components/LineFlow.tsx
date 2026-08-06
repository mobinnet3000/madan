import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Cpu, FlaskConical, ImageOff } from 'lucide-react'
import type { ProductionLine, Device } from '../types'
import { formatNumber } from '../utils'
import { LINE_TYPE_STYLE, LINE_TYPE_LABELS } from '../constants'

function imgUrl(path: string | null): string | null {
  if (!path) return null
  // آدرس‌های مطلق را به مسیر نسبی تبدیل کن تا همیشه از هاست فعلی (لوکال/هاست) لود شوند
  let p = path
  if (/^https?:\/\//i.test(p)) {
    try {
      p = new URL(p).pathname
    } catch {
      /* keep original */
    }
  }
  if (p.startsWith('/media/')) return p
  if (p.startsWith('media/')) return '/' + p
  return '/media/' + p
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
        className="h-16 w-full rounded-lg object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex h-16 w-full items-center justify-center rounded-lg bg-gradient-to-br from-ink-100 to-ink-200 text-ink-300">
      <ImageOff className="h-6 w-6" />
    </div>
  )
}

function DeviceNode({ device, index }: { device: Device; index: number }) {
  const attrs = Object.entries(device.attributes_values || {})
  return (
    <motion.div
      whileHover={{ y: -6, scale: 1.03 }}
      transition={{ type: 'spring', stiffness: 300, damping: 18 }}
      className="group relative flex w-48 shrink-0 flex-col overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm hover:shadow-xl hover:ring-2 hover:ring-brand-200"
    >
      <DeviceImage device={device} />
      <div className="flex flex-1 flex-col p-3">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-ink-100 text-[11px] font-bold text-ink-500">
            {index + 1}
          </span>
          {device.is_analyzer ? (
            <span className="badge bg-violet-100 text-violet-700">
              <FlaskConical className="h-3 w-3" /> آنالایزر
            </span>
          ) : (
            <span className="badge bg-ink-100 text-ink-500">
              <Cpu className="h-3 w-3" /> دستگاه
            </span>
          )}
        </div>

        <div className="truncate text-sm font-bold text-ink-800" title={device.name}>
          {device.name}
        </div>
        <div className="mb-2 truncate text-[11px] text-ink-400">{device.template_name}</div>

        <div className="mt-auto space-y-1 border-t border-ink-100 pt-2">
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

export default function LineFlow({ line }: { line: ProductionLine }) {
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
        <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
          {devices.map((d, i) => (
            <div key={d.id} className="flex items-center">
              <DeviceNode device={d} index={i} />
              {i < devices.length - 1 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex w-10 shrink-0 items-center justify-center text-ink-300"
                >
                  <svg width="36" height="20" viewBox="0 0 36 20" fill="none">
                    <path d="M0 10 H28" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" />
                    <path d="M26 4 L34 10 L26 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
