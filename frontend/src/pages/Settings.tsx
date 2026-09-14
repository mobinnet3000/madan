import { useEffect, useMemo, useState } from 'react'
import { Settings as SettingsIcon, Building2, Workflow, Clock, Users, AlertTriangle, Wrench, Layers, Plus, Pencil, Trash2, Save, X, ShieldCheck } from 'lucide-react'
import { useFactory } from '../store/FactoryContext'
import { useAuth } from '../store/AuthContext'
import { hasPerm } from '../constants'
import { useToast } from '../components/ui/Toast'
import { EmptyState, Loading } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import { api } from '../api/client'
import { getShifts, createShift, updateShift, deleteShift } from '../api/shifts'

type Tab = 'factories' | 'lines' | 'shifts' | 'org' | 'attrs'
type FactoryRow = { id: number; name: string; address: string }
type LineRow = { id: number; factory: number; name: string; description: string; line_type: string; template: number }
type ContractorRow = { id: number; factory: number; name: string; contact_name: string; phone: string; is_active: boolean }
type FailureRow = { id: number; title: string }
type AttrRow = { id: number; name: string; unit: string }
type TplRow = { id: number; name: string; description: string }

export default function Settings() {
  const { selectedFactory, factories, reload } = useFactory()
  const { user } = useAuth()
  const { notify } = useToast()
  const canView = hasPerm(user?.permissions, 'settings.view') || user?.is_superuser || user?.role === 'admin'
  const canManage = hasPerm(user?.permissions, 'settings.manage') || user?.is_superuser || user?.role === 'admin'
  const canContractor = hasPerm(user?.permissions, 'contractor.manage') || canManage
  const [tab, setTab] = useState<Tab>('factories')
  if (!canView) return <EmptyState icon={<ShieldCheck className="h-10 w-10" />} title="دسترسی غیرمجاز" description="برای مشاهده تنظیمات نیاز به دسترسی settings.view دارید — از مدیریت کاربران فعال کنید." />

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex gap-3">
          <div className="hidden h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 sm:flex"><SettingsIcon className="h-5 w-5" /></div>
          <div>
            <h1 className="text-[17px] font-extrabold text-slate-900 dark:text-white">تنظیمات کارخانه و خطوط</h1>
            <p className="mt-1 text-sm text-slate-500">مدیریت کامل کارخانه‌ها، خطوط، شیفت‌های هر خط، پیمانکاران، علل خرابی، ویژگی‌ها و الگوها — پرمیشن <b>settings.view / settings.manage</b> از تب نقش‌ها قابل کنترل است.</p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {([
            ['factories', 'کارخانه‌ها', Building2],
            ['lines', 'خطوط تولید', Workflow],
            ['shifts', 'شیفت هر خط', Clock],
            ['org', 'پیمانکار / علت خرابی', Users],
            ['attrs', 'ویژگی و الگو', Wrench],
          ] as const).map(([k, label, Icon]) => (
            <button key={k} onClick={() => setTab(k as Tab)} className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-bold ${tab === k ? 'border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900' : 'border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'}`}>
              <Icon className="h-4 w-4" /> {label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'factories' && <FactoriesTab factories={factories} canManage={canManage} reload={reload} notify={notify} />}
      {tab === 'lines' && <LinesTab factories={factories} canManage={canManage} reload={reload} notify={notify} />}
      {tab === 'shifts' && <ShiftsTab factories={factories} canManage={canManage} notify={notify} />}
      {tab === 'org' && <OrgTab factories={factories} canManage={canContractor} canManageSettings={canManage} notify={notify} selectedFactory={selectedFactory} />}
      {tab === 'attrs' && <AttrsTab canManage={canManage} notify={notify} />}
    </div>
  )
}

function FactoriesTab({ factories, canManage, reload, notify }: any) {
  const [rows, setRows] = useState<FactoryRow[]>(factories)
  useEffect(() => setRows(factories), [factories])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FactoryRow | null>(null)
  const [form, setForm] = useState({ name: '', address: '' })
  const [saving, setSaving] = useState(false)
  const openCreate = () => { setEditing(null); setForm({ name: '', address: '' }); setOpen(true) }
  const openEdit = (r: FactoryRow) => { setEditing(r); setForm({ name: r.name, address: r.address }); setOpen(true) }
  const submit = async () => {
    if (!form.name.trim()) { notify('نام کارخانه الزامی است', 'error'); return }
    setSaving(true)
    try {
      if (editing) await api.patch(`/factories/${editing.id}/`, { name: form.name.trim(), address: form.address })
      else await api.post('/factories/', { name: form.name.trim(), address: form.address })
      notify(editing ? 'کارخانه ویرایش شد' : 'کارخانه ساخته شد'); setOpen(false); reload()
    } catch (e: any) { notify(e.message, 'error') } finally { setSaving(false) }
  }
  const del = async (r: FactoryRow) => {
    if (!confirm(`حذف کارخانه ${r.name}؟`)) return
    try { await api.delete(`/factories/${r.id}/`); notify('حذف شد'); reload() } catch (e: any) { notify(e.message, 'error') }
  }
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">کارخانه‌ها ({rows.length})</h3>{canManage && <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> کارخانه جدید</button>}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-right text-xs text-slate-500"><th className="px-3 py-2">نام</th><th className="px-3 py-2">آدرس</th><th className="px-3 py-2">عملیات</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b"><td className="px-3 py-2 font-bold">{r.name}</td><td className="px-3 py-2 text-xs text-slate-500">{r.address || '—'}</td><td className="px-3 py-2"><div className="flex gap-1">{canManage && <><button className="rounded p-1 hover:bg-slate-100" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-rose-50 text-rose-600" onClick={() => del(r)}><Trash2 className="h-4 w-4" /></button></>}</div></td></tr>)}</tbody></table></div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'ویرایش کارخانه' : 'کارخانه جدید'} footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit} disabled={saving}><Save className="h-4 w-4" /> {saving ? '...' : 'ذخیره'}</button></>}>
        <div className="space-y-3"><div><label className="label">نام *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div><div><label className="label">آدرس</label><textarea className="input" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div></div>
      </Modal>
    </div>
  )
}

function LinesTab({ factories, canManage, reload, notify }: any) {
  const [rows, setRows] = useState<LineRow[]>([])
  const [tpls, setTpls] = useState<TplRow[]>([])
  const [loading, setLoading] = useState(true)
  const load = async () => { setLoading(true); try { const [a, b] = await Promise.all([api.get('/production-lines/').then(r => r.data), api.get('/production-line-templates/').then(r => r.data).catch(() => [])]); setRows(Array.isArray(a) ? a : a.results ?? []); setTpls(Array.isArray(b) ? b : b.results ?? []) } catch { } finally { setLoading(false) } }
  useEffect(() => { load() }, [])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<LineRow | null>(null)
  const [form, setForm] = useState({ factory: '', name: '', description: '', line_type: 'crushing', template: '' })
  const openCreate = () => { setEditing(null); setForm({ factory: String(factories[0]?.id ?? ''), name: '', description: '', line_type: 'crushing', template: String(tpls[0]?.id ?? '') }); setOpen(true) }
  const openEdit = (r: any) => { setEditing(r); setForm({ factory: String(r.factory), name: r.name, description: r.description ?? '', line_type: r.line_type, template: '' }); setOpen(true) }
  const submit = async () => {
    if (!form.name.trim()) { notify('نام خط الزامی است', 'error'); return }
    if (!editing && !form.template) { notify('قالب خط الزامی است', 'error'); return }
    if (!editing && !form.factory) { notify('کارخانه الزامی است', 'error'); return }
    try {
      if (editing) { const p: any = { name: form.name.trim(), description: form.description, line_type: form.line_type }; if (form.template) p.template = Number(form.template); await api.patch(`/production-lines/${editing.id}/`, p) }
      else await api.post('/production-lines/', { factory: Number(form.factory), name: form.name.trim(), description: form.description, line_type: form.line_type, template: Number(form.template) })
      notify('ذخیره شد'); setOpen(false); load(); reload()
    } catch (e: any) { notify(e.message, 'error') }
  }
  const del = async (r: any) => { if (!confirm(`حذف خط ${r.name}؟`)) return; try { await api.delete(`/production-lines/${r.id}/`); notify('حذف شد'); load(); reload() } catch (e: any) { notify(e.message, 'error') } }
  if (loading) return <Loading />
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">خطوط تولید ({rows.length})</h3>{canManage && <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> خط جدید</button>}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-right text-xs text-slate-500"><th className="px-3 py-2">نام</th><th className="px-3 py-2">کارخانه</th><th className="px-3 py-2">نوع</th><th className="px-3 py-2">قالب</th><th className="px-3 py-2">عملیات</th></tr></thead><tbody>{rows.map((r: any) => <tr key={r.id} className="border-b"><td className="px-3 py-2 font-bold">{r.name}</td><td className="px-3 py-2 text-xs">{factories.find((f: any) => f.id === r.factory)?.name ?? r.factory}</td><td className="px-3 py-2 text-xs">{r.line_type}</td><td className="px-3 py-2 text-xs">{r.template}</td><td className="px-3 py-2"><div className="flex gap-1">{canManage && <><button className="rounded p-1 hover:bg-slate-100" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-rose-50 text-rose-600" onClick={() => del(r)}><Trash2 className="h-4 w-4" /></button></>}</div></td></tr>)}</tbody></table></div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'ویرایش خط' : 'خط جدید'} footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit}><Save className="h-4 w-4" /> ذخیره</button></>}>
        <div className="space-y-3">
          {!editing && <div><label className="label">کارخانه *</label><select className="input" value={form.factory} onChange={e => setForm({ ...form, factory: e.target.value })}><option value="">—</option>{factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>}
          <div><label className="label">نام خط *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="label">نوع</label><select className="input" value={form.line_type} onChange={e => setForm({ ...form, line_type: e.target.value })}><option value="crushing">خردایش</option><option value="processing">فرآوری</option><option value="conveying">انتقال</option><option value="other">سایر</option></select></div><div><label className="label">قالب {editing ? '(خالی=بدون تغییر)' : '*'}</label><select className="input" value={form.template} onChange={e => setForm({ ...form, template: e.target.value })}><option value="">—</option>{tpls.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div>
          <div><label className="label">توضیحات</label><textarea className="input" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  )
}

function ShiftsTab({ factories, canManage, notify }: any) {
  const [lines, setLines] = useState<any[]>([])
  const [lineId, setLineId] = useState<string>('')
  const [rows, setRows] = useState<any[]>([])
  const loadLines = async () => { const d = await api.get('/production-lines/').then(r => r.data); const arr = Array.isArray(d) ? d : d.results ?? []; setLines(arr); if (arr[0] && !lineId) setLineId(String(arr[0].id)) }
  const loadShifts = async () => { if (!lineId) { setRows([]); return } const d = await getShifts(Number(lineId)); setRows(d) }
  useEffect(() => { loadLines() }, [])
  useEffect(() => { loadShifts() }, [lineId])
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<any | null>(null)
  const [form, setForm] = useState({ name: '', start_time: '06:00', end_time: '14:00', is_active: true })
  const openCreate = () => { if (!lineId) { notify('ابتدا خط را انتخاب کنید', 'error'); return } setEditing(null); setForm({ name: '', start_time: '06:00', end_time: '14:00', is_active: true }); setOpen(true) }
  const openEdit = (r: any) => { setEditing(r); setForm({ name: r.name, start_time: r.start_time.slice(0, 5), end_time: r.end_time.slice(0, 5), is_active: r.is_active }); setOpen(true) }
  const submit = async () => {
    if (!form.name.trim()) { notify('نام شیفت الزامی است', 'error'); return }
    try {
      if (editing) await updateShift(editing.id, { name: form.name.trim(), start_time: form.start_time, end_time: form.end_time, is_active: form.is_active })
      else await createShift({ line: Number(lineId), name: form.name.trim(), start_time: form.start_time, end_time: form.end_time, is_active: form.is_active })
      notify('ذخیره شد'); setOpen(false); loadShifts()
    } catch (e: any) { notify(e.message, 'error') }
  }
  const del = async (r: any) => { if (!confirm(`حذف شیفت ${r.name}؟`)) return; try { await deleteShift(r.id); notify('حذف شد'); loadShifts() } catch (e: any) { notify(e.message, 'error') } }
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center gap-2"><h3 className="font-bold">شیفت‌های هر خط</h3><select className="input !h-9 !w-[220px]" value={lineId} onChange={e => setLineId(e.target.value)}><option value="">— انتخاب خط —</option>{lines.map((l: any) => <option key={l.id} value={l.id}>{l.name} · {factories.find((f: any) => f.id === l.factory)?.name ?? ''}</option>)}</select><span className="text-xs text-slate-400">هر خط شیفت‌های مستقل دارد (خط‌محور)</span><div className="mr-auto">{canManage && <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> شیفت جدید</button>}</div></div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-right text-xs text-slate-500"><th className="px-3 py-2">نام</th><th className="px-3 py-2">شروع</th><th className="px-3 py-2">پایان</th><th className="px-3 py-2">فعال</th><th className="px-3 py-2">عملیات</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-slate-400">شیفتی یافت نشد — یک شیفت برای این خط بسازید.</td></tr> : rows.map(r => <tr key={r.id} className="border-b"><td className="px-3 py-2 font-bold">{r.name}</td><td className="px-3 py-2" dir="ltr">{r.start_time.slice(0, 5)}</td><td className="px-3 py-2" dir="ltr">{r.end_time.slice(0, 5)}</td><td className="px-3 py-2">{r.is_active ? '✓' : '—'}</td><td className="px-3 py-2"><div className="flex gap-1">{canManage && <><button className="rounded p-1 hover:bg-slate-100" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-rose-50 text-rose-600" onClick={() => del(r)}><Trash2 className="h-4 w-4" /></button></>}</div></td></tr>)}</tbody></table></div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'ویرایش شیفت' : 'شیفت جدید برای خط'} footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit}><Save className="h-4 w-4" /> ذخیره</button></>}>
        <div className="grid grid-cols-2 gap-3"><div className="col-span-2"><label className="label">نام شیفت *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="صبح / عصر / شب" /></div><div><label className="label">شروع (HH:MM)</label><input className="input" dir="ltr" value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} /></div><div><label className="label">پایان (HH:MM)</label><input className="input" dir="ltr" value={form.end_time} onChange={e => setForm({ ...form, end_time: e.target.value })} /></div><div className="col-span-2 flex items-center gap-2"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /><span className="text-sm">فعال</span></div></div>
      </Modal>
    </div>
  )
}

function OrgTab({ factories, canManage, canManageSettings, notify, selectedFactory }: any) {
  const [contractors, setContractors] = useState<ContractorRow[]>([])
  const [failures, setFailures] = useState<FailureRow[]>([])
  const factoryId = selectedFactory?.id ?? factories[0]?.id
  const load = async () => {
    try { const c = await api.get('/contractors/', { params: factoryId ? { factory: factoryId } : {} }).then(r => r.data); setContractors(Array.isArray(c) ? c : c.results ?? []) } catch { }
    try { const f = await api.get('/failure-reasons/').then(r => r.data); setFailures(Array.isArray(f) ? f : f.results ?? []) } catch { }
  }
  useEffect(() => { load() }, [factoryId])
  const [openC, setOpenC] = useState(false); const [editC, setEditC] = useState<any>(null); const [formC, setFormC] = useState({ name: '', contact_name: '', phone: '', is_active: true, factory: '' })
  const openCreateC = () => { setEditC(null); setFormC({ name: '', contact_name: '', phone: '', is_active: true, factory: String(factoryId ?? '') }); setOpenC(true) }
  const openEditC = (r: any) => { setEditC(r); setFormC({ name: r.name, contact_name: r.contact_name ?? '', phone: r.phone ?? '', is_active: r.is_active, factory: String(r.factory) }); setOpenC(true) }
  const submitC = async () => { if (!formC.name.trim()) { notify('نام پیمانکار الزامی است', 'error'); return } try { if (editC) await api.patch(`/contractors/${editC.id}/`, { name: formC.name.trim(), contact_name: formC.contact_name, phone: formC.phone, is_active: formC.is_active, factory: Number(formC.factory) || undefined }); else await api.post('/contractors/', { name: formC.name.trim(), contact_name: formC.contact_name, phone: formC.phone, is_active: formC.is_active, factory: Number(formC.factory) || factoryId }); notify('ذخیره شد'); setOpenC(false); load() } catch (e: any) { notify(e.message, 'error') } }
  const delC = async (r: any) => { if (!confirm(`حذف پیمانکار ${r.name}؟`)) return; try { await api.delete(`/contractors/${r.id}/`); notify('حذف شد'); load() } catch (e: any) { notify(e.message, 'error') } }

  const [openF, setOpenF] = useState(false); const [editF, setEditF] = useState<any>(null); const [formF, setFormF] = useState({ title: '' })
  const openCreateF = () => { setEditF(null); setFormF({ title: '' }); setOpenF(true) }
  const openEditF = (r: any) => { setEditF(r); setFormF({ title: r.title }); setOpenF(true) }
  const submitF = async () => { if (!formF.title.trim()) { notify('عنوان الزامی است', 'error'); return } try { if (editF) await api.patch(`/failure-reasons/${editF.id}/`, { title: formF.title.trim() }); else await api.post('/failure-reasons/', { title: formF.title.trim() }); notify('ذخیره شد'); setOpenF(false); load() } catch (e: any) { notify(e.message, 'error') } }
  const delF = async (r: any) => { if (!confirm(`حذف علت ${r.title}؟`)) return; try { await api.delete(`/failure-reasons/${r.id}/`); notify('حذف شد'); load() } catch (e: any) { notify(e.message, 'error') } }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">پیمانکاران</h3>{canManage && <button className="btn-primary" onClick={openCreateC}><Plus className="h-4 w-4" /> جدید</button>}</div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-right text-xs text-slate-500"><th className="px-2 py-2">نام</th><th className="px-2 py-2">مسئول</th><th className="px-2 py-2">تلفن</th><th className="px-2 py-2">عملیات</th></tr></thead><tbody>{contractors.map(r => <tr key={r.id} className="border-b"><td className="px-2 py-2 font-bold">{r.name}</td><td className="px-2 py-2 text-xs">{r.contact_name || '—'}</td><td className="px-2 py-2 text-xs" dir="ltr">{r.phone || '—'}</td><td className="px-2 py-2"><div className="flex gap-1">{canManage && <><button className="rounded p-1 hover:bg-slate-100" onClick={() => openEditC(r)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-rose-50 text-rose-600" onClick={() => delC(r)}><Trash2 className="h-4 w-4" /></button></>}</div></td></tr>)}{contractors.length === 0 && <tr><td colSpan={4} className="py-6 text-center text-sm text-slate-400">موردی نیست</td></tr>}</tbody></table></div>
        <Modal open={openC} onClose={() => setOpenC(false)} title={editC ? 'ویرایش پیمانکار' : 'پیمانکار جدید'} footer={<><button className="btn-ghost" onClick={() => setOpenC(false)}>انصراف</button><button className="btn-primary" onClick={submitC}><Save className="h-4 w-4" /> ذخیره</button></>}>
          <div className="space-y-3"><div><label className="label">کارخانه</label><select className="input" value={formC.factory} onChange={e => setFormC({ ...formC, factory: e.target.value })}><option value="">—</option>{factories.map((f: any) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div><div><label className="label">نام *</label><input className="input" value={formC.name} onChange={e => setFormC({ ...formC, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><label className="label">مسئول</label><input className="input" value={formC.contact_name} onChange={e => setFormC({ ...formC, contact_name: e.target.value })} /></div><div><label className="label">تلفن</label><input className="input" dir="ltr" value={formC.phone} onChange={e => setFormC({ ...formC, phone: e.target.value })} /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={formC.is_active} onChange={e => setFormC({ ...formC, is_active: e.target.checked })} /> فعال</label></div>
        </Modal>
      </div>
      <div className="card p-4">
        <div className="mb-3 flex items-center justify-between"><h3 className="font-bold">علل خرابی مرجع</h3>{canManageSettings && <button className="btn-primary" onClick={openCreateF}><Plus className="h-4 w-4" /> جدید</button>}</div>
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-right text-xs text-slate-500"><th className="px-2 py-2">عنوان</th><th className="px-2 py-2">عملیات</th></tr></thead><tbody>{failures.map(r => <tr key={r.id} className="border-b"><td className="px-2 py-2 font-bold">{r.title}</td><td className="px-2 py-2"><div className="flex gap-1">{canManageSettings && <><button className="rounded p-1 hover:bg-slate-100" onClick={() => openEditF(r)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-rose-50 text-rose-600" onClick={() => delF(r)}><Trash2 className="h-4 w-4" /></button></>}</div></td></tr>)}{failures.length === 0 && <tr><td colSpan={2} className="py-6 text-center text-sm text-slate-400">موردی نیست</td></tr>}</tbody></table></div>
        <Modal open={openF} onClose={() => setOpenF(false)} title={editF ? 'ویرایش علت' : 'علت جدید'} footer={<><button className="btn-ghost" onClick={() => setOpenF(false)}>انصراف</button><button className="btn-primary" onClick={submitF}><Save className="h-4 w-4" /> ذخیره</button></>}>
          <div><label className="label">عنوان *</label><input className="input" value={formF.title} onChange={e => setFormF({ ...formF, title: e.target.value })} /></div>
        </Modal>
      </div>
    </div>
  )
}

function AttrsTab({ canManage, notify }: any) {
  const [tab2, setTab2] = useState<'plattr' | 'attr' | 'dtpl' | 'ltpl'>('plattr')
  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {([['plattr', 'ویژگی خط'], ['attr', 'ویژگی دستگاه'], ['dtpl', 'الگوی دستگاه'], ['ltpl', 'الگوی خط']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab2(k)} className={`rounded-lg px-3 py-1.5 text-sm font-bold ${tab2 === k ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{l}</button>
        ))}
      </div>
      {tab2 === 'plattr' && <SimpleCrud url="/production-line-attributes/" canManage={canManage} notify={notify} cols={[{ k: 'name', label: 'نام' }, { k: 'unit', label: 'واحد' }]} />}
      {tab2 === 'attr' && <SimpleCrud url="/attributes/" canManage={canManage} notify={notify} cols={[{ k: 'name', label: 'نام' }, { k: 'unit', label: 'واحد' }]} />}
      {tab2 === 'dtpl' && <SimpleCrud url="/device-templates/" canManage={canManage} notify={notify} cols={[{ k: 'name', label: 'نام' }, { k: 'description', label: 'توضیحات' }]} />}
      {tab2 === 'ltpl' && <SimpleCrud url="/production-line-templates/" canManage={canManage} notify={notify} cols={[{ k: 'name', label: 'نام' }, { k: 'description', label: 'توضیحات' }]} />}
      <p className="mt-3 text-xs text-slate-400">تخصیص ویژگی‌ها به الگوها از پنل ادمین Django قابل تنظیم است — ponytail: در صورت نیاز فیلد available_attributes به همین CRUD اضافه می‌شود.</p>
    </div>
  )
}

