import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { HrStep, User } from '../types'

type Approval = {
  user: User
  step: HrStep
  waitingOn: 'hr' | 'employee'
  documents: Array<{ id: string; name: string; kind: string; createdAt?: string; notes?: string }>
  kind?: 'resignation' | 'documents' | 'workflow'
  priority?: number
  note?: string
  requestedAt?: string | null
}

type LeaveRow = {
  id: string
  from: string
  to: string
  reason?: string
  status: string
  user?: { id: string; name: string } | null
}

function isResignation(item: Approval) {
  return item.kind === 'resignation' || item.step.id >= 13
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
  const resignations = mine.filter(isResignation)
  const otherMine = mine.filter((item) => !isResignation(item))

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl">Approvals</h1>
        <p className="text-muted">Resignation requests stay at the top. Open a person to preview, then approve.</p>
      </div>
      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Needs your review</h2>
        {mine.length === 0 && leaves.length === 0 ? (
          <p className="text-sm text-muted">Nothing waiting on HR.</p>
        ) : null}
        {resignations.map((item) => (
          <ApprovalCard key={`${item.user.id}-${item.step.id}-${item.kind || 'step'}`} item={item} priority />
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
        {otherMine.map((item) => (
          <ApprovalCard key={`${item.user.id}-${item.step.id}-${item.kind || 'step'}`} item={item} />
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-2xl">Waiting on employee</h2>
        {waiting.length === 0 ? <p className="text-sm text-muted">No employee actions pending.</p> : null}
        {waiting.map((item) => (
          <ApprovalCard key={`${item.user.id}-${item.step.id}-${item.kind || 'wait'}`} item={item} waiting />
        ))}
      </section>
    </div>
  )
}

function ApprovalCard({ item, priority, waiting }: { item: Approval; priority?: boolean; waiting?: boolean }) {
  const resignation = isResignation(item)
  return (
    <Link
      to={`/app/people/${item.user.id}`}
      className={`block rounded-3xl border px-4 py-4 ${
        priority || resignation ? 'border-accent bg-surface' : 'border-line bg-surface'
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-muted">
        {resignation ? 'Priority · Resignation' : item.kind === 'documents' ? 'Documents' : `Stage ${item.step.id}`} ·{' '}
        {item.user.code}
      </p>
      <p className="mt-1 font-display text-2xl">{item.user.name}</p>
      <p className="mt-1 text-sm">{item.step.label}</p>
      {item.note ? <p className="mt-2 whitespace-pre-wrap text-sm text-muted">{item.note}</p> : null}
      {item.documents.length ? (
        <ul className="mt-2 space-y-1 text-sm text-muted">
          {item.documents.slice(0, 6).map((doc) => (
            <li key={doc.id}>
              {doc.name} · {doc.kind}
              {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleDateString()}` : ''}
            </li>
          ))}
          {item.documents.length > 6 ? <li>+{item.documents.length - 6} more on file</li> : null}
        </ul>
      ) : item.step.id === 4 ? (
        <p className="mt-1 text-sm text-muted">No documents listed</p>
      ) : null}
      <p className="mt-2 text-sm text-accent">{waiting ? 'Open preview' : 'Preview and review'}</p>
    </Link>
  )
}
