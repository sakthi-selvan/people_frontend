import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
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

  function clearAlert() {
    setError('')
    setMessage('')
  }

  async function enroll(descriptor: number[], photo: string) {
    setError('')
    setMessage('')
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
    setMessage('')
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
    <div className="relative mx-auto flex h-svh max-w-lg flex-col overflow-hidden px-4 py-3">
      <div className="flex shrink-0 items-center justify-between">
        <Logo withWord size={36} />
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
      <p className="mt-2 shrink-0 text-sm text-muted">
        {device?.name}
        {device?.location ? ` · ${device.location}` : ''}
      </p>
      <h1 className="mt-1 shrink-0 font-display text-2xl">Attendance</h1>

      <div className="mt-3 min-h-0 flex-1 overflow-hidden">
        {mode === 'choose' ? (
          <div className="grid h-full content-center gap-3">
            <button
              type="button"
              onClick={() => {
                setMode('new')
                clearAlert()
              }}
              className="rounded-3xl bg-surface px-5 py-7 text-left shadow-[inset_0_0_0_1px_var(--line)]"
            >
              <p className="font-display text-2xl">New user</p>
              <p className="mt-1 text-sm text-muted">Enrol a face for someone already in People, after the appointment letter.</p>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('punch')
                clearAlert()
              }}
              className="rounded-3xl bg-accent px-5 py-7 text-left text-accent-fg"
            >
              <p className="font-display text-2xl">Check in / Check out</p>
              <p className="mt-1 text-sm opacity-80">One stretch or two halves.</p>
            </button>
          </div>
        ) : null}

        {mode === 'new' ? (
          <div className="flex h-full flex-col gap-2 overflow-hidden">
            <button type="button" className="shrink-0 self-start text-sm text-accent" onClick={() => setMode('choose')}>
              Back
            </button>
            <input
              placeholder="Full name"
              autoComplete="name"
              className="w-full shrink-0 rounded-2xl border border-line bg-surface px-4 py-2.5"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              placeholder="Work email"
              autoComplete="username"
              className="w-full shrink-0 rounded-2xl border border-line bg-surface px-4 py-2.5"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              placeholder="Login password"
              type="password"
              autoComplete="current-password"
              className="w-full shrink-0 rounded-2xl border border-line bg-surface px-4 py-2.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div className="min-h-0 flex-1 overflow-hidden">
              <FaceCapture
                compact
                onCapture={(d, photo) => void enroll(d, photo)}
                onError={setError}
                label="Enrol face"
                scanKey={email}
              />
            </div>
          </div>
        ) : null}

        {mode === 'punch' ? (
          <div className="flex h-full flex-col gap-2 overflow-hidden">
            <button type="button" className="shrink-0 self-start text-sm text-accent" onClick={() => setMode('choose')}>
              Back
            </button>
            <FaceCapture
              compact
              onCapture={(d, photo) => void punch(d, photo)}
              onError={setError}
              label="Scan face to punch"
            />
            {result ? (
              <div className="shrink-0 rounded-3xl border border-line bg-surface p-3">
                <p className="font-medium">{result.user.name}</p>
                <p className="text-sm text-muted">
                  {result.user.code} · {(result.today?.hours ?? 0).toFixed(1)}h of {result.shiftHours || 9}h
                </p>
                <p className="mt-1 text-sm">
                  {result.nextAction === 'done'
                    ? 'Day complete'
                    : result.nextAction === 'check-out'
                      ? `Check out · half ${result.session || 1}`
                      : `Next: check in · half ${result.session || 1}`}
                </p>
                {(result.today?.sessions || []).map((session, index) => (
                  <p key={`${session.checkIn || index}`} className="text-sm text-muted">
                    Half {index + 1}: {clock(session.checkIn)} – {clock(session.checkOut)}
                  </p>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {error || message ? (
        <div className="absolute inset-0 z-20 grid place-items-center bg-bg/80 p-5">
          <div
            role="alert"
            className={`w-full max-w-sm rounded-3xl border bg-surface px-5 py-6 text-center shadow-lg ${
              error ? 'border-danger' : 'border-good'
            }`}
          >
            {error ? (
              <TriangleAlert className="mx-auto text-danger" size={44} strokeWidth={1.75} />
            ) : (
              <CheckCircle2 className="mx-auto text-good" size={44} strokeWidth={1.75} />
            )}
            <p className={`mt-3 font-display text-xl ${error ? 'text-danger' : 'text-ink'}`}>
              {error ? 'Attention' : 'Done'}
            </p>
            <p className="mt-2 text-sm text-muted">{error || message}</p>
            <button
              type="button"
              className="mt-5 w-full rounded-2xl bg-accent px-4 py-3 font-medium text-accent-fg"
              onClick={clearAlert}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
