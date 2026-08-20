import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CalendarDays, Table2 } from 'lucide-react'
import { api } from '../api'
import { useAuth } from '../auth'
import {
  AttendanceCalendar,
  CalendarLegend,
  CalendarToolbar,
  STATUS_LABEL,
  statusChip,
  type DayInfo,
} from '../components/AttendanceCalendar'
import { isHr, isInactive, type User } from '../types'

type ViewMode = 'calendar' | 'excel'
type Session = { checkIn?: string; checkOut?: string | null }
type Punch = { userId: string; date: string; checkIn?: string; checkOut?: string; sessions?: Session[] }
type Holiday = { date: string; name: string }
type Leave = {
  id: string
  userId: string
  from: string
  to: string
  reason?: string
  status: string
  user?: { id: string; name: string } | null
}
type Summary = {
  user: User
  month: string
  workingDays: number
  presentDays: number
  leaveDays: number
  hours: number
  approved: boolean
}
type SheetRow = {
  userId: string
  name: string
  date: string
  day: string
  status: DayInfo['status']
  hours: number
  in1: string
  out1: string
  in2: string
  out2: string
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function pad(value: number) {
  return String(value).padStart(2, '0')
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

function isOpen(row?: Punch) {
  return sessionsOf(row).some((item) => item.checkIn && !item.checkOut)
}

function clock(value?: string | null) {
  if (!value) return ''
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function nextDate(date: string) {
  const d = new Date(`${date}T12:00:00`)
  d.setDate(d.getDate() + 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function saveExcel(filename: string, html: string) {
  const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xls') ? filename : `${filename.replace(/\.csv$/i, '')}.xls`
  link.rel = 'noopener'
  link.style.position = 'fixed'
  link.style.left = '-9999px'
  document.body.appendChild(link)
  link.dispatchEvent(new MouseEvent('click', { bubbles: false, cancelable: true, view: window }))
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function escapeCell(value: string) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function excelByEmployee(rows: SheetRow[]) {
  const order: string[] = []
  const groups = new Map<string, SheetRow[]>()
  for (const row of rows) {
    if (!groups.has(row.userId)) {
      order.push(row.userId)
      groups.set(row.userId, [])
    }
    groups.get(row.userId)?.push(row)
  }

  const box = 'border:1px solid #1f2937;padding:6px 10px;text-align:left'
  const head = `${box};background:#e8eef4;font-weight:bold`
  const blocks = order.map((id) => {
    const list = groups.get(id) || []
    const name = list[0]?.name || 'Employee'
    const present = list.filter((row) => row.status === 'present' || row.status === 'open').length
    const leave = list.filter((row) => row.status === 'leave').length
    const hours = Math.round(list.reduce((sum, row) => sum + row.hours, 0) * 10) / 10
    const body = list
      .map(
        (row) => `<tr>
          <td style="${box}">${escapeCell(row.date)}</td>
          <td style="${box}">${escapeCell(row.day)}</td>
          <td style="${box}">${escapeCell(STATUS_LABEL[row.status] || '')}</td>
          <td style="${box}">${escapeCell(row.in1)}</td>
          <td style="${box}">${escapeCell(row.out1)}</td>
          <td style="${box}">${escapeCell(row.in2)}</td>
          <td style="${box}">${escapeCell(row.out2)}</td>
          <td style="${box}">${row.hours ? row.hours.toFixed(1) : ''}</td>
        </tr>`,
      )
      .join('')
    return `<table style="border-collapse:collapse;border:2px solid #0b2a4a;margin:0 0 28px">
      <tr>
        <td colspan="8" style="background:#0b2a4a;color:#ffffff;font-size:16px;font-weight:bold;padding:10px 12px;border:1px solid #0b2a4a">${escapeCell(name)}</td>
      </tr>
      <tr>
        <th style="${head}">Date</th>
        <th style="${head}">Day</th>
        <th style="${head}">Status</th>
        <th style="${head}">Check-in</th>
        <th style="${head}">Check-out</th>
        <th style="${head}">Check-in 2</th>
        <th style="${head}">Check-out 2</th>
        <th style="${head}">Hours</th>
      </tr>
      ${body}
      <tr>
        <td colspan="7" style="${box}"><b>Present ${present} · Leave ${leave}</b></td>
        <td style="${box}"><b>${hours ? hours.toFixed(1) : ''}</b></td>
      </tr>
    </table>`
  })

  return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
  <head><meta charset="utf-8" /></head>
  <body>${blocks.join('<p style="margin:0;font-size:16px">&nbsp;</p>')}</body>
</html>`
}

function monthBounds(year: number, month: number) {
  const last = new Date(year, month, 0).getDate()
  return {
    start: `${year}-${pad(month)}-01`,
    end: `${year}-${pad(month)}-${pad(last)}`,
  }
}

function datesInFilter(year: number, month: number, from: string, to: string) {
  const bounds = monthBounds(year, month)
  const start = from || bounds.start
  const end = to || bounds.end
  const first = start <= end ? start : end
  const last = start <= end ? end : start
  const dates: string[] = []
  let date = first
  for (let i = 0; i < 400 && date <= last; i += 1) {
    dates.push(date)
    const nxt = nextDate(date)
    if (!nxt || nxt <= date) break
    date = nxt
  }
  return dates
}

function dayInfo(
  date: string,
  punches: Punch[],
  holidays: Holiday[],
  leaves: Leave[],
  from = '',
  to = '',
): DayInfo {
  const today = new Date().toISOString().slice(0, 10)
  const weekday = new Date(`${date}T12:00:00`).getDay()
  const punch = punches.find((p) => p.date === date)
  const onLeave = leaves.some((leave) => leave.status === 'approved' && date >= leave.from && date <= leave.to)
  const pending = leaves.some((leave) => leave.status === 'pending' && date >= leave.from && date <= leave.to)
  let status: DayInfo['status'] = 'empty'
  if (weekday === 0 || weekday === 6) status = 'weekend'
  else if (holidays.some((h) => h.date === date)) status = 'holiday'
  else if (onLeave) status = 'leave'
  else if (pending) status = 'pending'
  else if (isOpen(punch)) status = 'open'
  else if (punch?.checkIn && (punch.checkOut || hoursOf(punch) > 0)) status = 'present'
  else if (punch?.checkIn) status = 'open'
  else if (date > today) status = 'upcoming'
  else status = 'absent'
  return {
    date,
    label: Number(date.slice(8, 10)),
    status,
    hours: hoursOf(punch),
    muted: Boolean((from && date < from) || (to && date > to)),
  }
}

function buildDays(
  year: number,
  month: number,
  punches: Punch[],
  holidays: Holiday[],
  leaves: Leave[],
  from = '',
  to = '',
): DayInfo[] {
  const { start, end } = monthBounds(year, month)
  const days: DayInfo[] = []
  for (let date = start; date <= end; date = nextDate(date)) {
    days.push(dayInfo(date, punches, holidays, leaves, from, to))
  }
  return days
}

function sheetRowsFor(
  people: Array<{ id: string; name: string }>,
  dates: string[],
  punches: Punch[],
  holidays: Holiday[],
  leaves: Leave[],
  from: string,
  to: string,
): SheetRow[] {
  return people.flatMap((person) => {
    const mine = punches.filter((p) => p.userId === person.id)
    const myLeaves = leaves.filter((l) => l.userId === person.id)
    return dates.map((date) => {
      const day = dayInfo(date, mine, holidays, myLeaves, from, to)
      const punch = mine.find((p) => p.date === date)
      const sessions = sessionsOf(punch)
      return {
        userId: person.id,
        name: person.name,
        date,
        day: WEEKDAYS[new Date(`${date}T12:00:00`).getDay()],
        status: day.status,
        hours: day.hours,
        in1: clock(sessions[0]?.checkIn),
        out1: clock(sessions[0]?.checkOut),
        in2: clock(sessions[1]?.checkIn),
        out2: clock(sessions[1]?.checkOut),
      }
    })
  })
}

function rangeStats(days: DayInfo[]) {
  const ranged = days.filter((day) => !day.muted && day.status !== 'weekend' && day.status !== 'upcoming' && day.status !== 'empty')
  return {
    present: ranged.filter((day) => day.status === 'present' || day.status === 'open').length,
    hours: Math.round(ranged.reduce((sum, day) => sum + day.hours, 0) * 10) / 10,
    leave: ranged.filter((day) => day.status === 'leave').length,
  }
}

export function AttendancePage() {
  const { role, user } = useAuth()
  const [params, setParams] = useSearchParams()
  const joining = !isHr(role) && (user?.hrStep || 0) < 7
  const now = useMemo(() => new Date(), [])
  const [year, setYear] = useState(Number(params.get('year')) || now.getFullYear())
  const [month, setMonth] = useState(Number(params.get('month')) || now.getMonth() + 1)
  const [rows, setRows] = useState<Summary[]>([])
  const [people, setPeople] = useState<User[]>([])
  const [punches, setPunches] = useState<Punch[]>([])
  const [holidays, setHolidays] = useState<Holiday[]>([])
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [from, setFrom] = useState(params.get('from') || '')
  const [to, setTo] = useState(params.get('to') || '')
  const [view, setView] = useState<ViewMode>(params.get('view') === 'excel' ? 'excel' : 'calendar')
  const saving = useRef(false)
  const monthKey = `${year}-${pad(month)}`
  const hr = isHr(role)
  const rangeStart = from || `${monthKey}-01`
  const rangeEnd = to || monthBounds(year, month).end
  const spanMonths = rangeStart.slice(0, 7) !== monthKey || rangeEnd.slice(0, 7) !== monthKey
  const filterPeople = useMemo(() => {
    const list = people.filter((person) => person.role !== 'device')
    return [...list].sort((a, b) => {
      if (a.id === user?.id) return -1
      if (b.id === user?.id) return 1
      return a.name.localeCompare(b.name)
    })
  }, [people, user?.id])
  const activePeople = filterPeople.filter((person) => !isInactive(person))
  const inactivePeople = filterPeople.filter((person) => isInactive(person))
  const personId = hr ? params.get('person') || user?.id || '' : user?.id || ''
  const viewingAll = hr && personId === 'all'
  const viewingInactive = Boolean(hr && personId && personId !== 'all' && inactivePeople.some((person) => person.id === personId))

  function setPerson(id: string) {
    const next = new URLSearchParams(params)
    next.set('person', id)
    setParams(next, { replace: true })
  }

  async function load() {
    const [summary, punchRows, hols, leaveRows, userRows] = await Promise.all([
      api<Summary[]>(`/attendance/summary?year=${year}&month=${month}`),
      api<Punch[]>(spanMonths ? '/attendance' : `/attendance?month=${monthKey}`),
      api<Holiday[]>('/holidays'),
      api<Leave[]>('/leaves'),
      hr ? api<User[]>('/users') : Promise.resolve([]),
    ])
    let next = summary
    if (hr && personId && personId !== 'all' && !summary.some((row) => row.user.id === personId)) {
      const extra = await api<Summary[]>(`/attendance/summary?year=${year}&month=${month}&userId=${personId}`)
      next = [...summary, ...extra.filter((row) => !summary.some((item) => item.user.id === row.user.id))]
    }
    setRows(next)
    setPunches(punchRows)
    setHolidays(hols)
    setLeaves(leaveRows)
    if (hr) setPeople(userRows)
  }

  useEffect(() => {
    void load()
  }, [year, month, from, to, hr, personId])

  async function approve(userId: string) {
    await api('/attendance/approve', { method: 'POST', body: { userId, month: monthKey } })
    await load()
  }

  const allPeople = (activePeople.length ? activePeople : rows.map((row) => row.user)).map((person) => ({
    id: person.id,
    name: person.name,
  }))
  const selectedPeople = viewingAll
    ? allPeople
    : viewingInactive
      ? inactivePeople.filter((person) => person.id === personId).map((person) => ({ id: person.id, name: person.name }))
      : allPeople.filter((person) => person.id === personId).length
        ? allPeople.filter((person) => person.id === personId)
        : user
          ? [{ id: user.id, name: user.name }]
          : []
  const selectedId = viewingAll ? '' : selectedPeople[0]?.id || user?.id || ''
  const selectedPerson = rows.find((r) => r.user.id === selectedId)
  const calendarDays = buildDays(
    year,
    month,
    punches.filter((p) => p.userId === selectedId),
    holidays,
    leaves.filter((l) => l.userId === selectedId),
    from,
    to,
  )
  const stats = rangeStats(calendarDays)
  const weekStartBlank = new Date(year, month - 1, 1).getDay()
  const sheetDates = datesInFilter(year, month, from, to)
  const filteredSheet = sheetRowsFor(selectedPeople, sheetDates, punches, holidays, leaves, from, to)
  const allSheet = sheetRowsFor(allPeople, sheetDates, punches, holidays, leaves, from, to)
  const mine = selectedPerson || rows.find((r) => r.user.id === user?.id)

  function download(event: MouseEvent<HTMLButtonElement>, rowsToSave: SheetRow[], filename: string) {
    event.preventDefault()
    event.stopPropagation()
    if (saving.current) return
    saving.current = true
    saveExcel(filename, excelByEmployee(rowsToSave))
    window.setTimeout(() => {
      saving.current = false
    }, 1500)
  }

  if (joining) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-3xl">Attendance</h1>
        <p className="text-muted">Your calendar opens after joining is complete.</p>
        {user ? (
          <Link to={`/app/people/${user.id}`} className="inline-block rounded-2xl bg-accent px-4 py-3 text-accent-fg">
            Continue joining
          </Link>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Attendance</h1>
        <p className="text-muted">
          {hr
            ? 'Your attendance is shown first. Download includes active people only. Open an inactive person to read their past record.'
            : 'A day is 9 hours. Work it in one stretch, or two halves with two check-ins and check-outs.'}
        </p>
      </div>
      <CalendarToolbar
        year={year}
        month={month}
        onYear={setYear}
        onMonth={setMonth}
        from={from}
        to={to}
        onFrom={setFrom}
        onTo={setTo}
        people={
          hr
            ? [
                ...(user && !isInactive(user) ? [{ id: user.id, name: user.name, you: true, group: 'Active' }] : []),
                ...activePeople
                  .filter((person) => person.id !== user?.id)
                  .map((person) => ({ id: person.id, name: person.name, group: 'Active' })),
                ...inactivePeople.map((person) => ({
                  id: person.id,
                  name: person.name,
                  group: 'Inactive · past records',
                })),
              ]
            : undefined
        }
        personId={personId}
        onPerson={hr ? setPerson : undefined}
        allLabel="All active people"
      />
      <ViewSwitch view={view} onView={setView} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-2xl bg-accent px-4 py-2 text-sm text-accent-fg"
          onClick={(event) =>
            download(event, filteredSheet, `attendance-filtered-${sheetDates[0] || monthKey}.xls`)
          }
        >
          Download filtered
        </button>
        {hr ? (
          <button
            type="button"
            className="rounded-2xl border border-line px-4 py-2 text-sm"
            onClick={(event) => download(event, allSheet, `attendance-active-${sheetDates[0] || monthKey}.xls`)}
          >
            Download all active attendance
          </button>
        ) : null}
      </div>
      {viewingInactive ? (
        <p className="text-sm text-muted">
          This person is inactive. Past attendance is shown here and is not included in active downloads or monthly approval.
        </p>
      ) : null}
      {!viewingAll && (mine || stats) ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Present" value={`${from || to ? stats.present : mine?.presentDays ?? stats.present}`} />
          <Stat label="Hours" value={`${from || to ? stats.hours : mine?.hours ?? stats.hours}`} />
          <Stat label="Leave" value={`${from || to ? stats.leave : mine?.leaveDays ?? stats.leave}`} />
          <div className="rounded-3xl border border-line bg-surface px-4 py-5">
            <p className="font-display text-xl">{mine ? statusChip(mine.approved) : '—'}</p>
            <p className="mt-1 text-sm text-muted">Month status</p>
          </div>
        </div>
      ) : null}
      {view === 'calendar' ? (
        <div className="space-y-4">
          <CalendarLegend />
          {viewingAll ? (
            <div className="space-y-6">
              {selectedPeople.map((person) => (
                <section key={person.id} className="space-y-2">
                  <h2 className="font-display text-xl">{person.name}</h2>
                  <AttendanceCalendar
                    days={buildDays(
                      year,
                      month,
                      punches.filter((p) => p.userId === person.id),
                      holidays,
                      leaves.filter((l) => l.userId === person.id),
                      from,
                      to,
                    )}
                    weekStartBlank={weekStartBlank}
                  />
                </section>
              ))}
            </div>
          ) : (
            <AttendanceCalendar days={calendarDays} weekStartBlank={weekStartBlank} />
          )}
        </div>
      ) : (
        <AttendanceSheet
          hr={hr}
          rows={viewingAll ? rows : rows.filter((row) => row.user.id === selectedId)}
          sheet={filteredSheet}
          filtered={Boolean(from || to)}
          punches={punches}
          holidays={holidays}
          leaves={leaves}
          dates={sheetDates}
          from={from}
          to={to}
          onApprove={(id) => void approve(id)}
        />
      )}
    </div>
  )
}

function ViewSwitch({ view, onView }: { view: ViewMode; onView: (view: ViewMode) => void }) {
  return (
    <div className="grid grid-cols-2 rounded-2xl border border-line bg-surface p-1">
      <button
        type="button"
        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm ${
          view === 'calendar' ? 'bg-accent text-accent-fg' : ''
        }`}
        onClick={() => onView('calendar')}
      >
        <CalendarDays size={16} />
        Calendar
      </button>
      <button
        type="button"
        className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm ${
          view === 'excel' ? 'bg-accent text-accent-fg' : ''
        }`}
        onClick={() => onView('excel')}
      >
        <Table2 size={16} />
        Excel
      </button>
    </div>
  )
}

function AttendanceSheet({
  hr,
  rows,
  sheet,
  filtered,
  punches,
  holidays,
  leaves,
  dates,
  from,
  to,
  onApprove,
}: {
  hr: boolean
  rows: Summary[]
  sheet: SheetRow[]
  filtered: boolean
  punches: Punch[]
  holidays: Holiday[]
  leaves: Leave[]
  dates: string[]
  from: string
  to: string
  onApprove: (userId: string) => void
}) {
  function totals(userId: string) {
    const days = dates.map((date) =>
      dayInfo(
        date,
        punches.filter((p) => p.userId === userId),
        holidays,
        leaves.filter((l) => l.userId === userId),
        from,
        to,
      ),
    )
    return rangeStats(days)
  }

  const groups: Array<{ id: string; name: string; rows: SheetRow[] }> = []
  for (const row of sheet) {
    const current = groups.at(-1)
    if (!current || current.id !== row.userId) groups.push({ id: row.userId, name: row.name, rows: [row] })
    else current.rows.push(row)
  }

  return (
    <div className="space-y-8">
      {hr ? (
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-4 py-3">Person</th>
                <th className="px-4 py-3">Present</th>
                <th className="px-4 py-3">Hours</th>
                <th className="px-4 py-3">Leave</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const stats = filtered ? totals(row.user.id) : null
                return (
                  <tr key={row.user.id} className="border-t border-line">
                    <td className="px-4 py-3">{row.user.name}</td>
                    <td className="px-4 py-3">{stats ? stats.present : `${row.presentDays}/${row.workingDays}`}</td>
                    <td className="px-4 py-3">{stats ? stats.hours : row.hours}</td>
                    <td className="px-4 py-3">{stats ? stats.leave : row.leaveDays}</td>
                    <td className="px-4 py-3">
                      {row.approved ? (
                        <span className="text-good">Approved</span>
                      ) : isInactive(row.user) ? (
                        <span className="text-muted">Inactive</span>
                      ) : (
                        <button type="button" className="text-accent" onClick={() => onApprove(row.user.id)}>
                          Approve
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="text-sm text-muted">One table per person for the selected range.</p>
      {groups.map((group) => {
        const present = group.rows.filter((row) => row.status === 'present' || row.status === 'open').length
        const leave = group.rows.filter((row) => row.status === 'leave').length
        const hours = Math.round(group.rows.reduce((sum, row) => sum + row.hours, 0) * 10) / 10
        return (
          <section key={group.id} className="overflow-hidden rounded-3xl border-2 border-ink/20 bg-surface">
            <div className="bg-ink px-4 py-3 text-bg">
              <h2 className="font-display text-xl">{group.name}</h2>
              <p className="text-sm text-bg/80">
                Present {present} · Leave {leave} · {hours ? `${hours.toFixed(1)}h` : '0h'}
              </p>
            </div>
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
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((row) => (
                    <tr key={`${row.userId}-${row.date}`} className={row.status === 'weekend' || row.status === 'holiday' ? 'text-muted' : ''}>
                      <td className="border border-line px-3 py-2 whitespace-nowrap">{row.date}</td>
                      <td className="border border-line px-3 py-2">{row.day}</td>
                      <td className="border border-line px-3 py-2">{STATUS_LABEL[row.status] || '—'}</td>
                      <td className="border border-line px-3 py-2">{row.in1 || '—'}</td>
                      <td className="border border-line px-3 py-2">{row.out1 || '—'}</td>
                      <td className="border border-line px-3 py-2">{row.in2 || '—'}</td>
                      <td className="border border-line px-3 py-2">{row.out2 || '—'}</td>
                      <td className="border border-line px-3 py-2">{row.hours ? row.hours.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}
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
