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

function clock(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
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
  const monthKey = `${year}-${String(month).padStart(2, '0')}`

  useEffect(() => {
    void api<DayCount[]>(`/attendance/faces/days?month=${monthKey}`)
      .then((list) => {
        setDays(list)
        if (list.length && !list.some((item) => item.date === date)) setDate(list[0].date)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load days'))
  }, [monthKey])

  useEffect(() => {
    if (!date) return
    void api<DayRow[]>(`/attendance/faces?date=${date}`)
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load faces'))
  }, [date])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Faces</h1>
        <p className="text-muted">Every face the kiosk captured that day. Check-in and check-out photos.</p>
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
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.filter((item) => (!from || item.date >= from) && (!to || item.date <= to)).length === 0 ? (
          <p className="text-sm text-muted">{from || to ? 'No face captures in this date range.' : 'No face captures this month.'}</p>
        ) : null}
        {days
          .filter((item) => (!from || item.date >= from) && (!to || item.date <= to))
          .map((item) => (
          <button
            key={item.date}
            type="button"
            onClick={() => setDate(item.date)}
            className={`shrink-0 rounded-2xl px-3 py-2 text-sm ${
              date === item.date ? 'bg-accent text-accent-fg' : 'border border-line bg-surface'
            }`}
          >
            {item.date.slice(8)} · {item.photos}
          </button>
        ))}
      </div>
      <p className="text-sm text-muted">{date}</p>
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
