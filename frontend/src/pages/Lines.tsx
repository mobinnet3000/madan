import { useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Layers, Clock, AlertTriangle, ChevronDown, Info, Factory as FactoryIcon, Settings2,
  Plus, Pencil, Trash2, Search, GripVertical, Upload, Image as ImageIcon, X, Save,
  ArrowUp, ArrowDown, LayoutGrid, Workflow, Eye, EyeOff, Filter as FilterIcon, Cpu, ImageOff,
} from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { hasPerm } from '../constants'
import { Loading, EmptyState } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import AttributeEditor from '../components/AttributeEditor'
import {
  saveLineAttributes, saveDeviceAttributes,
  createDevice, updateDevice, deleteDevice, uploadDeviceImage,
  getDeviceTemplates, getLineTemplates, createLine, updateLine, deleteLine,
} from '../api/production'
import { useToast } from '../components/ui/Toast'
import { formatNumber } from '../utils'
import { LINE_TYPE_LABELS, LINE_TYPE_STYLE } from '../constants'
import type { LineType, ProductionLine, Device } from '../types'

type ViewMode = 'flow' | 'grid'

function imgUrl(path: string | null): string | null {
  if (!path) return null
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  if (path.startsWith('/media/')) return `https://mback.ba3tani.ir${path}`
  if (path.startsWith('media/')) return `https://mback.ba3tani.ir/${path}`
  return `https://mback.ba3tani.ir/media/${path}`
}

function DeviceThumb({ device, size = 64 }: { device: Device; size?: number }) {
  const [err, setErr] = useState(false)
  const src = useMemo(() => imgUrl(device.image), [device.image])
  if (src && !err) {
    return <img src={src} alt={device.name} onError={() => setErr(true)} className="h-full w-full object-cover" loading="lazy" style={{ height: size }} />
  }
  return (
    <div className="flex w-full items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200 text-slate-400 dark:from-slate-800 dark:to-slate-700 dark:text-slate-500" style={{ height: size }}>
      <ImageOff className="h-6 w-6" />
    </div>
  )
}

