import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { FaceCapture } from './FaceCapture'
import { EmailStatus } from './EmailStatus'
import { isHr, type HrStep, type User } from '../types'

type Letter = { id: string; step: number; title: string; subject?: string; body?: string }
type Doc = { id: string; name: string; kind: string; notes?: string }
type Journey = {
  user: User
  steps: HrStep[]
  letters: Letter[]
  documents: Doc[]
  nextStep: number | null
  facePending: boolean
  canRequestResignation?: boolean
  waitingOn?: 'hr' | 'employee' | null
}

const JOINING = [1, 2, 3, 4, 5, 6, 7]

export function JoiningStage({ userId }: { userId: string }) {
  const { role, refresh } = useAuth()
  const hr = isHr(role)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [note, setNote] = useState('')
  const [docName, setDocName] = useState('')
  const [docKind, setDocKind] = useState('id')
  const [error, setError] = useState('')
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailMeta, setEmailMeta] = useState({ label: 'message', previewUrl: '', error: '' })

  async function load() {
    const data = await api<Journey>(`/users/${userId}/journey`)
    setJourney(data)
  }

  useEffect(() => {
    void load()
  }, [userId])

  const person = journey?.user
  const next = journey?.nextStep
  const step = journey?.steps.find((s) => s.id === next)
  const yours = !hr && (next === 2 || next === 3 || Boolean(journey?.canRequestResignation))
  const waiting = next && !yours && !hr
  const letter = typeof next === 'number' ? journey?.letters.find((l) => l.step === next) : undefined

  async function run(skip = false) {
    setError('')
    try {
      const result = await api<{ email?: { previewUrl?: string }; journey: Journey }>(`/users/${userId}/workflow`, {
        method: 'POST',
        body: { skip, note },
      })
      setNote('')
      setJourney(result.journey)
      await refresh()
      if (result.email) {
        setEmailMeta({ label: step?.label.toLowerCase() || 'message', previewUrl: result.email.previewUrl || '', error: '' })
        setEmailState('sent')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not continue')
    }
  }

  async function addDocument() {
    if (!docName.trim()) return
    setError('')
    try {
      await api(`/users/${userId}/documents`, { method: 'POST', body: { name: docName, kind: docKind, notes: note } })
      setDocName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add document')
    }
  }

  async function saveFace(descriptor: number[], photo: string) {
    setError('')
    try {
      await api(`/users/${userId}/face`, { method: 'POST', body: { descriptor, photo } })
      await refresh()
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Face enrolment failed')
    }
  }

  if (!person || !journey) return <p className="text-muted">Loading…</p>

  const stageLabel = journey.facePending
    ? 'Face enrolment'
    : journey.canRequestResignation
      ? 'Confirmed'
      : step?.label || 'Joining complete'

  return (
    <div className="space-y-6">
      <EmailStatus
        state={emailState}
        label={emailMeta.label}
        previewUrl={emailMeta.previewUrl}
        error={emailMeta.error}
        onClose={() => setEmailState('idle')}
      />
      <div>
        <p className="text-sm text-muted">Your joining</p>
        <h1 className="font-display text-3xl">{person.name}</h1>
        <p className="text-muted">Finish each stage. HR reviews and then you move to the next one.</p>
      </div>

      <ol className="grid grid-cols-7 gap-1">
        {JOINING.map((id) => {
          const done = person.hrStep >= id
          const current = next === id
          return (
            <li
              key={id}
              className={`rounded-2xl px-1 py-2 text-center text-[10px] sm:text-xs ${
                current ? 'bg-accent text-accent-fg' : done ? 'bg-good/15 text-ink' : 'bg-surface text-muted'
              }`}
            >
              {id}
            </li>
          )
        })}
      </ol>

      <section className="rounded-3xl border border-accent bg-surface p-5">
        <p className="text-xs uppercase tracking-wide text-muted">Current stage</p>
        <h2 className="mt-1 font-display text-2xl">{stageLabel}</h2>
        {waiting ? (
          <p className="mt-2 text-sm text-muted">Waiting for HR to review and approve. You will move to the next stage after that.</p>
        ) : null}
        {next === 1 ? <p className="mt-2 text-sm text-muted">HR is sending your offer letter.</p> : null}
        {next === 2 ? <p className="mt-2 text-sm text-muted">Read the offer and accept it to continue.</p> : null}
        {next === 3 ? <p className="mt-2 text-sm text-muted">Add your documents, then send them to HR for approval.</p> : null}
        {next === 4 ? <p className="mt-2 text-sm text-muted">HR is checking the documents you uploaded.</p> : null}
        {next === 5 ? <p className="mt-2 text-sm text-muted">HR is approving your joining.</p> : null}
        {next === 6 ? <p className="mt-2 text-sm text-muted">HR is sending your appointment letter.</p> : null}
        {next === 7 ? <p className="mt-2 text-sm text-muted">HR is completing onboarding.</p> : null}
        {journey.facePending ? (
          <p className="mt-2 text-sm text-muted">Enrol your face here or at the kiosk so attendance can start.</p>
        ) : null}
        {!next && !journey.facePending && !journey.canRequestResignation ? (
          <p className="mt-2 text-sm text-muted">Joining is complete. Attendance is open.</p>
        ) : null}
      </section>

      {letter && next === 6 ? (
        <article className="rounded-3xl border border-line bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">{letter.subject || letter.title}</p>
          <pre className="mt-3 whitespace-pre-wrap font-display text-[15px] leading-7">{letter.body}</pre>
        </article>
      ) : null}
      {next === 2 ? (
        <article className="rounded-3xl border border-line bg-surface p-5">
          {journey.letters.find((l) => l.step === 1) ? (
            <>
              <p className="text-xs uppercase tracking-wide text-muted">
                {journey.letters.find((l) => l.step === 1)?.subject || 'Offer letter'}
              </p>
              <pre className="mt-3 whitespace-pre-wrap font-display text-[15px] leading-7">
                {journey.letters.find((l) => l.step === 1)?.body}
              </pre>
            </>
          ) : (
            <p className="text-sm text-muted">Offer letter will show here after HR sends it.</p>
          )}
        </article>
      ) : null}

      {next === 3 || person.hrStep >= 3 ? (
        <section className="space-y-3 rounded-3xl border border-line bg-surface p-5">
          <h3 className="font-display text-xl">Documents</h3>
          {journey.documents.length === 0 ? <p className="text-sm text-muted">No documents yet.</p> : null}
          {journey.documents.map((doc) => (
            <div key={doc.id} className="rounded-2xl border border-line px-4 py-3">
              <p className="font-medium">{doc.name}</p>
              <p className="text-xs text-muted">{doc.kind}</p>
            </div>
          ))}
          {next === 3 ? (
            <div className="grid gap-2">
              <input
                className="rounded-2xl border border-line px-4 py-3"
                placeholder="Document name"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
              />
              <select className="rounded-2xl border border-line px-4 py-3" value={docKind} onChange={(e) => setDocKind(e.target.value)}>
                <option value="id">ID proof</option>
                <option value="address">Address proof</option>
                <option value="education">Education</option>
                <option value="bank">Bank</option>
                <option value="other">Other</option>
              </select>
              <button type="button" className="rounded-2xl border border-line py-3" onClick={() => void addDocument()}>
                Add document
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      {journey.facePending ? (
        <section className="rounded-3xl border border-line bg-surface p-5">
          <h3 className="font-display text-xl">Enrol face</h3>
          <FaceCapture onCapture={(d, photo) => void saveFace(d, photo)} label="Verify and save face" scanKey={person.email} />
        </section>
      ) : null}

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      {next === 2 ? (
        <button type="button" onClick={() => void run(false)} className="w-full rounded-2xl bg-accent py-3 text-accent-fg">
          Accept offer
        </button>
      ) : null}
      {next === 3 ? (
        <button type="button" onClick={() => void run(false)} className="w-full rounded-2xl bg-accent py-3 text-accent-fg">
          Send documents to HR
        </button>
      ) : null}
      {journey.canRequestResignation ? (
        <div className="space-y-2">
          <textarea
            className="w-full rounded-2xl border border-line px-4 py-3"
            placeholder="Reason for leaving (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
          <button type="button" onClick={() => void run(false)} className="w-full rounded-2xl border border-line py-3">
            Submit resignation request
          </button>
        </div>
      ) : null}
    </div>
  )
}
