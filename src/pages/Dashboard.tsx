import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { AttendanceCalendar, CalendarLegend, CalendarToolbar, statusChip, type DayInfo } from '../components/AttendanceCalendar'
import { money } from '../payCycle'
import { isHr, type HrStep, type User } from '../types'

type Punch = { date: string; checkIn?: string; checkOut?: string; sessions?: Array<{ checkIn?: string; checkOut?: string | null }> }
type Holiday = { date: string; name: string }
type Leave = { from: string; to: string; status: string }
type Summary = {
  user: User
  presentDays: number
  hours: number
  leaveDays: number
  approved: boolean
}

function hoursOf(row?: Punch) {
  const sessions = row?.sessions?.length
    ? row.sessions
    : row?.checkIn
      ? [{ checkIn: row.checkIn, checkOut: row.checkOut || null }]
      : []
  return sessions.reduce((sum, item) => {
    if (!item.checkIn || !item.checkOut) return sum
    return sum + (new Date(item.checkOut).getTime() - new Date(item.checkIn).getTime()) / 3600000
  }, 0)
}

function isOpen(row?: Punch) {
  const sessions = row?.sessions?.length
    ? row.sessions
    : row?.checkIn
      ? [{ checkIn: row.checkIn, checkOut: row.checkOut || null }]
      : []
  return sessions.some((item) => item.checkIn && !item.checkOut)
}

export function DashboardPage() {
  const { user, role } = useAuth()
  if (!isHr(role)) return <EmployeeHome />
  return <HrHome userName={user?.name || ''} />
}

type PayInsights = {
  monthsWorked: number
  cyclesPaid: number
  totalReceived: number
  lastNet: number
  pendingAmount: number
  people?: Array<{ user: User }>
}