export default function Lines() {
  const { selectedFactory, loading, reload } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()

  const canManageLines = hasPerm(user?.permissions, 'lines.manage') || user?.is_superuser || user?.role === 'admin'
  const canManageDevices = hasPerm(user?.permissions, 'devices.manage') || user?.is_superuser || user?.role === 'admin'

  const [openAttrs, setOpenAttrs] = useState<Record<number, boolean>>({})
  const [editLine, setEditLine] = useState<ProductionLine | null>(null)
  const [editDevice, setEditDevice] = useState<Device | null>(null)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<LineType | ''>('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')
  const [expandedAll, setExpandedAll] = useState(false)

  const [showLineModal, setShowLineModal] = useState(false)
  const [editingLineMeta, setEditingLineMeta] = useState<ProductionLine | null>(null)
  const [lineForm, setLineForm] = useState({ name: '', description: '', line_type: 'crushing' as LineType, template: '' })
  const [lineTemplates, setLineTemplates] = useState<{ id: number; name: string }[]>([])
  const [deviceTemplates, setDeviceTemplates] = useState<{ id: number; name: string }[]>([])

  const [showDeviceModal, setShowDeviceModal] = useState(false)
  const [editingDeviceMeta, setEditingDeviceMeta] = useState<Device | null>(null)
  const [targetLineId, setTargetLineId] = useState<number | null>(null)
  const [deviceForm, setDeviceForm] = useState({ name: '', code: '', order: '0', template: '' })
  const [deviceImageFile, setDeviceImageFile] = useState<File | null>(null)
  const [deviceImagePreview, setDeviceImagePreview] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const [confirmDeleteLine, setConfirmDeleteLine] = useState<ProductionLine | null>(null)
  const [confirmDeleteDevice, setConfirmDeleteDevice] = useState<Device | null>(null)
  const [lineActionId, setLineActionId] = useState<number | null>(null)

  useEffect(() => {
    if (!canManageLines && !canManageDevices) return
    getLineTemplates().then(setLineTemplates).catch(() => {})
    getDeviceTemplates().then(setDeviceTemplates).catch(() => {})
  }, [canManageLines, canManageDevices, selectedFactory?.id])

  useEffect(() => {
    if (deviceImageFile) {
      const url = URL.createObjectURL(deviceImageFile)
      setDeviceImagePreview(url)
      return () => URL.revokeObjectURL(url)
    }
    setDeviceImagePreview(null)
  }, [deviceImageFile])

  if (loading) return <Loading />
  if (!selectedFactory) return <EmptyState title="کارخانه‌ای انتخاب نشده" description="لطفاً از بالا یک کارخانه انتخاب کنید یا در پنل ادمین بسازید." />

  const factory = selectedFactory

  const stats = useMemo(() => {
    const totalLines = factory.lines.length
    const totalDevices = factory.lines.reduce((s, l) => s + l.devices.length, 0)
    const byType = (['crushing', 'processing', 'conveying', 'other'] as LineType[]).map(t => ({
      type: t,
      count: factory.lines.filter(l => l.line_type === t).length,
      devices: factory.lines.filter(l => l.line_type === t).reduce((s, l) => s + l.devices.length, 0),
    }))
    return { totalLines, totalDevices, byType }
  }, [factory])

  const groups: { type: LineType; lines: ProductionLine[] }[] = []
  ;(['crushing', 'processing', 'conveying', 'other'] as LineType[]).forEach(t => {
    let lines = factory.lines.filter(l => l.line_type === t)
    if (typeFilter && t !== typeFilter) lines = []
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      lines = lines.filter(l =>
        l.name.toLowerCase().includes(q) ||
        l.description.toLowerCase().includes(q) ||
        l.template_name.toLowerCase().includes(q) ||
        l.devices.some(d => d.name.toLowerCase().includes(q) || d.code.toLowerCase().includes(q))
      )
    }
    if (lines.length) groups.push({ type: t, lines: [...lines].sort((a, b) => a.name.localeCompare(b.name, 'fa')) })
  })

  const hasAny = groups.some(g => g.lines.length > 0)

  const openCreateLine = () => {
    setEditingLineMeta(null)
    setLineForm({ name: '', description: '', line_type: 'crushing', template: String(lineTemplates[0]?.id ?? '') })
    setShowLineModal(true)
  }
  const openEditLineMeta = (line: ProductionLine) => {
    setEditingLineMeta(line)
    setLineForm({ name: line.name, description: line.description || '', line_type: line.line_type, template: '' })
    setShowLineModal(true)
  }
  const submitLineMeta = async () => {
    if (!lineForm.name.trim()) { notify('نام خط الزامی است', 'error'); return }
    setSaving(true)
    try {
      if (editingLineMeta) {
        const payload: any = { name: lineForm.name.trim(), description: lineForm.description, line_type: lineForm.line_type }
        if (lineForm.template) payload.template = Number(lineForm.template)
        await updateLine(editingLineMeta.id, payload)
        notify('خط ویرایش شد')
      } else {
        if (!lineForm.template && lineTemplates.length) { notify('الگو را انتخاب کنید', 'error'); setSaving(false); return }
        const payload: any = {
          factory: factory.id,
          name: lineForm.name.trim(),
          description: lineForm.description,
          line_type: lineForm.line_type,
          template: lineForm.template ? Number(lineForm.template) : lineTemplates[0]?.id,
        }
        await createLine(payload)
        notify('خط جدید ساخته شد')
      }
      setShowLineModal(false)
      setEditingLineMeta(null)
      reload()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره خط', 'error') }
    finally { setSaving(false) }
  }
  const confirmDeleteLineAction = async () => {
    if (!confirmDeleteLine) return
    setSaving(true)
    try {
      await deleteLine(confirmDeleteLine.id)
      notify('خط حذف شد')
      setConfirmDeleteLine(null)
      reload()
    } catch (e: any) { notify(e.message || 'خطا در حذف — از پنل ادمین حذف کنید', 'error') }
    finally { setSaving(false) }
  }

  const openCreateDevice = (lineId: number) => {
    setTargetLineId(lineId)
    setEditingDeviceMeta(null)
    const line = factory.lines.find(l => l.id === lineId)
    const nextOrder = line ? Math.max(0, ...line.devices.map(d => d.order)) + 1 : 1
    setDeviceForm({ name: '', code: '', order: String(nextOrder), template: String(deviceTemplates[0]?.id ?? '') })
    setDeviceImageFile(null)
    setShowDeviceModal(true)
  }
  const openEditDeviceMeta = (device: Device, lineId: number) => {
    setTargetLineId(lineId)
    setEditingDeviceMeta(device)
    setDeviceForm({ name: device.name, code: device.code || '', order: String(device.order), template: '' })
    setDeviceImageFile(null)
    setDeviceImagePreview(imgUrl(device.image))
    setShowDeviceModal(true)
  }
  const submitDeviceMeta = async () => {
    if (!targetLineId) return
    if (!deviceForm.name.trim()) { notify('نام دستگاه الزامی است', 'error'); return }
    setSaving(true)
    try {
      if (editingDeviceMeta) {
        const payload: any = { name: deviceForm.name.trim(), code: deviceForm.code.trim(), order: Number(deviceForm.order) || 0 }
        if (deviceForm.template) payload.template = Number(deviceForm.template)
        await updateDevice(editingDeviceMeta.id, payload)
        if (deviceImageFile) {
          try { await uploadDeviceImage(editingDeviceMeta.id, deviceImageFile) } catch (e: any) { notify('دستگاه ذخیره شد اما تصویر آپلود نشد: ' + (e.message || ''), 'error') }
        }
        notify('دستگاه ویرایش شد')
      } else {
        if (!deviceForm.template && deviceTemplates.length) { notify('الگوی دستگاه را انتخاب کنید', 'error'); setSaving(false); return }
        const payload: any = {
          line: targetLineId,
          name: deviceForm.name.trim(),
          code: deviceForm.code.trim(),
          order: Number(deviceForm.order) || 0,
          template: deviceForm.template ? Number(deviceForm.template) : deviceTemplates[0]?.id,
        }
        const created = await createDevice(payload)
        const newId = created?.id
        if (newId && deviceImageFile) {
          try { await uploadDeviceImage(newId, deviceImageFile) } catch (e: any) { notify('دستگاه ساخته شد اما تصویر آپلود نشد', 'error') }
        }
        notify('دستگاه جدید افزوده شد')
      }
      setShowDeviceModal(false)
      setEditingDeviceMeta(null)
      setDeviceImageFile(null)
      setTargetLineId(null)
      reload()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره دستگاه — بررسی کنید الگو و دسترسی ادمین', 'error') }
    finally { setSaving(false) }
  }
  const confirmDeleteDeviceAction = async () => {
    if (!confirmDeleteDevice) return
    setSaving(true)
    try {
      await deleteDevice(confirmDeleteDevice.id)
      notify('دستگاه حذف شد')
      setConfirmDeleteDevice(null)
      reload()
    } catch (e: any) { notify(e.message || 'خطا در حذف دستگاه', 'error') }
    finally { setSaving(false) }
  }
  const moveDevice = async (line: ProductionLine, deviceId: number, dir: 'up' | 'down') => {
    const sorted = [...line.devices].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex(d => d.id === deviceId)
    if (idx < 0) return
    const target = dir === 'up' ? idx - 1 : idx + 1
    if (target < 0 || target >= sorted.length) return
    setLineActionId(line.id)
    try {
      const a = sorted[idx], b = sorted[target]
      await updateDevice(a.id, { order: b.order })
      await updateDevice(b.id, { order: a.order })
      notify('ترتیب تغییر کرد')
      reload()
    } catch (e: any) { notify(e.message || 'خطا در جابجایی', 'error') }
    finally { setLineActionId(null) }
  }
  const removeDeviceImage = async (device: Device) => {
    if (!confirm('تصویر دستگاه حذف شود؟')) return
    setSaving(true)
    try {
      const { api } = await import('../api/client')
      await api.patch(`/devices/${device.id}/`, { image: null })
      notify('تصویر حذف شد')
      reload()
    } catch (e: any) { notify(e.message || 'خطا در حذف تصویر', 'error') }
    finally { setSaving(false) }
  }

  return (
    <div className="animate-fade-in space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex gap-3">
            <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:flex"><FactoryIcon className="h-5 w-5" /></div>
            <div>
              <h1 className="flex items-center gap-2 text-[17px] font-extrabold tracking-tight text-slate-900 dark:text-white">مدل‌سازی خطوط فرآوری <span className="hidden rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300 sm:inline-flex">{factory.name}</span></h1>
              <p className="mt-1 max-w-[560px] text-sm leading-5 text-slate-500 dark:text-slate-400">مدیریت کامل خطوط و دستگاه‌ها — افزودن، ویرایش، تصویر، ترتیب و ویژگی‌های فنی. فقط ادمین.</p>
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"><Layers className="h-3 w-3" />{formatNumber(stats.totalLines)} خط</span>
                <span className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:border-indigo-900/50 dark:bg-indigo-950/30 dark:text-indigo-300"><Cpu className="h-3 w-3" />{formatNumber(stats.totalDevices)} دستگاه</span>
                <span className="hidden text-xs text-slate-400 dark:text-slate-500 sm:inline">· {stats.byType.filter(b => b.count).map(b => `${LINE_TYPE_LABELS[b.type]} ${formatNumber(b.count)}`).join(' · ')}</span>
              </div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-start">
            {canManageLines && <button className="btn-primary !h-[42px] !px-5 !text-sm shadow-sm" onClick={openCreateLine}><Plus className="h-4 w-4" /> خط جدید</button>}
          </div>
        </div>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card grid grid-cols-1 gap-4 p-4 md:grid-cols-3 dark:bg-slate-900">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/40"><FactoryIcon className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="text-xs text-slate-400">نام کارخانه</div>
            <div className="truncate font-bold text-slate-800 dark:text-slate-100">{factory.name}</div>
            {factory.address && <div className="mt-0.5 text-xs text-slate-500 line-clamp-2">{factory.address}</div>}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400"><Clock className="h-3.5 w-3.5" /> شیفت‌های کاری</div>
          <div className="flex flex-wrap gap-1.5">
            {factory.shifts.map(s => <span key={s.id} className="chip text-xs">{s.name} · {s.start_time.slice(0, 5)}-{s.end_time.slice(0, 5)}</span>)}
            {factory.shifts.length === 0 && <span className="text-xs text-slate-400">—</span>}
          </div>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs text-slate-400"><AlertTriangle className="h-3.5 w-3.5" /> علل خرابی مرجع</div>
          <div className="flex flex-wrap gap-1.5">
            {factory.failure_reasons.map(f => <span key={f.id} className="badge bg-rose-50 text-rose-600 dark:bg-rose-950/30 dark:text-rose-300">{f.title}</span>)}
            {factory.failure_reasons.length === 0 && <span className="text-xs text-slate-400">—</span>}
          </div>
        </div>
      </motion.div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[180px] flex-1 max-w-[360px]">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input className="input !h-9 !rounded-xl !py-0 pr-9 text-sm" placeholder="جستجو خط، دستگاه، کد، الگو..." value={search} onChange={e => setSearch(e.target.value)} />
              {search && <button onClick={() => setSearch('')} className="absolute left-1.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="hidden text-xs text-slate-500 sm:inline">نوع:</span>
              <select className="input !h-9 !w-[150px] !rounded-xl !py-0 text-sm" value={typeFilter} onChange={e => setTypeFilter(e.target.value as any)}>
                <option value="">همه انواع</option>
                {(Object.keys(LINE_TYPE_LABELS) as LineType[]).map(t => <option key={t} value={t}>{LINE_TYPE_LABELS[t]}</option>)}
              </select>
              {(search || typeFilter) && <button className="btn-ghost !h-9 !px-3 text-xs" onClick={() => { setSearch(''); setTypeFilter('') }}><X className="h-3.5 w-3.5" /> پاک کردن</button>}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <button onClick={() => setExpandedAll(v => !v)} className="btn-ghost !h-9 !px-3 text-xs">{expandedAll ? <><EyeOff className="h-3.5 w-3.5" /> بستن همه</> : <><Eye className="h-3.5 w-3.5" /> باز کردن همه</>}</button>
              <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" />
              <button onClick={() => setViewMode('grid')} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-slate-600 dark:text-slate-300 ${viewMode === 'grid' ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`} title="نمای کارت"><LayoutGrid className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('flow')} className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-slate-600 dark:text-slate-300 ${viewMode === 'flow' ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800'}`} title="نمای جریان"><Workflow className="h-4 w-4" /></button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            <FilterIcon className="h-3.5 w-3.5 text-slate-400" />
            {(['crushing', 'processing', 'conveying', 'other'] as LineType[]).map(t => {
              const c = stats.byType.find(b => b.type === t)!
              return <span key={t} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${typeFilter === t ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>{LINE_TYPE_LABELS[t]} · {formatNumber(c.count)} خط · {formatNumber(c.devices)} دستگاه</span>
            })}
          </div>
        </div>
      </div>

      {factory.lines.length === 0 ? (
        <EmptyState icon={<Layers className="h-10 w-10" />} title="خط فرآوری تعریف نشده است" description="ادمین می‌تواند از دکمه «خط جدید» اولین خط را بسازد یا از پنل ادمین Django." action={canManageLines ? <button className="btn-primary mt-2" onClick={openCreateLine}><Plus className="h-4 w-4" /> ساخت اولین خط</button> : undefined} />
      ) : !hasAny ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-10 text-center dark:border-slate-700 dark:bg-slate-900/40">
          <Search className="mx-auto h-10 w-10 text-slate-300 dark:text-slate-600" />
          <div className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">نتیجه‌ای یافت نشد</div>
          <p className="mx-auto mt-1 text-sm text-slate-500">فیلتر یا جستجو را تغییر دهید.</p>
          <button className="btn-ghost mt-3" onClick={() => { setSearch(''); setTypeFilter('') }}><X className="h-4 w-4" /> پاک کردن فیلترها</button>
        </div>
      ) : (
        <div className="space-y-8">
          {groups.map(group => {
            const style = LINE_TYPE_STYLE[group.type]
            return (
              <section key={group.type}>
                <div className="mb-3 flex items-center gap-2">
                  <span className={`h-3 w-3 rounded-full ${style.dot}`} />
                  <h2 className="text-base font-bold text-slate-800 dark:text-slate-100">خطوط {LINE_TYPE_LABELS[group.type]}</h2>
                  <span className="chip">{formatNumber(group.lines.length)} خط</span>
                </div>
                <div className="space-y-5">
                  {group.lines.map((line, idx) => {
                    const attrs = Object.entries(line.attributes_values || {})
                    const isOpen = expandedAll || (openAttrs[line.id] ?? false)
                    const devicesSorted = [...line.devices].sort((a, b) => a.order - b.order)
                    return (
                      <motion.div key={line.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }} className="card overflow-hidden">
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-amber-500 text-xs font-bold text-white">{line.id}</span>
                            <div>
                              <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{line.name}</div>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                <span className={`badge ${style.badge}`}>{LINE_TYPE_LABELS[line.line_type]}</span>
                                <span>الگو: {line.template_name}</span>
                                <span className="hidden sm:inline">· {formatNumber(line.devices.length)} دستگاه</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-1">
                            {attrs.length > 0 && (
                              <button onClick={() => setOpenAttrs(p => ({ ...p, [line.id]: !p[line.id] }))} className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950/30">
                                <Info className="h-3.5 w-3.5" /> ویژگی‌های فنی <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                              </button>
                            )}
                            <button onClick={() => setEditLine(line)} className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              <Settings2 className="h-3.5 w-3.5" /> ویژگی‌ها
                            </button>
                            {canManageLines && (
                              <>
                                <button onClick={() => openEditLineMeta(line)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
                                  <Pencil className="h-3.5 w-3.5" /> ویرایش خط
                                </button>
                                <button onClick={() => setConfirmDeleteLine(line)} className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30">
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </>
                            )}
                            {canManageDevices && (
                              <button onClick={() => openCreateDevice(line.id)} className="btn-primary !h-8 !px-3 !py-1 !text-xs"><Plus className="h-3.5 w-3.5" /> دستگاه</button>
                            )}
                          </div>
                        </div>

                        {line.description && <div className="border-b border-slate-100 bg-white px-4 py-2 text-xs leading-5 text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">{line.description}</div>}

                        <AnimatePresence>
                          {isOpen && attrs.length > 0 && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="flex flex-wrap gap-2 border-b border-slate-100 bg-slate-50/60 px-4 py-3 dark:border-slate-800 dark:bg-slate-800/40">
                              {attrs.map(([k, v]) => {
                                const unit = line.attribute_defs.find(d => d.name === k)?.unit || ''
                                return <span key={k} className="chip text-xs"><span className="text-slate-400">{k}:</span> <span className="font-semibold text-slate-700 dark:text-slate-200">{formatNumber(v as number)}</span> {unit && <span className="text-[10px] text-slate-400">{unit}</span>}</span>
                              })}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div className="p-4">
                          {devicesSorted.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-300 py-8 text-center dark:border-slate-700">
                              <Cpu className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
                              <div className="mt-2 text-sm font-bold text-slate-600 dark:text-slate-300">دستگاهی در این خط نیست</div>
                              <p className="text-xs text-slate-400">ادمین می‌تواند دستگاه اضافه کند.</p>
                              {canManageDevices && <button className="btn-primary mt-3 !h-9 !px-4 text-xs" onClick={() => openCreateDevice(line.id)}><Plus className="h-4 w-4" /> افزودن دستگاه</button>}
                            </div>
                          ) : viewMode === 'flow' ? (
                            <div className="flex items-stretch gap-0 overflow-x-auto pb-2">
                              {devicesSorted.map((d, i) => (
                                <div key={d.id} className="flex items-center">
                                  <div className="group relative flex w-52 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-xl hover:ring-2 hover:ring-orange-200 dark:border-slate-700 dark:bg-slate-800">
                                    <div className="relative">
                                      <DeviceThumb device={d} size={72} />
                                      <span className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-lg bg-slate-900/80 text-[11px] font-bold text-white backdrop-blur">{i + 1}</span>
                                    </div>
                                    <div className="flex flex-1 flex-col p-3">
                                      <div className="truncate text-sm font-bold text-slate-800 dark:text-slate-100" title={d.name}>{d.name}</div>
                                      <div className="text-[11px] text-slate-400">{d.code ? `${d.code} · ` : ''}{d.template_name}</div>
                                      <div className="mt-2 flex flex-wrap gap-1">
                                        {Object.entries(d.attributes_values || {}).slice(0, 2).map(([k, v]) => <span key={k} className="chip !px-1.5 !py-0.5 text-[10px]">{k}: {formatNumber(v as number)}</span>)}
                                      </div>
                                      <div className="mt-3 flex items-center gap-1">
                                        <button onClick={() => setEditDevice(d)} className="flex-1 rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900"><Settings2 className="mr-1 inline h-3 w-3" /> ویژگی</button>
                                        {canManageDevices && <><button onClick={() => openEditDeviceMeta(d, line.id)} className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" title="ویرایش"><Pencil className="h-3.5 w-3.5" /></button><button onClick={() => setConfirmDeleteDevice(d)} className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button></>}
                                      </div>
                                    </div>
                                  </div>
                                  {i < devicesSorted.length - 1 && <div className="flex w-10 shrink-0 items-center justify-center text-slate-300"><svg width="36" height="20" viewBox="0 0 36 20" fill="none"><path d="M0 10 H28" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4" /><path d="M26 4 L34 10 L26 16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg></div>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                              {devicesSorted.map((d, i) => (
                                <div key={d.id} className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-lg dark:border-slate-700 dark:bg-slate-800">
                                  <div className="relative overflow-hidden">
                                    <DeviceThumb device={d} size={96} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition group-hover:opacity-100" />
                                    <span className="absolute right-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[11px] font-bold text-white backdrop-blur">#{d.order || i + 1}</span>
                                    {canManageDevices && (
                                      <div className="absolute bottom-1 left-1 flex gap-1 opacity-0 transition group-hover:opacity-100">
                                        <button onClick={() => moveDevice(line, d.id, 'up')} disabled={i === 0 || lineActionId === line.id} className="rounded-lg bg-white/90 p-1 text-slate-700 shadow hover:bg-white disabled:opacity-40"><ArrowUp className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => moveDevice(line, d.id, 'down')} disabled={i === devicesSorted.length - 1 || lineActionId === line.id} className="rounded-lg bg-white/90 p-1 text-slate-700 shadow hover:bg-white disabled:opacity-40"><ArrowDown className="h-3.5 w-3.5" /></button>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex flex-1 flex-col p-3">
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="min-w-0">
                                        <div className="truncate text-sm font-bold leading-tight text-slate-800 dark:text-slate-100" title={d.name}>{d.name}</div>
                                        <div className="truncate text-[11px] text-slate-400">{d.code ? <span className="font-mono font-medium text-slate-500">{d.code} · </span> : null}{d.template_name}</div>
                                      </div>
                                      <span className="shrink-0 rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">{i + 1}</span>
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1">
                                      {Object.entries(d.attributes_values || {}).length === 0 ? <span className="text-[11px] text-slate-400">بدون ویژگی</span> : Object.entries(d.attributes_values || {}).slice(0, 3).map(([k, v]) => {
                                        const unit = d.attribute_defs.find(a => a.name === k)?.unit || ''
                                        return <span key={k} className="chip !px-1.5 !py-0.5 text-[10px]">{k} {formatNumber(v as number)} {unit && <span className="text-slate-400">{unit}</span>}</span>
                                      })}
                                      {Object.keys(d.attributes_values || {}).length > 3 && <span className="text-[10px] text-slate-400">+{Object.keys(d.attributes_values || {}).length - 3}</span>}
                                    </div>
                                    <div className="mt-3 grid grid-cols-3 gap-1">
                                      <button onClick={() => setEditDevice(d)} className="col-span-2 inline-flex items-center justify-center gap-1 rounded-xl bg-slate-900 px-2 py-1.5 text-xs font-bold text-white hover:bg-black dark:bg-white dark:text-slate-900"><Settings2 className="h-3 w-3" /> ویژگی‌ها</button>
                                      {canManageDevices ? (
                                        <div className="flex gap-1">
                                          <button onClick={() => openEditDeviceMeta(d, line.id)} className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" title="ویرایش"><Pencil className="h-3.5 w-3.5" /></button>
                                          <button onClick={() => setConfirmDeleteDevice(d)} className="flex items-center justify-center rounded-xl bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-950/50" title="حذف"><Trash2 className="h-3.5 w-3.5" /></button>
                                        </div>
                                      ) : <button onClick={() => setEditDevice(d)} className="rounded-xl border border-slate-200 bg-white p-1.5 text-slate-500 dark:border-slate-700 dark:bg-slate-800"><Eye className="h-3.5 w-3.5" /></button>}
                                    </div>
                                    {canManageDevices && d.image && <button onClick={() => removeDeviceImage(d)} className="mt-1 text-center text-[11px] text-slate-400 hover:text-rose-600">حذف تصویر</button>}
                                  </div>
                                </div>
                              ))}
                              {canManageDevices && (
                                <button onClick={() => openCreateDevice(line.id)} className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/60 p-6 text-slate-500 transition hover:border-orange-300 hover:bg-orange-50/50 hover:text-orange-600 dark:border-slate-700 dark:bg-slate-800/40 dark:hover:border-orange-400/50">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white shadow-sm dark:bg-slate-700"><Plus className="h-5 w-5" /></div>
                                  <span className="text-sm font-bold">افزودن دستگاه</span>
                                  <span className="text-xs">به {line.name}</span>
                                </button>
                              )}
                            </div>
                          )}
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
        onSave={async vals => {
          if (!editLine) return
          setSaving(true)
          try { await saveLineAttributes(editLine.id, vals); notify('ویژگی‌های فنی خط ذخیره شد'); setEditLine(null); reload() }
          catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
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
        onSave={async vals => {
          if (!editDevice) return
          setSaving(true)
          try { await saveDeviceAttributes(editDevice.id, vals); notify('ویژگی‌های فنی دستگاه ذخیره شد'); setEditDevice(null); reload() }
          catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
          finally { setSaving(false) }
        }}
      />

      <Modal open={showLineModal} onClose={() => setShowLineModal(false)} title={editingLineMeta ? 'ویرایش خط تولید' : 'خط جدید'} subtitle={factory.name} footer={<><button className="btn-ghost" onClick={() => setShowLineModal(false)}>انصراف</button><button className="btn-primary" onClick={submitLineMeta} disabled={saving}><Save className="h-4 w-4" /> {saving ? 'در حال ذخیره...' : editingLineMeta ? 'ذخیره تغییرات' : 'ساخت خط'}</button></>}>
        <div className="space-y-3">
          <div><label className="label">نام خط *</label><input className="input" value={lineForm.name} onChange={e => setLineForm({ ...lineForm, name: e.target.value })} placeholder="مثال: خط خردایش ۱" /></div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">نوع خط</label><select className="input" value={lineForm.line_type} onChange={e => setLineForm({ ...lineForm, line_type: e.target.value as LineType })}>{(Object.keys(LINE_TYPE_LABELS) as LineType[]).map(t => <option key={t} value={t}>{LINE_TYPE_LABELS[t]}</option>)}</select></div>
            <div><label className="label">الگو {editingLineMeta ? '(خالی = بدون تغییر)' : '*'}</label><select className="input" value={lineForm.template} onChange={e => setLineForm({ ...lineForm, template: e.target.value })}><option value="">— انتخاب الگو —</option>{lineTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select>{!lineTemplates.length && <div className="mt-1 text-[11px] text-amber-600">الگوها از API لود نشد — از پنل ادمین بسازید یا ID دستی وارد کنید.</div>}</div>
          </div>
          <div><label className="label">توضیحات</label><textarea className="input min-h-[70px]" value={lineForm.description} onChange={e => setLineForm({ ...lineForm, description: e.target.value })} placeholder="اختیاری" /></div>
          {!editingLineMeta && !lineTemplates.length && <div><label className="label">ID الگو (دستی)</label><input className="input" value={lineForm.template} onChange={e => setLineForm({ ...lineForm, template: e.target.value })} placeholder="مثال: 1" /></div>}
        </div>
      </Modal>

      <Modal open={showDeviceModal} onClose={() => { setShowDeviceModal(false); setDeviceImageFile(null) }} title={editingDeviceMeta ? 'ویرایش دستگاه' : 'دستگاه جدید'} subtitle={factory.lines.find(l => l.id === targetLineId)?.name} size="lg" footer={<><button className="btn-ghost" onClick={() => { setShowDeviceModal(false); setDeviceImageFile(null) }}>انصراف</button><button className="btn-primary" onClick={submitDeviceMeta} disabled={saving}><Save className="h-4 w-4" /> {saving ? 'در حال ذخیره...' : editingDeviceMeta ? 'ذخیره تغییرات' : 'ساخت دستگاه'}</button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div><label className="label">نام دستگاه *</label><input className="input" value={deviceForm.name} onChange={e => setDeviceForm({ ...deviceForm, name: e.target.value })} placeholder="مثال: سنگ‌شکن فکی" /></div>
            <div><label className="label">کد فنی</label><input className="input font-mono" dir="ltr" value={deviceForm.code} onChange={e => setDeviceForm({ ...deviceForm, code: e.target.value })} placeholder="مثال: CR-01" /></div>
            <div><label className="label">ترتیب در خط</label><input type="number" className="input" value={deviceForm.order} onChange={e => setDeviceForm({ ...deviceForm, order: e.target.value })} /></div>
            <div><label className="label">الگو {editingDeviceMeta ? '(خالی = بدون تغییر)' : '*'}</label><select className="input" value={deviceForm.template} onChange={e => setDeviceForm({ ...deviceForm, template: e.target.value })}><option value="">— انتخاب الگو —</option>{deviceTemplates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
          </div>
          <div>
            <label className="label">تصویر دستگاه</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                {deviceImagePreview ? <img src={deviceImagePreview} alt="preview" className="h-full w-full object-cover" /> : editingDeviceMeta?.image ? <img src={imgUrl(editingDeviceMeta.image) || ''} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-6 w-6 text-slate-400" />}
              </div>
              <div className="flex flex-1 flex-col gap-2">
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => setDeviceImageFile(e.target.files?.[0] || null)} />
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn-ghost !h-9" onClick={() => fileRef.current?.click()}><Upload className="h-4 w-4" /> انتخاب تصویر</button>
                  {deviceImageFile && <button type="button" className="btn-ghost !h-9" onClick={() => setDeviceImageFile(null)}><X className="h-4 w-4" /> حذف انتخاب</button>}
                </div>
                <p className="text-[11px] leading-4 text-slate-400">فرمت JPG/PNG/WebP — حداکثر چند مگابایت. تصویر پس از ذخیره دستگاه آپلود می‌شود. اگر API دستگاه 404 داد، از پنل ادمین بسازید.</p>
                {deviceImageFile && <span className="chip w-fit text-xs">{deviceImageFile.name} · {(deviceImageFile.size / 1024).toFixed(0)} KB</span>}
              </div>
            </div>
          </div>
          {!deviceTemplates.length && <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30">الگوی دستگاه از API لود نشد — اگر ساخت خطا داد، ابتدا از /admin الگوی دستگاه بسازید.</div>}
        </div>
      </Modal>

      <Modal open={confirmDeleteLine != null} onClose={() => setConfirmDeleteLine(null)} title="حذف خط تولید" footer={<><button className="btn-ghost" onClick={() => setConfirmDeleteLine(null)}>انصراف</button><button className="btn-danger" onClick={confirmDeleteLineAction} disabled={saving}><Trash2 className="h-4 w-4" /> حذف قطعی</button></>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">خط <b>{confirmDeleteLine?.name}</b> و تمام دستگاه‌های آن حذف شود؟ این عمل قابل بازگشت نیست.</p>
      </Modal>
      <Modal open={confirmDeleteDevice != null} onClose={() => setConfirmDeleteDevice(null)} title="حذف دستگاه" footer={<><button className="btn-ghost" onClick={() => setConfirmDeleteDevice(null)}>انصراف</button><button className="btn-danger" onClick={confirmDeleteDeviceAction} disabled={saving}><Trash2 className="h-4 w-4" /> حذف دستگاه</button></>}>
        <p className="text-sm text-slate-600 dark:text-slate-300">دستگاه <b>{confirmDeleteDevice?.name}</b> حذف شود؟</p>
      </Modal>
    </div>
  )
}
