import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { HrStep, User } from '../types'

type Approval = {
  user: User
  step: HrStep
  waitingOn: 'hr' | 'employee'
  documents: Array<{ id: string; name: string; kind: string }>
}

type LeaveRow = {
  id: string
  from: string
  to: string
  reason?: string
  status: string
  user?: { id: string; name: string } | null
}

export function ApprovalsPage() {
  const [items, setItems] = useState<Approval[]>([])
  const [leaves, setLeaves] = useState<LeaveRow[]>([])
  const [error, setError] = useState('')

  useEffect(() => {
    void api<Approval[]>('/approvals')
      .then(setItems)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load approvals'))
    void api<LeaveRow[]>('/leaves')
      .then((rows) => setLeaves(rows.filter((row) => row.status === 'pending')))
      .catch(() => setLeaves([]))
  }, [])

  const mine = items.filter((item) => item.waitingOn === 'hr')
  const waiting = items.filter((item) => item.waitingOn === 'employee')

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Approvals</h1>
        <p className="text-muted">Open a person to review, then approve so they can move to the next stage.</p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Needs your review</h2>
        {mine.length === 0 && leaves.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting on HR.</p>
        ) : null}
        {mine.map((item) => (
          <Link
            key={`${item.user.id}-${item.step.id}`}
            to={`/app/people/${item.user.id}`}
            className="block rounded-3xl border border-line bg-surface px-4 py-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted">
              Stage {item.step.id} · {item.user.code}
            </p>
            <p className="mt-1 font-display text-2xl">{item.user.name}</p>
            <p className="mt-1 text-sm">{item.step.label}</p>
            {item.step.id === 4 ? (
              <p className="mt-1 text-sm text-muted">
                {item.documents.length ? `${item.documents.length} document(s) to check` : 'No documents listed'}
              </p>
            ) : null}
            <p className="mt-2 text-sm text-accent">Review and approve</p>
          </Link>
        ))}
        {leaves.map((leave) => (
          <Link key={leave.id} to="/app/leave" className="block rounded-3xl border border-line bg-surface px-4 py-4">
            <p className="text-xs uppercase tracking-wide text-muted">Leave</p>
            <p className="mt-1 font-display text-2xl">{leave.user?.name || 'Employee'}</p>
            <p className="mt-1 text-sm">
              {leave.from} → {leave.to}
              {leave.reason ? ` · ${leave.reason}` : ''}
            </p>
            <p className="mt-2 text-sm text-accent">Review leave</p>
          </Link>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Waiting on employee</h2>
        {waiting.length === 0 ? <p className="text-sm text-muted">No employee actions pending.</p> : null}
        {waiting.map((item) => (
          <Link
            key={`${item.user.id}-${item.step.id}`}
            to={`/app/people/${item.user.id}`}
            className="block rounded-3xl border border-line bg-surface px-4 py-4"
          >
            <p className="text-xs uppercase tracking-wide text-muted">
              Stage {item.step.id} · {item.user.code}
            </p>
            <p className="mt-1 font-medium">{item.user.name}</p>
            <p className="text-sm text-muted">{item.step.label}</p>
          </Link>
        ))}
      </section>
    </div>
  )
}
