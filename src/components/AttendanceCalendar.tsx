import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export type DayInfo = {
  date: string
  label: number
  status: 'present' | 'open' | 'leave' | 'pending' | 'holiday' | 'weekend' | 'absent' | 'upcoming' | 'empty'
  hours: number
  muted?: boolean
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export const STATUS_LABEL: Record<DayInfo['status'], string> = {
  present: 'Present',
  open: 'Checked in',
  leave: 'Paid leave',
  pending: 'Leave pending',
  holiday: 'Holiday',
  weekend: 'Weekend',
  absent: 'Absent',
  upcoming: '',
  empty: '',
}

export function AttendanceCalendar({
  days,
  weekStartBlank,
}: {
  days: DayInfo[]
  weekStartBlank: number
}) {
  const cells: Array<DayInfo | null> = [...Array(weekStartBlank).fill(null), ...days]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="rounded-3xl border border-line bg-surface p-3 sm:p-4">
      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
        {cells.map((day, i) => (
          <div
            key={day?.date || `b-${i}`}
            className={`min-h-16 rounded-2xl p-1.5 text-left sm:min-h-20 ${tone(day?.status)} ${day?.muted ? 'opacity-30' : ''}`}
          >
            {day ? (
              <>
                <p className="text-xs font-medium">{day.label}</p>
                {day.status !== 'upcoming' && day.status !== 'empty' ? (
                  <p className="mt-1 text-[10px] leading-tight sm:text-xs">{STATUS_LABEL[day.status]}</p>
                ) : null}
                {day.hours > 0 ? <p className="text-[10px] text-muted">{day.hours.toFixed(1)}h</p> : null}
              </>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function tone(status?: DayInfo['status']) {
  if (status === 'present') return 'bg-good/15 text-ink'
  if (status === 'open') return 'bg-warn/15'
  if (status === 'leave') return 'bg-accent/10'
  if (status === 'pending') return 'bg-warn/15'
  if (status === 'holiday') return 'bg-bg'
  if (status === 'absent') return 'bg-danger/10'
  if (status === 'weekend') return 'bg-bg text-muted'
  return 'bg-bg/50 text-muted'
}

export function CalendarToolbar({
  year,
  month,
  onYear,
  onMonth,
  from,
  to,
  onFrom,
  onTo,
  people,
  personId,
  onPerson,
}: {
  year: number
  month: number
  onYear: (year: number) => void
  onMonth: (month: number) => void
  from: string
  to: string
  onFrom: (value: string) => void
  onTo: (value: string) => void
  people?: Array<{ id: string; name: string; you?: boolean }>
  personId?: string
  onPerson?: (id: string) => void
}) {
  const years = Array.from(
    new Set([
      ...Array.from({ length: 12 }, (_, i) => new Date().getFullYear() - 6 + i),
      year,
    ]),
  ).sort((a, b) => a - b)

  function prevMonth() {
    if (month === 1) {
      onYear(year - 1)
      onMonth(12)
    } else onMonth(month - 1)
  }

  function nextMonth() {
    if (month === 12) {
      onYear(year + 1)
      onMonth(1)
    } else onMonth(month + 1)
  }

  function setStart(value: string) {
    onFrom(value)
    if (value) {
      onYear(Number(value.slice(0, 4)))
      onMonth(Number(value.slice(5, 7)))
      if (to && value > to) onTo(value)
    }
  }

  function setEnd(value: string) {
    onTo(value)
    if (value) {
      if (!from) {
        onYear(Number(value.slice(0, 4)))
        onMonth(Number(value.slice(5, 7)))
      }
      if (from && value < from) onFrom(value)
    }
  }

  return (
    <div className="space-y-3 rounded-3xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="rounded-2xl border border-line p-2" onClick={prevMonth} aria-label="Previous month">
          <ChevronLeft size={18} />
        </button>
        <select
          className="min-w-0 flex-1 rounded-2xl border border-line bg-bg px-3 py-2 sm:flex-none"
          value={month}
          onChange={(e) => onMonth(Number(e.target.value))}
        >
          {MONTHS.map((name, i) => (
            <option key={name} value={i + 1}>
              {name}
            </option>
          ))}
        </select>
        <select
          className="w-28 rounded-2xl border border-line bg-bg px-3 py-2"
          value={year}
          onChange={(e) => onYear(Number(e.target.value))}
        >
          {years.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <button type="button" className="rounded-2xl border border-line p-2" onClick={nextMonth} aria-label="Next month">
          <ChevronRight size={18} />
        </button>
      </div>
      {people && onPerson ? (
        <label className="block text-sm">
          People
          <select
            className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2"
            value={personId || ''}
            onChange={(e) => onPerson(e.target.value)}
          >
            <option value="all">All people</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.you ? `${person.name} (you)` : person.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-sm">
          Start date
          <input className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2" type="date" value={from} onChange={(e) => setStart(e.target.value)} />
        </label>
        <label className="text-sm">
          End date
          <input className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2" type="date" value={to} onChange={(e) => setEnd(e.target.value)} />
        </label>
      </div>
      {from || to ? (
        <button
          type="button"
          className="text-sm text-accent"
          onClick={() => {
            onFrom('')
            onTo('')
          }}
        >
          Clear dates
        </button>
      ) : null}
    </div>
  )
}

export function CalendarLegend() {
  const items: Array<[DayInfo['status'], string]> = [
    ['present', 'Present'],
    ['open', 'Checked in'],
    ['leave', 'Paid leave'],
    ['pending', 'Leave pending'],
    ['holiday', 'Holiday'],
    ['absent', 'Absent'],
  ]
  return (
    <div className="flex flex-wrap gap-2 text-xs text-muted">
      {items.map(([status, label]) => (
        <span key={status} className={`rounded-full px-2 py-1 ${tone(status)}`}>
          {label}
        </span>
      ))}
    </div>
  )
}

export function statusChip(approved: boolean): ReactNode {
  return approved ? <span className="text-good">Approved</span> : <span className="text-warn">Pending approval</span>
}
