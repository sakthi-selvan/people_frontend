import { useEffect, useState, type FormEvent } from 'react'
import { ChevronDown } from 'lucide-react'
import { Link, Navigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { isHr } from '../types'

export function ProfilePage() {
  return <Navigate to="/app/settings" replace />
}

export function AccountPanel() {
  const { user, refresh } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileError, setProfileError] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passMsg, setPassMsg] = useState('')
  const [passError, setPassError] = useState('')
  const [busy, setBusy] = useState(false)
  const [openProfile, setOpenProfile] = useState(false)
  const [openPassword, setOpenPassword] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone || '')
  }, [user])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setProfileError('')
    setProfileMsg('')
    setBusy(true)
    try {
      await api(`/users/${user.id}`, { method: 'PATCH', body: { name, email, phone } })
      await refresh()
      setProfileMsg('Profile saved')
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  async function changePassword(e: FormEvent) {
    e.preventDefault()
    setPassError('')
    setPassMsg('')
    if (newPassword !== confirmPassword) {
      setPassError('New passwords do not match')
      return
    }
    setBusy(true)
    try {
      await api('/auth/password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPassMsg('Password changed')
    } catch (err) {
      setPassError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setBusy(false)
    }
  }

  if (!user) return <p className="text-muted">Loading…</p>

  return (
    <div className="space-y-6">
      {!isHr(user.role) && user.hrStep < 7 ? (
        <Link to={`/app/people/${user.id}`} className="block rounded-3xl border border-accent bg-surface px-4 py-5">
          <p className="text-xs uppercase tracking-wide text-muted">Joining</p>
          <p className="mt-1 font-display text-2xl">Continue joining</p>
          <p className="mt-1 text-sm text-muted">Offer, documents, and face enrolment.</p>
        </Link>
      ) : null}

      <div className="rounded-3xl border border-line bg-surface">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
          onClick={() => setOpenProfile((v) => !v)}
          aria-expanded={openProfile}
        >
          <span>
            <h2 className="font-display text-2xl">Profile</h2>
            <p className="mt-1 text-sm text-muted">
              {user.code} · {user.name}
            </p>
          </span>
          <ChevronDown size={20} className={`shrink-0 text-muted transition ${openProfile ? 'rotate-180' : ''}`} />
        </button>
        {openProfile ? (
          <form onSubmit={(e) => void saveProfile(e)} className="space-y-3 border-t border-line p-4">
            <label className="block text-sm">
              Name
              <input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="block text-sm">
              Email
              <input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm">
              Phone
              <input className="mt-1 w-full rounded-2xl border border-line px-4 py-3" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </label>
            {profileError ? <p className="text-sm text-danger">{profileError}</p> : null}
            {profileMsg ? <p className="text-sm text-good">{profileMsg}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-2xl bg-accent py-3 text-accent-fg disabled:opacity-60">
              Save profile
            </button>
          </form>
        ) : null}
      </div>

      <div className="rounded-3xl border border-line bg-surface">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
          onClick={() => setOpenPassword((v) => !v)}
          aria-expanded={openPassword}
        >
          <span>
            <h2 className="font-display text-2xl">Password</h2>
            <p className="mt-1 text-sm text-muted">Change sign-in password</p>
          </span>
          <ChevronDown size={20} className={`shrink-0 text-muted transition ${openPassword ? 'rotate-180' : ''}`} />
        </button>
        {openPassword ? (
          <form onSubmit={(e) => void changePassword(e)} className="space-y-3 border-t border-line p-4">
            <label className="block text-sm">
              Current password
              <input type="password" className="mt-1 w-full rounded-2xl border border-line px-4 py-3" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </label>
            <label className="block text-sm">
              New password
              <input type="password" className="mt-1 w-full rounded-2xl border border-line px-4 py-3" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </label>
            <label className="block text-sm">
              Confirm new password
              <input type="password" className="mt-1 w-full rounded-2xl border border-line px-4 py-3" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </label>
            {passError ? <p className="text-sm text-danger">{passError}</p> : null}
            {passMsg ? <p className="text-sm text-good">{passMsg}</p> : null}
            <button type="submit" disabled={busy} className="w-full rounded-2xl bg-ink py-3 text-bg disabled:opacity-60">
              Update password
            </button>
          </form>
        ) : null}
      </div>
    </div>
  )
}
