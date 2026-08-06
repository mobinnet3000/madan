import { useEffect, useState } from 'react'
import { Save, X } from 'lucide-react'
import Modal from './ui/Modal'
import type { AttributeDef } from '../types'

interface Props {
  open: boolean
  title: string
  defs: AttributeDef[]
  values: Record<string, number | string>
  saving?: boolean
  onClose: () => void
  onSave: (values: Record<string, number | string>) => void
}

export default function AttributeEditor({ open, title, defs, values, saving, onClose, onSave }: Props) {
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      const next: Record<string, string> = {}
      defs.forEach((d) => {
        const v = values[d.name]
        next[d.name] = v === undefined || v === null ? '' : String(v)
      })
      setForm(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }))

  const submit = () => {
    const payload: Record<string, number | string> = {}
    defs.forEach((d) => {
      const raw = (form[d.name] ?? '').trim()
      if (raw !== '') {
        const num = Number(raw)
        payload[d.name] = isNaN(num) ? raw : num
      }
    })
    onSave(payload)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`ویرایش ویژگی‌های فنی — ${title}`}
      subtitle="مقادیر را وارد کنید و ذخیره نمایید"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose} disabled={saving}><X className="h-4 w-4" /> انصراف</button>
          <button className="btn-primary" onClick={submit} disabled={saving}>
            <Save className="h-4 w-4" /> {saving ? 'در حال ذخیره...' : 'ذخیره'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {defs.length === 0 && (
          <p className="text-sm text-ink-500">ویژگی‌ای برای این مورد تعریف نشده است.</p>
        )}
        {defs.map((d) => (
          <div key={d.name}>
            <label className="label">
              {d.name}
              {d.unit && <span className="mr-1 badge bg-ink-100 text-ink-500 dark:bg-slate-700 dark:text-slate-300">{d.unit}</span>}
            </label>
            <input
              type="text"
              inputMode="decimal"
              className="input"
              value={form[d.name] ?? ''}
              placeholder={`مقدار ${d.name}`}
              onChange={(e) => set(d.name, e.target.value)}
            />
          </div>
        ))}
      </div>
    </Modal>
  )
}