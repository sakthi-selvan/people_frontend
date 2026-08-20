import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'

export function DeviceLoginPage() {
  const { loginDevice } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('Lobby Kiosk')
  const [password, setPassword] = useState('Device@123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await loginDevice(name, password)
      navigate('/kiosk')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Device sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-10">
      <Logo withWord size={56} />
      <h1 className="mt-10 font-display text-4xl">Device</h1>
      <p className="mt-2 text-muted">Use the name and password set by HR. Attendance only.</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        <label className="block text-sm">
          Device name
          <input
            className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Device password
          <input
            type="password"
            className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-accent py-3 font-medium text-accent-fg disabled:opacity-60"
        >
          {busy ? 'Opening…' : 'Open kiosk'}
        </button>
      </form>
      <Link to="/login" className="mt-6 text-center text-sm text-accent">
        Staff sign in
      </Link>
    </div>
  )
}
