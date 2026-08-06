import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Users, ShieldCheck, Plus, Pencil, Trash2, Search, KeyRound, Lock, UserCog,
} from 'lucide-react'
import { useAuth } from '../store/AuthContext'
import { useFactory } from '../store/FactoryContext'
import { useToast } from '../components/ui/Toast'
import {
  getUsersPage, createUser, updateUser, deleteUser, getRoles, updateRoleMatrix,
  type UserPayload,
} from '../api/users'
import type { ManagedUser, PermissionDef, Role } from '../types'
import { ROLE_BADGE, ROLE_LABELS, hasPerm } from '../constants'
import { Loading, ErrorBanner, EmptyState, TableSkeleton } from '../components/ui/States'
import Modal from '../components/ui/Modal'
import Pagination from '../components/ui/Pagination'

const ROLE_OPTIONS: { value: Role; label: string }[] = [
  { value: 'admin', label: 'مدیر سیستم (ادمین)' },
  { value: 'manager', label: 'مدیر کارخانه' },
  { value: 'operator', label: 'اپراتور' },
  { value: 'viewer', label: 'بیننده (فقط مشاهده)' },
]

interface UserFormState {
  id?: number
  username: string
  password: string
  first_name: string
  last_name: string
  email: string
  phone: string
  role: Role
  factory: string
  is_active: boolean
  custom: Record<string, 'default' | 'granted' | 'denied'>
}

function TriSelect({ value, onChange }: { value: string; onChange: (v: 'default' | 'granted' | 'denied') => void }) {
  return (
    <select className="input !py-1.5 text-xs" value={value} onChange={(e) => onChange(e.target.value as any)}>
      <option value="default">پیش‌فرض</option>
      <option value="granted">مجاز</option>
      <option value="denied">ممنوع</option>
    </select>
  )
}

