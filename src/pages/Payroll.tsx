import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { isHr, isInactive, type User } from '../types'
import { EmailStatus } from '../components/EmailStatus'
import { STATUS_LABEL, type DayInfo } from '../components/AttendanceCalendar'
import { isoDate, money, periodLabel } from '../payCycle'

type Salary = {
  id: string
  userId: string
  month: string
  from?: string
  to?: string
  period?: string
  gross: number
  computedNet?: number
  net: number
  netAdjusted?: boolean
  presentDays: number
  workingDays: number
  leaveDays: number
  emailedAt?: string | null
  user?: User | null
}

type Insights = {
  monthsWorked: number
  cyclesPaid: number
  totalReceived: number
  pendingAmount: number
  lastNet: number
  averageNet: number
  lastPaidTo?: string | null
  suggestedFrom?: string
  suggestedTo?: string
  caughtUp?: boolean
  cycles: Salary[]
  people?: Array<{
    user: User
    monthsWorked: number
    cyclesPaid: number
    totalReceived: number
    pendingAmount: number
    lastNet: number
    averageNet: number
  }>
}

type Slip = { previewUrl?: string; mode?: string }
type Session = { checkIn?: string; checkOut?: string | null }
type Punch = { userId: string; date: string; checkIn?: string; checkOut?: string; sessions?: Session[] }
type Holiday = { date: string; name: string }
type Leave = { userId: string; from: string; to: string; status: string }

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function nextDate(date: string) {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return isoDate(d)
}

function datesInRange(from: string, to: string) {
  if (!from || !to || from > to) return []
  const dates: string[] = []
  let date = from
  for (let i = 0; i < 400 && date <= to; i += 1) {
    dates.push(date)
    const nxt = nextDate(date)
    if (!nxt || nxt <= date) break
    date = nxt
  }
  return dates
}

function sessionsOf(row?: Punch): Session[] {
  if (!row) return []
  if (row.sessions?.length) return row.sessions
  if (row.checkIn) return [{ checkIn: row.checkIn, checkOut: row.checkOut || null }]
  return []
}

function hoursOf(row?: Punch) {
  return sessionsOf(row).reduce((sum, item) => {
    if (!item.checkIn || !item.checkOut) return sum
    return sum + (new Date(item.checkOut).getTime() - new Date(item.checkIn).getTime()) / 3600000
  }, 0)
}

