import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { isHr, personStageLabel, type User } from '../types'

export function PeoplePage() {
  const { role, user } = useAuth()
  const navigate = useNavigate()
  const [people, setPeople] = useState<User[]>([])
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'employee',
    department: '',
    password: '',
    baseSalary: '45000',
  })

  async function load() {
    if (!isHr(role) && user) {
      setPeople([await api<User>(`/users/${user.id}`)])
      return
    }
    setPeople(await api<User[]>('/users'))
  }

  useEffect(() => {
    void load()
  }, [role, user?.id])

  async function create(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      const created = await api<User>('/users', {
        method: 'POST',
        body: {
          ...form,
          baseSalary: Number(form.baseSalary || 0),
        },
      })
      setOpen(false)
      setForm({ name: '', email: '', role: 'employee', department: '', password: '', baseSalary: '45000' })
      await load()
      if (created.role === 'employee') navigate(`/app/people/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add person')
    }
  }

  const canAdd = isHr(role)

  if (role === 'employee' && user) return <Navigate to={`/app/people/${user.id}`} replace />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-3xl">People</h1>
        {canAdd ? (
          <button type="button" className="rounded-2xl bg-accent px-4 py-2 text-sm text-accent-fg" onClick={() => setOpen((v) => !v)}>
            Add person
          </button>
        ) : null}
      </div>

      {open ? (
        <form onSubmit={(e) => void create(e)} className="grid gap-3 rounded-3xl border border-line bg-surface p-4 md:grid-cols-2">
          <input className="rounded-2xl border border-line px-4 py-3" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <input className="rounded-2xl border border-line px-4 py-3" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="rounded-2xl border border-line px-4 py-3" placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <input className="rounded-2xl border border-line px-4 py-3" placeholder="Password (optional)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <select className="rounded-2xl border border-line px-4 py-3" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
            <option value="employee">Employee</option>
            <option value="hr">HR</option>
          </select>
          <input className="rounded-2xl border border-line px-4 py-3" placeholder="Base salary" value={form.baseSalary} onChange={(e) => setForm({ ...form, baseSalary: e.target.value })} />
          {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
          <button type="submit" className="rounded-2xl bg-ink px-4 py-3 text-bg md:col-span-2">
            Save and review
          </button>
        </form>
      ) : null}

      <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-surface">
        {people.map((person) => (
          <li key={person.id} className="flex items-center gap-3 px-4 py-4">
            <Link to={`/app/people/${person.id}`} className="min-w-0 flex-1">
              <p className="font-medium">{person.name}</p>
              <p className="text-sm text-muted">
                {person.code} · {person.role} · {personStageLabel(person)}
                {person.hasFace ? ' · face' : ''}
              </p>
            </Link>
            {canAdd ? (
              <div className="flex shrink-0 flex-col items-end gap-1 text-sm">
                <Link to={`/app/attendance?person=${person.id}`} className="text-accent">
                  View attendance
                </Link>
                <Link to={`/app/payroll?person=${person.id}`} className="text-accent">
                  View payroll
                </Link>
              </div>
            ) : null}
            <span className="shrink-0 text-xs capitalize text-muted">
              {person.status === 'exited' ? 'inactive' : person.status}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
