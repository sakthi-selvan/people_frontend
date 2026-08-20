import { useEffect, useState, type FormEvent } from 'react'
import { api } from '../api'
import type { Device } from '../types'

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [name, setName] = useState('')
  const [location, setLocation] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setDevices(await api<Device[]>('/devices'))
  }

  useEffect(() => {
    void load()
  }, [])

  async function add(e: FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await api('/devices', { method: 'POST', body: { name, location, password } })
      setName('')
      setLocation('')
      setPassword('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add device')
    }
  }

  async function resetPassword(id: string) {
    const next = window.prompt('New device password')
    if (!next) return
    await api(`/devices/${id}`, { method: 'PATCH', body: { password: next } })
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl">Devices</h1>
      <p className="text-muted">Kiosks used for face enrolment and daily punches. Admin sets the device password.</p>
      <form onSubmit={(e) => void add(e)} className="grid gap-3 rounded-3xl border border-line bg-surface p-4 md:grid-cols-2">
        <input className="rounded-2xl border border-line px-4 py-3" placeholder="Device name" value={name} onChange={(e) => setName(e.target.value)} />
        <input className="rounded-2xl border border-line px-4 py-3" placeholder="Location" value={location} onChange={(e) => setLocation(e.target.value)} />
        <input className="rounded-2xl border border-line px-4 py-3 md:col-span-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="text-sm text-danger md:col-span-2">{error}</p> : null}
        <button className="rounded-2xl bg-accent py-3 text-accent-fg md:col-span-2">Add device</button>
      </form>
      <ul className="space-y-2">
        {devices.map((device) => (
          <li key={device.id} className="flex items-center justify-between rounded-2xl border border-line bg-surface px-4 py-3">
            <div>
              <p className="font-medium">{device.name}</p>
              <p className="text-sm text-muted">{device.location || 'No location'}</p>
            </div>
            <button type="button" className="text-sm text-accent" onClick={() => void resetPassword(device.id)}>
              Set password
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
