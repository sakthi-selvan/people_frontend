import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { Logo } from '../components/Logo'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('hr@people.local')
  const [password, setPassword] = useState('Hr@123')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(email, password)
      navigate('/app')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-svh max-w-md flex-col justify-center px-4 py-10">
      <Logo withWord size={56} />
      <h1 className="mt-10 font-display text-4xl">Sign in</h1>
      <p className="mt-2 text-muted">HR or employee.</p>
      <div className="mt-4 space-y-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
        <p>
          <span className="text-muted">HR</span> · hr@people.local · Hr@123
        </p>
        <p>
          <span className="text-muted">Employee</span> · employee@people.local · Employee@123
        </p>
      </div>
      <form onSubmit={(e) => void onSubmit(e)} className="mt-8 space-y-4">
        <label className="block text-sm">
          Email
          <input
            className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
          />
        </label>
        <label className="block text-sm">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-2xl bg-accent py-3 font-medium text-accent-fg disabled:opacity-60"
        >
          {busy ? 'Signing in…' : 'Continue'}
        </button>
      </form>
      <Link to="/device" className="mt-6 text-center text-sm text-accent">
        This is an attendance device
      </Link>
      <a
        href="/presentation/"
        target="_blank"
        rel="noreferrer"
        className="mt-3 rounded-2xl border border-line bg-surface px-4 py-3 text-center text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
      >
        Explore the People overview <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}