function HrHome({ userName }: { userName: string }) {
  const [people, setPeople] = useState<User[]>([])
  const [steps, setSteps] = useState<HrStep[]>([])
  const [pay, setPay] = useState<PayInsights | null>(null)

  useEffect(() => {
    void api<{ steps: HrStep[] }>('/meta').then((d) => setSteps(d.steps))
    void api<User[]>('/users').then(setPeople).catch(() => setPeople([]))
    void api<PayInsights>('/payroll/insights').then(setPay).catch(() => setPay(null))
  }, [])

  const onboarded = people.filter((p) => p.hrStep >= 7).length
  const faced = people.filter((p) => p.hasFace).length

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-muted">HR</p>
        <h1 className="font-display text-3xl md:text-4xl">{userName}</h1>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="People" value={String(people.length)} />
        <Stat label="Onboarded" value={String(onboarded)} />
        <Stat label="Faces enrolled" value={String(faced)} />
        <Stat label="In process" value={String(people.filter((p) => p.hrStep < 7).length)} />
      </div>
      {pay ? (
        <section className="space-y-3">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-2xl">Payroll</h2>
            <Link to="/app/payroll" className="text-sm text-accent">
              Open payroll
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Paid cycles" value={String(pay.cyclesPaid)} />
            <Stat label="Paid out" value={money(pay.totalReceived)} />
            <Stat label="Pending" value={money(pay.pendingAmount)} />
            <Stat label="People on payroll" value={String(pay.people?.length || 0)} />
          </div>
        </section>
      ) : null}
      <section>
        <div className="flex items-end justify-between">
          <h2 className="font-display text-2xl">Lifecycle</h2>
          <Link to="/app/people" className="text-sm text-accent">
            Open people
          </Link>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {steps.map((step) => (
            <div key={step.id} className="rounded-2xl border border-line bg-surface px-4 py-3">
              <p className="text-xs text-muted">{step.id}</p>
              <p className="text-sm">{step.label}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function EmployeeHome() {
  const { user } = useAuth()
  const [me, setMe] = useState<User | null>(user)
  const [summary, setSummary] = useState<Summary | null>(null)
  const [punches, setPunches] = useState<Punch[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [pay, setPay] = useState<PayInsights | null>(null)
  const monthKey = `${year}-${String(month).padStart(2, '0')}`
  const joining = (me?.hrStep || 0) < 7

  useEffect(() => {
    if (!user) return
    void api<User>(`/users/${user.id}`).then(setMe)
    if ((user.hrStep || 0) >= 7) {
      void api<Summary[]>(`/attendance/summary?year=${year}&month=${month}`).then((rows) => setSummary(rows[0] || null))
      void api<Punch[]>(
        from && to && from.slice(0, 7) !== to.slice(0, 7) ? '/attendance' : `/attendance?month=${monthKey}`,
      ).then(setPunches)
      void api<Holiday[]>('/holidays').then((rows) => setHolidays(rows.filter((h) => h.date.startsWith(monthKey))))
      void api<Leave[]>('/leaves').then(setLeaves)
      void api<PayInsights>('/payroll/insights').then(setPay).catch(() => setPay(null))
    }
  }, [user, year, month, monthKey, from, to])

  if (!me) return <p className="text-muted">Loading…</p>

  if (joining) {
    return (
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted">Joining</p>
          <h1 className="font-display text-3xl">{me.name}</h1>
          <p className="text-muted">Complete these steps with HR. Attendance opens after joining.</p>
        </div>
        <Link to={`/app/people/${me.id}`} className="block rounded-3xl border border-accent bg-surface px-4 py-5">
          <p className="text-xs uppercase tracking-wide text-muted">Your next step</p>
          <p className="mt-1 font-display text-2xl">Continue joining</p>
          <p className="mt-1 text-sm text-muted">Offer, documents, and face enrolment.</p>
        </Link>
      </div>
    )
  }

  const last = new Date(year, month, 0).getDate()
  const today = now.toISOString().slice(0, 10)
  const holidaySet = new Set(holidays.map((h) => h.date))
  const leaveSet = new Set<string>()
  const pendingSet = new Set<string>()
  for (const leave of leaves) {
    for (let d = 1; d <= last; d += 1) {
      const date = `${monthKey}-${String(d).padStart(2, '0')}`
      if (date < leave.from || date > leave.to) continue
      if (leave.status === 'approved') leaveSet.add(date)
      if (leave.status === 'pending') pendingSet.add(date)
    }
  }
  const days: DayInfo[] = Array.from({ length: last }, (_, i) => {
    const date = `${monthKey}-${String(i + 1).padStart(2, '0')}`
    const weekday = new Date(`${date}T12:00:00`).getDay()
    const punch = punches.find((p) => p.date === date)
    let status: DayInfo['status'] = 'empty'
    if (weekday === 0 || weekday === 6) status = 'weekend'
    else if (holidaySet.has(date)) status = 'holiday'
    else if (leaveSet.has(date)) status = 'leave'
    else if (pendingSet.has(date)) status = 'pending'
    else if (isOpen(punch)) status = 'open'
    else if (punch?.checkIn && (punch.checkOut || hoursOf(punch) > 0)) status = 'present'
    else if (punch?.checkIn) status = 'open'
    else if (date > today) status = 'upcoming'
    else status = 'absent'
    const muted = Boolean((from && date < from) || (to && date > to))
    return { date, label: i + 1, status, hours: hoursOf(punch), muted }
  })
  const ranged = days.filter((day) => !day.muted && day.status !== 'weekend' && day.status !== 'upcoming' && day.status !== 'empty')
  const rangePresent = ranged.filter((day) => day.status === 'present' || day.status === 'open').length
  const rangeHours = Math.round(ranged.reduce((sum, day) => sum + day.hours, 0) * 10) / 10
  const rangeLeave = ranged.filter((day) => day.status === 'leave').length

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-muted">Attendance</p>
        <h1 className="font-display text-3xl">{me.name}</h1>
      </div>
      {pay ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Months worked" value={String(pay.monthsWorked)} />
            <Stat label="Paid cycles" value={String(pay.cyclesPaid)} />
            <Stat label="Received" value={money(pay.totalReceived)} />
            <Stat label="Last pay" value={money(pay.lastNet)} />
          </div>
          <Link to="/app/payroll" className="inline-block text-sm text-accent">
            See each month’s pay
          </Link>
        </div>
      ) : null}
      <CalendarToolbar year={year} month={month} onYear={setYear} onMonth={setMonth} from={from} to={to} onFrom={setFrom} onTo={setTo} />
      {summary ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Present" value={String(from || to ? rangePresent : summary.presentDays)} />
          <Stat label="Hours" value={String(from || to ? rangeHours : summary.hours)} />
          <Stat label="Leave" value={String(from || to ? rangeLeave : summary.leaveDays)} />
          <div className="rounded-3xl border border-line bg-surface px-4 py-5">
            <p className="font-display text-xl">{statusChip(summary.approved)}</p>
            <p className="mt-1 text-sm text-muted">Status</p>
          </div>
        </div>
      ) : null}
      <CalendarLegend />
      <AttendanceCalendar days={days} weekStartBlank={new Date(year, month - 1, 1).getDay()} />
      <Link to="/app/attendance" className="inline-block text-sm text-accent">
        Open full calendar
      </Link>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-5">
      <p className="font-display text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}