function SimpleCrud({ url, canManage, notify, cols }: any) {
  const [rows, setRows] = useState<any[]>([])
  const load = async () => { const d = await api.get(url).then(r => r.data); setRows(Array.isArray(d) ? d : d.results ?? []) }
  useEffect(() => { load() }, [url])
  const [open, setOpen] = useState(false); const [editing, setEditing] = useState<any>(null); const [form, setForm] = useState<Record<string, string>>({})
  const openCreate = () => { setEditing(null); const f: any = {}; cols.forEach((c: any) => f[c.k] = ''); setForm(f); setOpen(true) }
  const openEdit = (r: any) => { setEditing(r); const f: any = {}; cols.forEach((c: any) => f[c.k] = r[c.k] ?? ''); setForm(f); setOpen(true) }
  const submit = async () => { const payload: any = {}; cols.forEach((c: any) => payload[c.k] = form[c.k]); if (!payload[cols[0].k]?.trim()) { notify(`${cols[0].label} الزامی است`, 'error'); return } try { if (editing) await api.patch(`${url}${editing.id}/`, payload); else await api.post(url, payload); notify('ذخیره شد'); setOpen(false); load() } catch (e: any) { notify(e.message, 'error') } }
  const del = async (r: any) => { if (!confirm(`حذف ${r[cols[0].k]}؟`)) return; try { await api.delete(`${url}${r.id}/`); notify('حذف شد'); load() } catch (e: any) { notify(e.message, 'error') } }
  return (
    <div>
      <div className="mb-2 flex justify-end">{canManage && <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> جدید</button>}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b bg-slate-50 text-right text-xs text-slate-500">{cols.map((c: any) => <th key={c.k} className="px-2 py-2">{c.label}</th>)}<th className="px-2 py-2">عملیات</th></tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b">{cols.map((c: any) => <td key={c.k} className="px-2 py-2">{r[c.k] || '—'}</td>)}<td className="px-2 py-2"><div className="flex gap-1">{canManage && <><button className="rounded p-1 hover:bg-slate-100" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></button><button className="rounded p-1 hover:bg-rose-50 text-rose-600" onClick={() => del(r)}><Trash2 className="h-4 w-4" /></button></>}</div></td></tr>)}{rows.length === 0 && <tr><td colSpan={cols.length + 1} className="py-6 text-center text-sm text-slate-400">موردی نیست</td></tr>}</tbody></table></div>
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? 'ویرایش' : 'جدید'} footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>انصراف</button><button className="btn-primary" onClick={submit}><Save className="h-4 w-4" /> ذخیره</button></>}>
        <div className="space-y-3">{cols.map((c: any) => <div key={c.k}><label className="label">{c.label} {c.k === cols[0].k ? '*' : ''}</label><input className="input" value={form[c.k] ?? ''} onChange={e => setForm({ ...form, [c.k]: e.target.value })} /></div>)}</div>
      </Modal>
    </div>
  )
}
