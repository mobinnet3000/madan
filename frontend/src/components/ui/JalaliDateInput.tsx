import { useCallback, useEffect, useRef, useState } from 'react'
import { Calendar, ChevronRight, ChevronLeft, X } from 'lucide-react'
import {
  isoToJalaliParts,
  jalaliToIso,
  jalaliToGregorian,
  jalaliDaysInMonth,
  PERSIAN_MONTHS,
  todayISO,
} from '../../utils'

interface Props {
  value: string
  onChange: (iso: string) => void
  allowEmpty?: boolean
  className?: string
}

const WEEKS = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج']

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

function normalizeDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
}

function parseJalaliText(text: string): [number, number, number] | null {
  const cleaned = normalizeDigits(text).trim().replace(/[.\-]/g, '/')
  const m = cleaned.match(/^(\d{1,4})\/(\d{1,2})\/(\d{1,2})$/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3])]
}

export default function JalaliDateInput({ value, onChange, allowEmpty = true, className = '' }: Props) {
  const parts = isoToJalaliParts(value)
  const today = isoToJalaliParts(todayISO())

  const [open, setOpen] = useState(false)
  const [view, setView] = useState({ jy: parts?.jy || today?.jy || 1404, jm: parts?.jm || 1 })
  const [text, setText] = useState(parts ? `${parts.jy}/${pad(parts.jm)}/${pad(parts.jd)}` : '')
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const p = isoToJalaliParts(value)
    setText(p ? `${p.jy}/${pad(p.jm)}/${pad(p.jd)}` : '')
    if (open && p) setView({ jy: p.jy, jm: p.jm })
  }, [value, open])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const openCalendar = () => {
    const p = isoToJalaliParts(value) || today
    if (p) setView({ jy: p.jy, jm: p.jm })
    setOpen(true)
  }

  const commit = useCallback((jy: number, jm: number, jd: number) => {
    const iso = jalaliToIso(jy, jm, jd)
    if (iso) {
      onChange(iso)
      setText(`${jy}/${pad(jm)}/${pad(jd)}`)
    }
    setOpen(false)
  }, [onChange])

  const onTextChange = (raw: string) => {
    setText(raw)
    const clean = raw.trim()
    if (clean === '') {
      if (allowEmpty) onChange('')
      return
    }
    const parsed = parseJalaliText(clean)
    if (!parsed) return
    const iso = jalaliToIso(parsed[0], parsed[1], parsed[2])
    if (iso) onChange(iso)
  }

  const go = (dir: -1 | 1) => {
    setView((v) => {
      let jm = v.jm + dir
      let jy = v.jy
      if (jm < 1) { jm = 12; jy -= 1 }
      if (jm > 12) { jm = 1; jy += 1 }
      return { jy, jm }
    })
  }

  // ساخت سلول‌های تقویم ماه
  const firstGreg = jalaliToGregorian(view.jy, view.jm, 1)
  const firstDow = new Date(Date.UTC(firstGreg[0], firstGreg[1] - 1, firstGreg[2])).getUTCDay() // 0=Sun..6=Sat
  const offset = firstDow === 6 ? 0 : firstDow + 1
  const daysCount = jalaliDaysInMonth(view.jy, view.jm)
  const cells: (number | null)[] = Array(offset).fill(null)
  for (let d = 1; d <= daysCount; d++) cells.push(d)

  const isToday = (d: number) => today && view.jy === today.jy && view.jm === today.jm && d === today.jd
  const isSelected = (d: number) => parts && view.jy === parts.jy && view.jm === parts.jm && d === parts.jd

  return (
    <div ref={wrapRef} className={`relative inline-block text-sm ${className}`}>
      <div className="flex items-center gap-1.5">
        <input
          type="text"
          inputMode="numeric"
          className="input !px-2.5"
          style={{ width: '132px', direction: 'ltr', textAlign: 'left' }}
          placeholder="1405/5/15"
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          onFocus={openCalendar}
        />
        <button type="button" className="btn-ghost !h-9 !px-2.5" onClick={openCalendar} title="تقویم شمسی">
          <Calendar className="h-4 w-4" />
        </button>
        {allowEmpty && value && (
          <button type="button" className="btn-ghost !h-9 !px-2" title="پاک کردن" onClick={() => onChange('')}>
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-[260px] rounded-2xl border border-ink-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className="btn-ghost !h-8 !w-8 !p-0" onClick={() => go(-1)} title="ماه قبل"><ChevronRight className="h-4 w-4" /></button>
            <div className="text-sm font-bold text-ink-800 dark:text-slate-100">
              {PERSIAN_MONTHS[view.jm - 1]} {view.jy}
            </div>
            <button type="button" className="btn-ghost !h-8 !w-8 !p-0" onClick={() => go(1)} title="ماه بعد"><ChevronLeft className="h-4 w-4" /></button>
          </div>

          <div className="mb-1 grid grid-cols-7 text-center text-[11px] font-bold text-ink-400 dark:text-slate-500">
            {WEEKS.map((w) => <span key={w}>{w}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {cells.map((d, i) =>
              d == null ? (
                <span key={i} />
              ) : (
                <button
                  key={i}
                  type="button"
                  onClick={() => commit(view.jy, view.jm, d)}
                  className={`h-8 w-full rounded-lg text-xs font-medium transition ${
                    isSelected(d)
                      ? 'bg-brand-500 text-white'
                      : isToday(d)
                        ? 'bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                        : 'text-ink-700 hover:bg-ink-100 dark:text-slate-200 dark:hover:bg-slate-800'
                  }`}
                >
                  {d}
                </button>
              ),
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-ink-100 pt-2 dark:border-slate-700">
            <button type="button" className="btn-ghost !h-8 !px-3 text-xs" onClick={() => today && commit(today.jy, today.jm, today.jd)}>
              امروز
            </button>
            <span className="text-[11px] text-ink-400 dark:text-slate-500">
              {parts ? `${parts.jy}/${pad(parts.jm)}/${pad(parts.jd)}` : '—'}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}