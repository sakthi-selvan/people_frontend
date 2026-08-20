import { useEffect, useMemo, useState } from 'react'
import { CalendarToolbar } from '../components/AttendanceCalendar'
import { api } from '../api'
import { type User } from '../types'

type SessionFace = {
  checkIn?: string | null
  checkOut?: string | null
  checkInPhoto?: string | null
  checkOutPhoto?: string | null
}

type DayRow = {
  user: User | null
  date: string
  hours: number
  sessions: SessionFace[]
}

type DayCount = { date: string; photos: number }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(value: number) {
  return String(value).padStart(2, '0')
}

function clock(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function photoLabel(count: number) {
  if (count === 1) return '1 photo'
  return `${count} photos`
}

function formatLongDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function monthDates(year: number, month: number) {
  const last = new Date(year, month, 0).getDate()
  return Array.from({ length: last }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`)
}

export function FacesPage() {
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [date, setDate] = useState(now.toISOString().slice(0, 10))
  const [days, setDays] = useState<DayCount[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<DayRow[]>([])
  const [error, setError] = useState('')
  const monthKey = `${year}-${pad(month)}`
  const photosByDate = useMemo(() => Object.fromEntries(days.map((item) => [item.date, item.photos])), [days])
  const selectedPhotos = photosByDate[date] || 0
  const dates = monthDates(year, month)
  const weekStartBlank = new Date(year, month - 1, 1).getDay()
  const cells: Array<string | null> = [...Array(weekStartBlank).fill(null), ...dates]
  while (cells.length % 7 !== 0) cells.push(null)

  useEffect(() => {
    void api<DayCount[]>(`/attendance/faces/days?month=${monthKey}`)
      .then((list) => {
        setDays(list)
        const inRange = list.filter((item) => (!from || item.date >= from) && (!to || item.date <= to))
        if (inRange.length && !inRange.some((item) => item.date === date)) setDate(inRange[0].date)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load days'))
  }, [monthKey])

  useEffect(() => {
    if (!date) return
    void api<DayRow[]>(`/attendance/faces?date=${date}`)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load faces'))
  }, [date])

  function inRange(iso: string) {
    if (from && iso < from) return false
    if (to && iso > to) return false
    return true
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Faces</h1>
        <p className="text-muted">Kiosk check-in and check-out photos. Pick a day to review who punched.</p>
      </div>
      <CalendarToolbar
        year={year}
        month={month}
        onYear={setYear}
        onMonth={setMonth}
        from={from}
        to={to}
        onFrom={(value) => {
          setFrom(value)
          if (value) setDate(value)
        }}
        onTo={(value) => {
          setTo(value)
          if (value) setDate(value)
        }}
      />
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="rounded-3xl border border-line bg-surface p-3 sm:p-4">
        <p className="mb-3 text-sm text-muted">Days with a number have kiosk photos. Tap a day to open them.</p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
          {cells.map((iso, i) => {
            if (!iso) return <div key={`b-${i}`} />
            const count = photosByDate[iso] || 0
            const selected = iso === date
            const enabled = inRange(iso)
            const dayNum = Number(iso.slice(8))
            return (
              <button
                key={iso}
                type="button"
                disabled={!enabled}
                onClick={() => setDate(iso)}
                aria-label={`${formatLongDate(iso)}${count ? `, ${photoLabel(count)}` : ', no photos'}`}
                className={`min-h-16 rounded-2xl p-1.5 text-left sm:min-h-20 ${
                  selected
                    ? 'bg-accent text-accent-fg'
                    : count
                      ? 'bg-good/15 text-ink'
                      : 'bg-bg/50 text-muted'
                } ${enabled ? '' : 'opacity-30'}`}
              >
                <p className="text-xs font-medium">{dayNum}</p>
                {count ? (
                  <p className={`mt-1 text-[10px] leading-tight sm:text-xs ${selected ? 'text-accent-fg/90' : 'text-muted'}`}>
                    {photoLabel(count)}
                  </p>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      <div>
        <h2 className="font-display text-2xl">{formatLongDate(date)}</h2>
        <p className="text-sm text-muted">
          {selectedPhotos
            ? `${photoLabel(selectedPhotos)} · ${rows.length} ${rows.length === 1 ? 'person' : 'people'}`
            : 'No kiosk photos on this day.'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {rows.map((row) => (
          <article key={row.user?.id || row.date} className="rounded-3xl border border-line bg-surface p-4">
            <p className="font-medium">{row.user?.name || 'Employee'}</p>
            <p className="text-sm text-muted">
              {row.user?.code} · {row.hours}h
            </p>
            <div className="mt-3 space-y-3">
              {row.sessions.map((session, index) => (
                <div key={`${session.checkIn || index}`} className="grid grid-cols-2 gap-2">
                  <FaceShot src={session.checkInPhoto} label={`In ${clock(session.checkIn)}`} />
                  <FaceShot src={session.checkOutPhoto} label={`Out ${clock(session.checkOut)}`} />
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  )
}

function FaceShot({ src, label }: { src?: string | null; label: string }) {
  return (
    <div>
      <div className="overflow-hidden rounded-2xl bg-bg aspect-[4/5]">
        {src ? <img src={src} alt={label} className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-muted">No photo</div>}
      </div>
      <p className="mt-1 text-xs text-muted">{label}</p>
    </div>
  )
}