export default function UsersPage() {
  const { user } = useAuth()
  const { factories } = useFactory()
  const { notify } = useToast()
  const isFullAdmin = user?.role === 'admin' || user?.is_superuser
  const canRoles = hasPerm(user?.permissions, 'roles.view')
  const canManageRoles = hasPerm(user?.permissions, 'roles.manage')
  const canManageUsers = hasPerm(user?.permissions, 'users.manage')

  const [tab, setTab] = useState<'users' | 'roles'>('users')

  // ── کاربران ──
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(50)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ManagedUser | null>(null)
  const [form, setForm] = useState<UserFormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [confirmId, setConfirmId] = useState<number | null>(null)

  // ── نقش‌ها ──
  const [permsCatalog, setPermsCatalog] = useState<PermissionDef[]>([])
  const [matrix, setMatrix] = useState<Record<Role, Record<string, boolean>> | null>(null)
  const [activeRole, setActiveRole] = useState<Role>('admin')
  const [draft, setDraft] = useState<Record<string, boolean>>({})

  const loadUsers = useCallback(() => {
    setLoading(true)
    getUsersPage(page, pageSize)
      .then((d) => { setUsers(d.results); setTotal(d.count); setError(null) })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [page, pageSize])

  useEffect(() => { if (hasPerm(user?.permissions, 'users.view')) loadUsers() }, [user, loadUsers])

  const loadRoles = useCallback(() => {
    getRoles()
      .then((d) => {
        setPermsCatalog(d.permissions)
        setMatrix(d.matrix)
        setActiveRole((prev) => (d.matrix[prev] ? prev : d.roles[0]?.value || 'admin'))
        setDraft(d.matrix[d.roles[0]?.value || 'admin'] || {})
      })
      .catch((e) => notify(e.message || 'خطا در دریافت نقش‌ها', 'error'))
  }, [notify])

  useEffect(() => { if (canRoles) loadRoles() }, [canRoles, loadRoles])

  const filtered = useMemo(() => {
    if (!q) return users
    const t = q.trim().toLowerCase()
    return users.filter((u) =>
      u.username.toLowerCase().includes(t) ||
      (u.first_name || '').toLowerCase().includes(t) ||
      (u.last_name || '').toLowerCase().includes(t) ||
      (u.factory_name || '').toLowerCase().includes(t))
  }, [users, q])

  const openCreate = () => {
    setEditing(null)
    setForm({
      username: '', password: '', first_name: '', last_name: '', email: '', phone: '',
      role: isFullAdmin ? 'operator' : 'operator',
      factory: isFullAdmin ? '' : String(user?.factory ?? ''),
      is_active: true,
      custom: {},
    })
    setModalOpen(true)
  }

  const openEdit = (u: ManagedUser) => {
    setEditing(u)
    const custom: Record<string, 'default' | 'granted' | 'denied'> = {}
    ;(u.permissions?.granted || []).forEach((c) => { custom[c] = 'granted' })
    ;(u.permissions?.denied || []).forEach((c) => { custom[c] = 'denied' })
    setForm({
      id: u.id, username: u.username, password: '', first_name: u.first_name || '', last_name: u.last_name || '',
      email: u.email || '', phone: u.phone || '', role: u.role,
      factory: u.factory == null ? '' : String(u.factory), is_active: u.is_active, custom,
    })
    setModalOpen(true)
  }

  const buildPermissions = () => {
    const granted: string[] = []
    const denied: string[] = []
    Object.entries(form?.custom || {}).forEach(([code, state]) => {
      if (state === 'granted') granted.push(code)
      if (state === 'denied') denied.push(code)
    })
    return { granted, denied }
  }

  const submitUser = async () => {
    if (!form) return
    if (!form.username.trim()) { notify('نام کاربری الزامی است', 'error'); return }
    if (!editing && !form.password) { notify('رمز عبور الزامی است', 'error'); return }
    const payload: UserPayload = {
      username: form.username.trim(),
      role: form.role,
      first_name: form.first_name, last_name: form.last_name, email: form.email,
      phone: form.phone,
      factory: form.factory ? Number(form.factory) : null,
      is_active: form.is_active,
    }
    if (form.password) payload.password = form.password
    if (canRoles) payload.permissions = buildPermissions()
    setSaving(true)
    try {
      if (editing) { await updateUser(editing.id, payload); notify('کاربر به‌روزرسانی شد') }
      else { await createUser(payload); notify('کاربر جدید ساخته شد') }
      setModalOpen(false); loadUsers()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره‌سازی', 'error') }
    finally { setSaving(false) }
  }

  const confirmDelete = async () => {
    if (confirmId == null) return
    try { await deleteUser(confirmId); notify('کاربر حذف شد'); setConfirmId(null); loadUsers() }
    catch (e: any) { notify(e.message || 'خطا در حذف', 'error') }
  }

  const saveRole = async () => {
    const enabled = Object.entries(draft).filter(([, v]) => v).map(([k]) => k)
    setSaving(true)
    try {
      await updateRoleMatrix(activeRole, enabled)
      notify('دسترسی‌های نقش ذخیره شد')
      loadRoles()
    } catch (e: any) { notify(e.message || 'خطا در ذخیره', 'error') }
    finally { setSaving(false) }
  }

  const resetRoleDefaults = () => {
    if (!matrix) return
    setDraft({ ...matrix[activeRole] })
  }

  const groups = useMemo(() => {
    const g = new Map<string, PermissionDef[]>()
    permsCatalog.forEach((p) => {
      if (!g.has(p.group)) g.set(p.group, [])
      g.get(p.group)!.push(p)
    })
    return [...g.entries()]
  }, [permsCatalog])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (!hasPerm(user?.permissions, 'users.view')) {
    return (
      <EmptyState icon={<ShieldCheck className="h-10 w-10" />} title="دسترسی غیرمجاز"
        description="شما مجوز مشاهده‌ی مدیریت کاربران را ندارید." />
    )
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-ink-900 dark:text-slate-100">مدیریت کاربران و دسترسی‌ها</h1>
          <p className="text-sm text-ink-500">تعریف کاربران، نقش‌ها و سطح دسترسی هر نقش</p>
        </div>
        <div className="flex gap-1 rounded-xl bg-ink-100/60 p-1 dark:bg-slate-800">
          <button onClick={() => setTab('users')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === 'users' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500'}`}>
            <Users className="h-4 w-4" /> کاربران
          </button>
          {canRoles && (
            <button onClick={() => setTab('roles')} className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${tab === 'roles' ? 'bg-white text-brand-600 shadow dark:bg-slate-700 dark:text-brand-400' : 'text-ink-500'}`}>
              <ShieldCheck className="h-4 w-4" /> نقش‌ها و دسترسی‌ها
            </button>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} />}

      {tab === 'users' && (
        <>
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input className="input pr-10" placeholder="جستجو در نام کاربری، نام، کارخانه..." value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            {canManageUsers && (
              <button className="btn-primary" onClick={openCreate}><Plus className="h-4 w-4" /> کاربر جدید</button>
            )}
          </div>

          {loading ? <TableSkeleton columns={7} /> : filtered.length === 0 ? (
            <EmptyState icon={<Users className="h-10 w-10" />} title="کاربری یافت نشد"
              description={canManageUsers ? 'با دکمه «کاربر جدید» اولین کاربر را بسازید.' : 'لیست کاربران خالی است.'} />
          ) : (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 bg-ink-50/60 text-right text-xs text-ink-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                      <th className="px-4 py-3 font-semibold">کاربر</th>
                      <th className="px-4 py-3 font-semibold">نقش</th>
                      <th className="px-4 py-3 font-semibold">کارخانه</th>
                      <th className="px-4 py-3 font-semibold">تماس</th>
                      <th className="px-4 py-3 font-semibold">وضعیت</th>
                      <th className="px-4 py-3 font-semibold">دسترسی‌ها</th>
                      <th className="px-4 py-3 font-semibold text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-slate-700">
                    {filtered.map((u) => (
                      <tr key={u.id} className="transition hover:bg-ink-50/50 dark:hover:bg-slate-800/50">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-600 dark:bg-brand-950/40">
                              {(u.first_name || u.username).slice(0, 1)}
                            </span>
                            <div>
                              <div className="font-semibold text-ink-800 dark:text-slate-200">{u.username}{u.is_superuser && <span className="mr-1 badge bg-rose-100 text-rose-700">سیستم</span>}</div>
                              <div className="text-[11px] text-ink-400">{u.first_name} {u.last_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3"><span className={`badge ${ROLE_BADGE[u.role] || ROLE_BADGE.operator}`}>{ROLE_LABELS[u.role]}</span></td>
                        <td className="px-4 py-3 text-ink-600 dark:text-slate-400">{u.factory_name || <span className="text-ink-300 dark:text-slate-600">—</span>}</td>
                        <td className="px-4 py-3 text-ink-500 dark:text-slate-400">{u.phone || '—'}</td>
                        <td className="px-4 py-3">
                          <span className={`badge ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-ink-100 text-ink-500'}`}>{u.is_active ? 'فعال' : 'غیرفعال'}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-500 dark:text-slate-400">{u.permissions_resolved?.length ?? 0} دسترسی</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-1">
                            {canManageUsers && (
                              <>
                                <button className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-600 dark:hover:bg-slate-800" onClick={() => openEdit(u)} title="ویرایش"><Pencil className="h-4 w-4" /></button>
                                <button className="rounded-lg p-1.5 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/50" onClick={() => setConfirmId(u.id)} title="حذف"><Trash2 className="h-4 w-4" /></button>
                              </>
                            )}
                            {!canManageUsers && <span className="text-xs text-ink-300">—</span>}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-ink-100 px-4 py-3 dark:border-slate-700">
                <span className="text-xs text-ink-400">نمایش {Math.min((page - 1) * pageSize + 1, total)} تا {Math.min(page * pageSize, total)} از {total} کاربر</span>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => { setPage(p); loadUsers() }} />
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'roles' && canRoles && (
        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-slate-700">
            <div className="flex flex-wrap gap-1.5">
              {(Object.keys(matrix || {}) as Role[]).map((r) => (
                <button key={r} onClick={() => { setActiveRole(r); if (matrix) setDraft({ ...matrix[r] }) }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${activeRole === r ? 'bg-brand-500 text-white shadow' : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-slate-800 dark:text-slate-300'}`}>
                  {ROLE_LABELS[r] || r}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button className="btn-ghost" onClick={resetRoleDefaults} disabled={!matrix}>بازنشانی به پیش‌فرض</button>
              {canManageRoles && (
                <button className="btn-primary" onClick={saveRole} disabled={saving}>
                  <Lock className="h-4 w-4" /> {saving ? 'در حال ذخیره...' : 'ذخیره دسترسی‌های نقش'}
                </button>
              )}
            </div>
          </div>

          {!matrix ? <Loading /> : (
            <div className="grid grid-cols-1 gap-5 p-4 md:grid-cols-2 xl:grid-cols-3">
              {groups.map(([group, perms]) => (
                <div key={group} className="rounded-xl border border-ink-100 p-3 dark:border-slate-700">
                  <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink-600 dark:text-slate-300">
                    <UserCog className="h-3.5 w-3.5 text-brand-500" /> {group}
                  </div>
                  <div className="space-y-1.5">
                    {perms.map((p) => {
                      const checked = !!draft[p.code]
                      return (
                        <label key={p.code} className={`flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 text-xs transition ${checked ? 'bg-emerald-50/70 dark:bg-emerald-950/30' : 'bg-ink-50/40 dark:bg-slate-800/40'}`}>
                          <span className="text-ink-700 dark:text-slate-300">{p.label}</span>
                          <input type="checkbox" className="accent-emerald-600" checked={checked} disabled={!canManageRoles}
                            onChange={() => setDraft((d) => ({ ...d, [p.code]: !d[p.code] }))} />
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `ویرایش کاربر ${editing.username}` : 'ایجاد کاربر جدید'} size="lg"
        footer={<>
          <button className="btn-ghost" onClick={() => setModalOpen(false)}>انصراف</button>
          <button className="btn-primary" onClick={submitUser} disabled={saving}>{saving ? 'در حال ذخیره...' : editing ? 'ذخیره تغییرات' : 'ایجاد کاربر'}</button>
        </>}>
        {form && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label">نام کاربری *</label>
              <input className="input" value={form.username} disabled={!!editing} onChange={(e) => setForm({ ...form, username: e.target.value })} />
            </div>
            <div>
              <label className="label">{editing ? 'رمز عبور جدید (خالی = بدون تغییر)' : 'رمز عبور *'}</label>
              <input type="password" className="input" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
            <div><label className="label">نام</label><input className="input" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} /></div>
            <div><label className="label">نام خانوادگی</label><input className="input" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            <div><label className="label">ایمیل</label><input type="email" className="input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="label">شماره تماس</label><input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div>
              <label className="label">نقش *</label>
              <select className="input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                {ROLE_OPTIONS.filter((o) => isFullAdmin || o.value === 'operator' || o.value === 'viewer')
                  .map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="label">کارخانه</label>
              <select className="input" value={form.factory} disabled={!isFullAdmin} onChange={(e) => setForm({ ...form, factory: e.target.value })}>
                <option value="">— بدون کارخانه —</option>
                {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" id="uactive" className="accent-brand-600" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} />
              <label htmlFor="uactive" className="text-sm text-ink-700 dark:text-slate-300">حساب فعال باشد</label>
            </div>

            {canRoles && permsCatalog.length > 0 && (
              <div className="sm:col-span-2 rounded-xl border border-ink-100 p-3 dark:border-slate-700">
                <div className="mb-2 flex items-center gap-2 text-xs font-bold text-ink-600 dark:text-slate-300">
                  <KeyRound className="h-3.5 w-3.5 text-brand-500" /> دسترسی‌های سفارشی (فوق بر نقش)
                </div>
                <div className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {permsCatalog.map((p) => (
                    <div key={p.code} className="flex items-center gap-2 text-xs">
                      <span className="flex-1 text-ink-700 dark:text-slate-300" title={p.code}>{p.label}</span>
                      <TriSelect value={form.custom[p.code] || 'default'}
                        onChange={(v) => setForm({ ...form, custom: { ...form.custom, [p.code]: v } })} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal open={confirmId != null} onClose={() => setConfirmId(null)} title="حذف کاربر"
        footer={<>
          <button className="btn-ghost" onClick={() => setConfirmId(null)}>انصراف</button>
          <button className="btn-danger" onClick={confirmDelete}><Trash2 className="h-4 w-4" /> حذف قطعی</button>
        </>}>
        <p className="text-sm text-ink-700 dark:text-slate-300">آیا از حذف این کاربر اطمینان دارید؟ این عمل قابل بازگشت نیست.</p>
      </Modal>
    </div>
  )
}