function clock(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function dayStatus(
  date: string,
  punches: Punch[],
  holidays: Holiday[],
  leaves: Leave[],
): DayInfo['status'] {
  const today = new Date().toISOString().slice(0, 10)
  const weekday = new Date(`${date}T12:00:00`).getDay()
  const punch = punches.find((p) => p.date === date)
  const onLeave = leaves.some((leave) => leave.status === 'approved' && date >= leave.from && date <= leave.to)
  const pending = leaves.some((leave) => leave.status === 'pending' && date >= leave.from && date <= leave.to)
  if (weekday === 0 || weekday === 6) return 'weekend'
  if (holidays.some((h) => h.date === date)) return 'holiday'
  if (onLeave) return 'leave'
  if (pending) return 'pending'
  if (sessionsOf(punch).some((item) => item.checkIn && !item.checkOut)) return 'open'
  if (punch?.checkIn && (punch.checkOut || hoursOf(punch) > 0)) return 'present'
  if (punch?.checkIn) return 'open'
  if (date > today) return 'upcoming'
  return 'absent'
}

type SplitDay = {
  date: string
  day: string
  status: DayInfo['status']
  hours: number
  in1: string
  out1: string
  in2: string
  out2: string
  pay: number
}

function splitFor(salary: Salary, punches: Punch[], holidays: Holiday[], leaves: Leave[]): SplitDay[] {
  const from = salary.from || `${salary.month}-01`
  const to = salary.to || from
  const mine = punches.filter((p) => p.userId === salary.userId)
  const myLeaves = leaves.filter((l) => l.userId === salary.userId)
  const payable = Math.max(salary.workingDays - salary.leaveDays, 0)
  const dayPay = payable ? Number(salary.gross || 0) / payable : 0
  return datesInRange(from, to).map((date) => {
    const punch = mine.find((p) => p.date === date)
    const sessions = sessionsOf(punch)
    const status = dayStatus(date, mine, holidays, myLeaves)
    const paid = status === 'present' || status === 'open'
    return {
      date,
      day: WEEKDAYS[new Date(`${date}T12:00:00`).getDay()],
      status,
      hours: hoursOf(punch),
      in1: clock(sessions[0]?.checkIn),
      out1: clock(sessions[0]?.checkOut),
      in2: clock(sessions[1]?.checkIn),
      out2: clock(sessions[1]?.checkOut),
      pay: paid ? dayPay : 0,
    }
  })
}

function monthRange(offset = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = offset === 0 ? now : new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  return { from: isoDate(start), to: isoDate(end) }
}

export function PayrollPage() {
  const { role, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const hr = isHr(role)
  const joining = !hr && (user?.hrStep || 0) < 7
  const current = useMemo(() => monthRange(0), [])
  const [from, setFrom] = useState(current.from)
  const [to, setTo] = useState(current.to)
  const personId = hr ? params.get('person') || 'all' : user?.id || ''
  const [people, setPeople] = useState<User[]>([])
  const [rows, setRows] = useState<Salary[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [nets, setNets] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailMeta, setEmailMeta] = useState({ previewUrl: '', error: '', name: '' })
  const [punches, setPunches] = useState<Punch[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const fillRange = useRef(true)

  async function load() {
    const query = new URLSearchParams({ from, to })
    if (hr && personId && personId !== 'all') query.set('userId', personId)
    const insightQuery = hr && personId !== 'all' && personId ? `?userId=${personId}` : ''
    const [data, insightRows, userRows, punchRows, hols, leaveRows] = await Promise.all([
      api<Salary[]>(`/payroll?${query}`),
      api<Insights>(`/payroll/insights${insightQuery}`),
      hr ? api<User[]>('/users') : Promise.resolve([]),
      hr ? api<Punch[]>('/attendance') : Promise.resolve([]),
      hr ? api<Holiday[]>('/holidays') : Promise.resolve([]),
      hr ? api<Leave[]>('/leaves') : Promise.resolve([]),
    ])
    setRows(data)
    setInsights(insightRows)
    setNets(Object.fromEntries(data.map((row) => [row.id, String(row.net)])))
    if (hr) {
      setPeople(userRows.filter((person) => person.role === 'employee'))
      setPunches(punchRows)
      setHolidays(hols)
      setLeaves(leaveRows)
    }
    if (hr && fillRange.current && insightRows.suggestedFrom && insightRows.suggestedTo && !insightRows.caughtUp) {
      fillRange.current = false
      if (insightRows.suggestedFrom !== from || insightRows.suggestedTo !== to) {
        setFrom(insightRows.suggestedFrom)
        setTo(insightRows.suggestedTo)
        return
      }
    }
    fillRange.current = false
  }

  useEffect(() => {
    void load().catch((err) => setError(err instanceof Error ? err.message : 'Could not load payroll'))
  }, [from, to, personId, hr])

  function setPerson(id: string) {
    fillRange.current = true
    const next = new URLSearchParams(params)
    if (id && id !== 'all') next.set('person', id)
    else next.delete('person')
    setParams(next, { replace: true })
  }

  function applyRange(nextFrom: string, nextTo: string) {
    fillRange.current = false
    setFrom(nextFrom)
    setTo(nextTo)
  }

  async function run() {
    setError('')
    setNotice('')
    try {
      const result = await api<{ salaries: Salary[]; skipped?: Array<{ name: string; reason: string }> }>('/payroll/run', {
        method: 'POST',
        body: { from, to, userId: hr && personId !== 'all' ? personId : undefined },
      })
      if (result.skipped?.length) {
        setNotice(result.skipped.map((item) => `${item.name}: ${item.reason}`).join(' '))
      }
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payroll failed')
    }
  }

  async function saveNet(id: string) {
    const row = rows.find((item) => item.id === id)
    const net = Number(nets[id])
    if (!row || row.emailedAt || !Number.isFinite(net) || net === row.net) return
    setError('')
    try {
      const updated = await api<Salary>(`/payroll/${id}`, { method: 'PATCH', body: { net } })
      setRows((current) => current.map((item) => (item.id === id ? { ...item, ...updated } : item)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update amount')
    }
  }

  async function email(row: Salary) {
    setError('')
    setEmailMeta({ previewUrl: '', error: '', name: row.user?.name || 'employee' })
    setEmailState('sending')
    try {
      const net = Number(nets[row.id])
      if (Number.isFinite(net) && net !== row.net) {
        await api(`/payroll/${row.id}`, { method: 'PATCH', body: { net } })
      }
      const slip = await api<Slip>(`/payroll/${row.id}/email`, { method: 'POST' })
      setEmailMeta({ previewUrl: slip.previewUrl || '', error: '', name: row.user?.name || 'employee' })
      setEmailState('sent')
      await load()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Email failed'
      setError(message)
      setEmailMeta((meta) => ({ ...meta, error: message }))
      setEmailState('error')
    }
  }

  const label = periodLabel(from, to)
  const maxNet = Math.max(...(insights?.cycles || []).map((row) => Number(row.net || 0)), 1)
  const activePeople = people.filter((person) => !isInactive(person))
  const inactivePeople = people.filter((person) => isInactive(person))
  const selectedPerson = people.find((person) => person.id === personId)
  const viewingInactive = Boolean(hr && personId !== 'all' && selectedPerson && isInactive(selectedPerson))

  if (joining) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl">Payroll</h1>
        <p className="text-muted">Payslips and month-by-month pay open after joining is complete.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {hr ? (
        <EmailStatus
          state={emailState}
          label={emailMeta.name ? `payslip for ${emailMeta.name}` : 'payslip'}
          previewUrl={emailMeta.previewUrl}
          error={emailMeta.error}
          onClose={() => setEmailState('idle')}
        />
      ) : null}
      <div>
        <h1 className="font-display text-3xl">Payroll</h1>
        <p className="text-muted">
          {hr
            ? 'Payroll runs for active people only. Open an inactive person to read their past payslips.'
            : 'Each payslip is for the date range HR processed. See how many months you have worked and what you received.'}
        </p>
      </div>

      <div className="space-y-3 rounded-3xl border border-line bg-surface p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            Start date
            <input className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2" type="date" value={from} onChange={(e) => applyRange(e.target.value, to)} />
          </label>
          <label className="text-sm">
            End date
            <input className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2" type="date" value={to} onChange={(e) => applyRange(from, e.target.value)} />
          </label>
        </div>
        {hr ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="rounded-2xl border border-line px-3 py-2 text-sm" onClick={() => applyRange(monthRange(0).from, monthRange(0).to)}>
              This month
            </button>
            <button type="button" className="rounded-2xl border border-line px-3 py-2 text-sm" onClick={() => applyRange(monthRange(-1).from, monthRange(-1).to)}>
              Last month
            </button>
            {insights?.suggestedFrom && insights?.suggestedTo && !insights.caughtUp ? (
              <button
                type="button"
                className="rounded-2xl border border-line px-3 py-2 text-sm"
                onClick={() => applyRange(insights.suggestedFrom || from, insights.suggestedTo || to)}
              >
                Unprocessed range
              </button>
            ) : null}
          </div>
        ) : null}
        {hr && personId !== 'all' && insights?.lastPaidTo ? (
          <p className="text-sm text-muted">
            Last paid through{' '}
            {new Date(`${insights.lastPaidTo}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}.
          </p>
        ) : null}
        {hr && insights?.caughtUp && !viewingInactive ? (
          <p className="text-sm text-good">
            {personId === 'all' ? 'Everyone active is paid up to today.' : 'This person is paid up to date. Pick a later range only if they are leaving or days were missed.'}
          </p>
        ) : null}
        {hr ? (
          <label className="block text-sm">
            {viewingInactive ? 'Past records for' : 'Process for'}
            <select
              className="mt-1 w-full rounded-2xl border border-line bg-bg px-3 py-2"
              value={personId}
              onChange={(e) => setPerson(e.target.value)}
            >
              <option value="all">All active people</option>
              <optgroup label="Active">
                {activePeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </optgroup>
              {inactivePeople.length ? (
                <optgroup label="Inactive · past records">
                  {inactivePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </label>
        ) : null}
        {hr && viewingInactive ? (
          <p className="text-sm text-muted">This person is inactive. Past payslips stay here. They are not included in payroll runs.</p>
        ) : null}
        {hr && personId !== 'all' && !viewingInactive ? (
          <p className="text-sm text-muted">One active person only — use this for a final settlement before they exit.</p>
        ) : null}
      </div>

      {insights ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={hr && personId === 'all' ? 'People' : 'Months worked'} value={String(hr && personId === 'all' ? insights.people?.length || 0 : insights.monthsWorked)} />
          <Stat label="Paid cycles" value={String(insights.cyclesPaid)} />
          <Stat label="Received" value={money(insights.totalReceived)} />
          <Stat label={insights.pendingAmount ? 'Pending' : 'Last pay'} value={money(insights.pendingAmount || insights.lastNet)} />
        </div>
      ) : null}

      {insights?.cycles?.length && !(hr && personId === 'all') ? (
        <section className="space-y-3 rounded-3xl border border-line bg-surface p-4">
          <div>
            <h2 className="font-display text-2xl">Each cycle</h2>
            <p className="text-sm text-muted">What was received in each processed date range.</p>
          </div>
          <ul className="space-y-3">
            {insights.cycles.map((row) => (
              <li key={row.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <p>
                    {row.period || periodLabel(row.from || '', row.to || '')}
                    {hr && personId === 'all' && row.user?.name ? <span className="text-muted"> · {row.user.name}</span> : null}
                  </p>
                  <p className="font-medium">{money(row.net)}</p>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(8, (row.net / maxNet) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">
                  {row.presentDays}/{row.workingDays} days
                  {row.emailedAt ? ' · paid' : ' · not sent'}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {hr && insights?.people?.length && personId === 'all' ? (
        <section className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Months worked</th>
                <th className="px-4 py-3">Received</th>
                <th className="px-4 py-3">Last pay</th>
              </tr>
            </thead>
            <tbody>
              {insights.people.map((row) => (
                <tr key={row.user.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <button type="button" className="text-accent" onClick={() => setPerson(row.user.id)}>
                      {row.user.name}
                    </button>
                  </td>
                  <td className="px-4 py-3">{row.monthsWorked}</td>
                  <td className="px-4 py-3">{money(row.totalReceived)}</td>
                  <td className="px-4 py-3">{money(row.lastNet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {hr && !viewingInactive ? (
        <button type="button" onClick={() => void run()} className="rounded-2xl bg-accent px-4 py-3 text-accent-fg">
          {personId === 'all' ? 'Generate payslips for everyone active' : `Generate payslip for ${selectedPerson?.name || 'this person'}`}
        </button>
      ) : null}
      {notice ? <p className="text-sm text-warn">{notice}</p> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <ul className="space-y-6">
        {(hr && personId === 'all' ? rows.filter((row) => !isInactive(row.user)) : rows).map((row) => {
          const days = hr ? splitFor(row, punches, holidays, leaves) : []
          const present = days.filter((day) => day.status === 'present' || day.status === 'open').length
          const leave = days.filter((day) => day.status === 'leave').length
          const hours = Math.round(days.reduce((sum, day) => sum + day.hours, 0) * 10) / 10
          const paySum = Math.round(days.reduce((sum, day) => sum + day.pay, 0))
          const pastOnly = viewingInactive || isInactive(row.user)
          return (
            <li key={row.id} className="overflow-hidden rounded-3xl border-2 border-ink/20 bg-surface">
              <div className="flex flex-wrap items-start justify-between gap-3 bg-ink px-4 py-3 text-bg">
                <div>
                  <p className="font-display text-xl">{row.user?.name || 'You'}</p>
                  <p className="text-sm text-bg/80">
                    {row.period || label} · {row.presentDays}/{row.workingDays} days · leave {row.leaveDays}
                  </p>
                </div>
                {row.emailedAt ? <p className="text-sm text-good">Paid</p> : <p className="text-sm text-warn">{hr ? 'Review then send' : 'Pending'}</p>}
              </div>
              {hr && days.length ? (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                    <thead className="bg-bg text-muted">
                      <tr>
                        <th className="border border-line px-3 py-2">Date</th>
                        <th className="border border-line px-3 py-2">Day</th>
                        <th className="border border-line px-3 py-2">Status</th>
                        <th className="border border-line px-3 py-2">In</th>
                        <th className="border border-line px-3 py-2">Out</th>
                        <th className="border border-line px-3 py-2">In 2</th>
                        <th className="border border-line px-3 py-2">Out 2</th>
                        <th className="border border-line px-3 py-2">Hours</th>
                        <th className="border border-line px-3 py-2">Pay</th>
                      </tr>
                    </thead>
                    <tbody>
                      {days.map((day) => (
                        <tr key={day.date} className={day.status === 'weekend' || day.status === 'holiday' ? 'text-muted' : ''}>
                          <td className="border border-line px-3 py-2 whitespace-nowrap">{day.date}</td>
                          <td className="border border-line px-3 py-2">{day.day}</td>
                          <td className="border border-line px-3 py-2">{STATUS_LABEL[day.status] || '—'}</td>
                          <td className="border border-line px-3 py-2">{day.in1 || '—'}</td>
                          <td className="border border-line px-3 py-2">{day.out1 || '—'}</td>
                          <td className="border border-line px-3 py-2">{day.in2 || '—'}</td>
                          <td className="border border-line px-3 py-2">{day.out2 || '—'}</td>
                          <td className="border border-line px-3 py-2">{day.hours ? day.hours.toFixed(1) : '—'}</td>
                          <td className="border border-line px-3 py-2">{day.pay ? money(Math.round(day.pay)) : day.status === 'leave' ? 'Leave' : '—'}</td>
                        </tr>
                      ))}
                      <tr className="bg-bg font-medium">
                        <td className="border border-line px-3 py-2" colSpan={7}>
                          Sum · Present {present} · Leave {leave}
                        </td>
                        <td className="border border-line px-3 py-2">{hours ? hours.toFixed(1) : '—'}</td>
                        <td className="border border-line px-3 py-2">{money(paySum)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : null}
              <div className="space-y-3 p-4">
                {hr && !pastOnly ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                    <p className="text-sm text-muted">
                      Calculated
                      <span className="mt-1 block font-display text-2xl text-ink">{money(row.computedNet ?? paySum)}</span>
                    </p>
                    <label className="text-sm">
                      Final amount
                      <input
                        className="mt-1 w-full rounded-2xl border border-line px-3 py-2"
                        type="number"
                        min={0}
                        disabled={Boolean(row.emailedAt)}
                        value={nets[row.id] ?? String(row.net)}
                        onChange={(e) => setNets((current) => ({ ...current, [row.id]: e.target.value }))}
                        onBlur={() => void saveNet(row.id)}
                      />
                    </label>
                    {!row.emailedAt ? (
                      <button type="button" className="rounded-2xl bg-ink px-4 py-3 text-bg" onClick={() => void email(row)}>
                        Send
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <p className="font-display text-3xl">{money(row.net)}</p>
                )}
              </div>
            </li>
          )
        })}
        {!rows.length || (hr && personId === 'all' && !rows.some((row) => !isInactive(row.user))) ? (
          <p className="text-sm text-muted">No payslips in this date range.</p>
        ) : null}
      </ul>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-3xl border border-line bg-surface px-4 py-5">
      <p className="font-display text-2xl sm:text-3xl">{value}</p>
      <p className="mt-1 text-sm text-muted">{label}</p>
    </div>
  )
}
