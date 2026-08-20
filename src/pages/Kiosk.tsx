import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { api } from '../api'
import { FaceCapture } from '../components/FaceCapture'
import { Logo } from '../components/Logo'
import type { User } from '../types'

type Mode = 'choose' | 'new' | 'punch'
type Session = { checkIn?: string | null; checkOut?: string | null }
type PunchResult = {
  user: User
  nextAction: 'check-in' | 'check-out' | 'done'
  lastAction?: 'check-in' | 'check-out'
  session?: number
  shiftHours?: number
  today: {
    checkIn: string | null
    checkOut: string | null
    hours?: number
    sessions?: Session[]
    date: string
  } | null
}

function clock(value?: string | null) {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function KioskPage() {
  const { device, logout } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('choose')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [result, setResult] = useState<PunchResult | null>(null)

  async function enroll(descriptor: number[], photo: string) {
    setError('')
    if (!name.trim() || !email.trim() || !password) {
      setError('Name, work email and password must match the People record.')
      return
    }
    try {
      const data = await api<PunchResult>('/kiosk/enroll', {
        method: 'POST',
        body: { name: name.trim(), email: email.trim(), password, descriptor, photo },
      })
      setResult(data)
      setMessage(`${data.user.name} enrolled. You can check in now.`)
      setMode('punch')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Enrolment failed')
    }
  }

  async function punch(descriptor: number[], photo: string) {
    setError('')
    try {
      const identified = await api<{ match: boolean; user?: User; nextAction?: PunchResult['nextAction']; today?: PunchResult['today'] }>(
        '/kiosk/identify',
        { method: 'POST', body: { descriptor } },
      )
      if (!identified.match) {
        setError('Face not recognised. Use New user to enrol.')
        setResult(null)
        return
      }
      const data = await api<PunchResult>('/kiosk/punch', { method: 'POST', body: { descriptor, photo } })
      setResult(data)
      const hours = data.today?.hours ?? 0
      const half = data.session || 1
      if (data.lastAction === 'check-in') {
        setMessage(half === 2 ? `Second half started · ${data.user.name}` : `Checked in · ${data.user.name}`)
      } else if (data.nextAction === 'done') {
        setMessage(`Day complete · ${data.user.name} · ${hours}h`)
      } else {
        setMessage(`Checked out · ${data.user.name}. Scan again later for a second half, or stop here. ${hours}h of 9h`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Punch failed')
    }
  }

  return (
    <div className="mx-auto min-h-svh max-w-lg px-4 py-6">
      <div className="flex items-center justify-between">
        <Logo withWord size={44} />
        <button
          type="button"
          className="text-sm text-muted"
          onClick={() => {
            logout()
            navigate('/device')
          }}
        >
          Lock
        </button>
      </div>
      <p className="mt-4 text-sm text-muted">
        {device?.name}
        {device?.location ? ` · ${device.location}` : ''}
      </p>
      <h1 className="mt-2 font-display text-3xl">Attendance</h1>
      <p className="mt-1 text-sm text-muted">9-hour day. One stretch, or two halves with two check-ins and check-outs.</p>

      {mode === 'choose' ? (
        <div className="mt-8 grid gap-3">
          <button
            type="button"
            onClick={() => {
              setMode('new')
              setError('')
              setMessage('')
            }}
            className="rounded-3xl bg-surface px-5 py-8 text-left shadow-[inset_0_0_0_1px_var(--line)]"
          >
            <p className="font-display text-2xl">New user</p>
            <p className="mt-1 text-sm text-muted">Enrol a face for someone already in People, after the appointment letter.</p>
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('punch')
              setError('')
              setMessage('')
            }}
            className="rounded-3xl bg-accent px-5 py-8 text-left text-accent-fg"
          >
            <p className="font-display text-2xl">Check in / Check out</p>
            <p className="mt-1 text-sm opacity-80">One stretch or two halves.</p>
          </button>
        </div>
      ) : null}

      {mode === 'new' ? (
        <div className="mt-6 space-y-4">
          <button type="button" className="text-sm text-accent" onClick={() => setMode('choose')}>
            Back
          </button>
          <p className="text-sm text-muted">
            Name, work email and password must match the People record exactly. Enrolment is allowed only after the
            appointment letter.
          </p>
          <input
            placeholder="Full name"
            autoComplete="name"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            placeholder="Work email"
            autoComplete="username"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            placeholder="Login password"
            type="password"
            autoComplete="current-password"
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <FaceCapture onCapture={(d, photo) => void enroll(d, photo)} label="Enrol face" />
        </div>
      ) : null}

      {mode === 'punch' ? (
        <div className="mt-6 space-y-4">
          <button type="button" className="text-sm text-accent" onClick={() => setMode('choose')}>
            Back
          </button>
          <FaceCapture onCapture={(d, photo) => void punch(d, photo)} label="Scan face to punch" />
          {result ? (
            <div className="rounded-3xl border border-line bg-surface p-4">
              <p className="font-medium">{result.user.name}</p>
              <p className="text-sm text-muted">{result.user.code}</p>
              <p className="mt-2 text-sm">
                {result.nextAction === 'done'
                  ? 'Day complete'
                  : result.nextAction === 'check-out'
                    ? `Check out · half ${result.session || 1}`
                    : `Next: check in · half ${result.session || 1}`}
              </p>
              <p className="mt-1 text-sm text-muted">
                {(result.today?.hours ?? 0).toFixed(1)}h of {result.shiftHours || 9}h
              </p>
              {(result.today?.sessions || []).map((session, index) => (
                <p key={`${session.checkIn || index}`} className="mt-1 text-sm text-muted">
                  Half {index + 1}: {clock(session.checkIn)} – {clock(session.checkOut)}
                </p>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? <p className="mt-4 text-sm text-good">{message}</p> : null}
      {error ? <p className="mt-4 text-sm text-danger">{error}</p> : null}
    </div>
  )
}
