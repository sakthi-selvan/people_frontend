import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { isHr } from '../types'

type Leave = {
  id: string
  userId: string
  from: string
  to: string
  reason?: string
  status: string
  user?: { id: string; name: string } | null
}

function leaveLabel(status: string) {
  if (status === 'approved') return 'Approved · paid, no loss of pay'
  if (status === 'rejected') return 'Rejected'
  return 'Waiting for HR'
}

export function LeavePage() {
  const { role, user } = useAuth()
  const hr = isHr(role)
  const [leaves, setLeaves] = useState<Leave[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLeaves(await api<Leave[]>('/leaves'))
  }

  useEffect(() => {
    void load()
  }, [])

  async function requestLeave(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api('/leaves', { method: 'POST', body: { from, to, reason, type: 'paid' } })
      setFrom('')
      setTo('')
      setReason('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Leave failed')
    }
  }

  async function reviewLeave(id: string, status: 'approved' | 'rejected') {
    setError('')
    try {
      await api(`/leaves/${id}`, { method: 'PATCH', body: { status } })
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update leave')
    }
  }

  const mine = leaves.filter((leave) => leave.userId === user?.id)

  if (!hr) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-3xl">Leave</h1>
          <p className="text-muted">If HR approves, those days stay paid. No salary cut.</p>
        </div>
        <form onSubmit={(e) => void requestLeave(e)} className="grid gap-2 rounded-3xl border border-line bg-surface p-4 sm:grid-cols-2">
          <label className="text-sm">
            From
            <input className="mt-1 w-full rounded-2xl border border-line px-3 py-2" type="date" value={from} onChange={(e) => setFrom(e.target.value)} required />
          </label>
          <label className="text-sm">
            To
            <input className="mt-1 w-full rounded-2xl border border-line px-3 py-2" type="date" value={to} onChange={(e) => setTo(e.target.value)} required />
          </label>
          <input
            className="rounded-2xl border border-line px-3 py-2 sm:col-span-2"
            placeholder="Reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
          <button className="rounded-2xl bg-ink px-3 py-2 text-bg sm:col-span-2">Send request</button>
          {error ? <p className="text-sm text-danger sm:col-span-2">{error}</p> : null}
        </form>
        <ul className="space-y-2">
          {mine.length === 0 ? <li className="text-sm text-muted">No leave requests yet.</li> : null}
          {mine.map((leave) => (
            <li key={leave.id} className="rounded-3xl border border-line bg-surface px-4 py-3">
              <p className="font-medium">
                {leave.from} → {leave.to}
              </p>
              {leave.reason ? <p className="text-sm text-muted">{leave.reason}</p> : null}
              <p className="mt-1 text-xs text-muted">{leaveLabel(leave.status)}</p>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl">Leave</h1>
        <p className="text-muted">Approve to keep full pay for those days. Reject and the day is unpaid if they were absent.</p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {leaves.filter((leave) => leave.status === 'pending').length === 0 ? (
        <p className="text-sm text-muted">No pending requests.</p>
      ) : null}
      <ul className="space-y-2">
        {leaves.map((leave) => (
          <li key={leave.id} className="flex flex-col gap-2 rounded-3xl border border-line bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">{leave.user?.name || 'Employee'}</p>
              <p className="text-sm text-muted">
                {leave.from} → {leave.to}
                {leave.reason ? ` · ${leave.reason}` : ''}
              </p>
              <p className="text-xs text-muted">{leaveLabel(leave.status)}</p>
            </div>
            {leave.status === 'pending' ? (
              <div className="flex gap-2">
                <button type="button" className="rounded-2xl bg-accent px-3 py-2 text-sm text-accent-fg" onClick={() => void reviewLeave(leave.id, 'approved')}>
                  Approve
                </button>
                <button type="button" className="rounded-2xl border border-line px-3 py-2 text-sm" onClick={() => void reviewLeave(leave.id, 'rejected')}>
                  Reject
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  )
}
