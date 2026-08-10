import { Calendar, X } from 'lucide-react'
import {
  isoToJalaliParts,
  jalaliToIso,
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

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`)

export default function JalaliDateInput({ value, onChange, allowEmpty = true, className = '' }: Props) {
  const parts = isoToJalaliParts(value)
  const jy = parts?.jy || 0
  const jm = parts?.jm || 0
  const jd = parts?.jd || 0
  const daysCount = jm ? jalaliDaysInMonth(jy || 1404, jm) : 31

  const setParts = (njy: number | '', njm: number | '', njd: number | '') => {
    if (!njy || !njm || !njd) {
      onChange('')
      return
    }
    const iso = jalaliToIso(njy, njm, njd)
    if (iso && iso !== value) onChange(iso)
  }

  const curToday = todayISO()
  const todayParts = isoToJalaliParts(curToday)

  return (
    <div className={`flex flex-wrap items-center gap-1.5 text-sm ${className}`}>
      <input
        type="number"
        min={1300}
        max={1500}
        className="input w-[96px] !px-2"
        placeholder="سال"
        value={partStr(jy)}
        onChange={(e) => setParts(e.target.value ? Number(e.target.value) : '', jm || '', jd || '')}
      />
      <select
        className="input w-[118px] !px-2"
        value={jm || ''}
        onChange={(e) => setParts(jy || '', e.target.value ? Number(e.target.value) : '', jd || '')}
      >
        <option value="">ماه</option>
        {PERSIAN_MONTHS.map((m, i) => (
          <option key={i} value={i + 1}>
            {m}
          </option>
        ))}
      </select>
      <select
        className="input w-[86px] !px-2"
        value={jd || ''}
        onChange={(e) => setParts(jy || '', jm || '', e.target.value ? Number(e.target.value) : '')}
      >
        <option value="">روز</option>
        {Array.from({ length: daysCount }, (_, i) => i + 1).map((d) => (
          <option key={d} value={d}>
            {d}
          </option>
        ))}
      </select>

      <button
        type="button"
        className="btn-ghost !h-9 !px-2.5 text-xs"
        title="امروز"
        onClick={() => {
          if (todayParts) onChange(jalaliToIso(todayParts.jy, todayParts.jm, todayParts.jd))
        }}
      >
        <Calendar className="h-4 w-4" /> امروز
      </button>
      {allowEmpty && value && (
        <button type="button" className="btn-ghost !h-9 !px-2 text-xs" title="پاک کردن" onClick={() => onChange('')}>
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function partStr(v: number): string {
  return v ? String(v) : ''
}