import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { useTheme } from '../theme'
import { EmailStatus } from '../components/EmailStatus'
import { AccountPanel } from './Profile'
import { isHr, THEMES } from '../types'

type Template = { subject: string; body: string }
type TemplateKey = { key: string; label: string; step: number }

export function SettingsPage() {
  const { theme, setTheme } = useTheme()
  const { role, user, logout } = useAuth()
  const navigate = useNavigate()
  const [to, setTo] = useState(user?.email || '')
  const [company, setCompany] = useState('People')
  const [templates, setTemplates] = useState<Record<string, Template>>({})
  const [keys, setKeys] = useState<TemplateKey[]>([])
  const [active, setActive] = useState('offer_letter')
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')

  useEffect(() => {
    if (isHr(role)) {
      void api<{
        companyName: string
        templates: Record<string, Template>
        templateKeys: TemplateKey[]
      }>('/settings').then((s) => {
        setCompany(s.companyName)
        setTemplates(s.templates)
        setKeys(s.templateKeys)
        setActive(s.templateKeys[0]?.key || 'offer_letter')
      })
    }
  }, [role])

  const current = templates[active] || { subject: '', body: '' }

  async function testEmail() {
    setError('')
    setEmailState('sending')
    try {
      const result = await api<{ previewUrl?: string }>('/settings/email-test', { method: 'POST', body: { to } })
      setPreviewUrl(result.previewUrl || '')
      setEmailState('sent')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Email failed')
      setEmailState('error')
    }
  }

  async function saveCompany() {
    await api('/settings', { method: 'PATCH', body: { companyName: company } })
    setSaved('Company name saved')
  }

  async function saveTemplate() {
    setSaved('')
    await api('/settings', { method: 'PATCH', body: { templates: { [active]: current } } })
    setSaved('Template saved. Later emails use this format.')
  }

  return (
    <div className="space-y-8">
      {isHr(role) ? (
        <EmailStatus
          state={emailState}
          label="test email"
          previewUrl={previewUrl}
          error={error}
          onClose={() => setEmailState('idle')}
        />
      ) : null}
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="mt-1 text-muted">
          {user?.name} · {isHr(role) ? 'HR' : 'Employee'}
        </p>
      </div>

      <AccountPanel />

      <section>
        <h2 className="font-display text-2xl">{isHr(role) ? 'Theme' : 'Appearance'}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTheme(item.id)}
              className={`rounded-3xl border px-4 py-5 text-left ${
                theme === item.id ? 'border-accent bg-surface' : 'border-line bg-surface'
              }`}
            >
              <p className="font-medium">{item.name}</p>
              <p className="mt-1 text-sm text-muted">{item.note}</p>
            </button>
          ))}
        </div>
      </section>

      {isHr(role) ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Letter and email formats</h2>
          <p className="text-sm text-muted">
            Placeholders: {'{{name}} {{code}} {{department}} {{joiningDate}} {{baseSalary}} {{company}} {{today}} {{month}} {{gross}} {{net}}'}
          </p>
          <div className="flex flex-wrap gap-2">
            {keys.map((item) => (
              <span key={item.key}>
                <button
                  type="button"
                  className={`rounded-2xl px-3 py-2 text-sm ${active === item.key ? 'bg-accent text-accent-fg' : 'border border-line'}`}
                  onClick={() => setActive(item.key)}
                >
                  {item.label}
                </button>
              </span>
            ))}
          </div>
          <input
            className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={current.subject}
            onChange={(e) => setTemplates({ ...templates, [active]: { ...current, subject: e.target.value } })}
          />
          <textarea
            className="min-h-64 w-full rounded-2xl border border-line bg-surface px-4 py-3"
            value={current.body}
            onChange={(e) => setTemplates({ ...templates, [active]: { ...current, body: e.target.value } })}
          />
          <button type="button" className="rounded-2xl bg-ink px-4 py-3 text-bg" onClick={() => void saveTemplate()}>
            Save format
          </button>
          {saved ? <p className="text-sm text-good">{saved}</p> : null}
        </section>
      ) : null}

      {isHr(role) ? (
        <section className="space-y-3">
          <h2 className="font-display text-2xl">Email (MVP test)</h2>
          <input className="w-full rounded-2xl border border-line bg-surface px-4 py-3" value={company} onChange={(e) => setCompany(e.target.value)} />
          <button type="button" className="rounded-2xl border border-line px-4 py-2 text-sm" onClick={() => void saveCompany()}>
            Save company name
          </button>
          <input className="w-full rounded-2xl border border-line bg-surface px-4 py-3" value={to} onChange={(e) => setTo(e.target.value)} placeholder="Send test to" />
          <button type="button" className="rounded-2xl bg-accent px-4 py-3 text-accent-fg" onClick={() => void testEmail()}>
            Send test email
          </button>
        </section>
      ) : null}

      <section className="rounded-3xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Account</h2>
        <p className="mt-1 text-sm text-muted">Sign out on this device.</p>
        <button
          type="button"
          className="mt-4 w-full rounded-2xl border border-line py-3 text-danger"
          onClick={() => {
            logout()
            navigate('/login')
          }}
        >
          Sign out
        </button>
      </section>
    </div>
  )
}
