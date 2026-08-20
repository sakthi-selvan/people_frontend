import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../auth'
import { FaceCapture } from './FaceCapture'
import { EmailStatus } from './EmailStatus'
import { isHr, type DocumentRequest, type HrStep, type User } from '../types'

type Letter = { id: string; step: number; title: string; subject?: string; body?: string }
type Doc = { id: string; name: string; kind: string; notes?: string; createdAt?: string }
type Journey = {
  user: User
  steps: HrStep[]
  letters: Letter[]
  documents: Doc[]
  nextStep: number | null
  facePending: boolean
  canRequestResignation?: boolean
  waitingOn?: 'hr' | 'employee' | null
  documentRequest?: DocumentRequest | null
  resignation?: { note?: string; at?: string } | null
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
  const docRequest = journey?.documentRequest
  const yours = !hr && (next === 2 || next === 3 || next === 15 || Boolean(journey?.canRequestResignation) || Boolean(docRequest?.open))
  const waiting = next && !yours && !hr
  const letter = typeof next === 'number' ? journey?.letters.find((l) => l.step === next) : undefined
  const canUpload = next === 3 || Boolean(docRequest?.open)

  async function run(skip = false, extra: Record<string, unknown> = {}) {
    setError('')
    try {
      const result = await api<{ email?: { previewUrl?: string }; journey: Journey }>(`/users/${userId}/workflow`, {
        method: 'POST',
        body: { skip, note, ...extra },
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

  async function sendDocumentsToHr() {
    setError('')
    try {
      const result = await api<{ journey: Journey }>(`/users/${userId}/document-request/submit`, { method: 'POST', body: {} })
      setJourney(result.journey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send documents')
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

  const exiting = person.hrStep >= 13
  const stageLabel = journey.facePending
    ? 'Face enrolment'
    : journey.canRequestResignation
      ? 'Confirmed'
      : exiting
        ? step?.label || 'Exit in progress'
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
        <p className="text-sm text-muted">{exiting ? 'Your exit' : 'Your joining'}</p>
        <h1 className="font-display text-3xl">{person.name}</h1>
        <p className="text-muted">
          {exiting
            ? 'HR is handling your resignation. Previous documents stay on file.'
            : 'Finish each stage. HR reviews and then you move to the next one.'}
        </p>
      </div>

      {person.hrStep < 8 ? (
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
      ) : null}

      {exiting ? (
        <section className="rounded-3xl border border-accent bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">Resignation</p>
          <h2 className="mt-1 font-display text-2xl">Submitted</h2>
          {journey.resignation?.at ? (
            <p className="mt-1 text-sm text-muted">{new Date(journey.resignation.at).toLocaleString()}</p>
          ) : null}
          {journey.resignation?.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">{journey.resignation.note}</p>
          ) : null}
        </section>
      ) : null}

      {docRequest?.open ? (
        <section className="rounded-3xl border border-accent bg-surface p-5">
          <p className="text-xs uppercase tracking-wide text-muted">HR request</p>
          <h2 className="mt-1 font-display text-2xl">Please add new documents</h2>
          <p className="mt-2 text-sm text-muted">
            {docRequest.note || 'Upload the new files. Older documents stay saved and visible.'}
          </p>
        </section>
      ) : null}

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
        {next === 15 ? <p className="mt-2 text-sm text-muted">Complete handover so HR can continue the exit.</p> : null}
        {journey.facePending ? (
          <p className="mt-2 text-sm text-muted">Enrol your face here or at the kiosk so attendance can start.</p>
        ) : null}
        {!next && !journey.facePending && !journey.canRequestResignation && !exiting ? (
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

      {next === 3 || person.hrStep >= 3 || Boolean(docRequest) ? (
        <section className="space-y-3 rounded-3xl border border-line bg-surface p-5">
          <h3 className="font-display text-xl">Documents</h3>
          <p className="text-sm text-muted">Everything you have already submitted stays here. New files are added, not replaced.</p>
          {journey.documents.length === 0 ? <p className="text-sm text-muted">No documents yet.</p> : null}
          {journey.documents.map((doc) => {
            const isNew = Boolean(docRequest?.at && doc.createdAt && doc.createdAt >= docRequest.at)
            return (
              <div key={doc.id} className="rounded-2xl border border-line px-4 py-3">
                <p className="font-medium">
                  {doc.name}
                  {isNew ? <span className="ml-2 text-xs uppercase tracking-wide text-accent">New</span> : null}
                </p>
                <p className="text-xs text-muted">
                  {doc.kind}
                  {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleString()}` : ''}
                  {doc.notes ? ` · ${doc.notes}` : ''}
                </p>
              </div>
            )
          })}
          {canUpload ? (
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
      {docRequest?.open && next !== 3 ? (
        <button type="button" onClick={() => void sendDocumentsToHr()} className="w-full rounded-2xl bg-accent py-3 text-accent-fg">
          Send new documents to HR
        </button>
      ) : null}
      {next === 15 ? (
        <button type="button" onClick={() => void run(false)} className="w-full rounded-2xl bg-accent py-3 text-accent-fg">
          Complete handover
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
          <button type="button" onClick={() => void run(false, { start: 'resignation' })} className="w-full rounded-2xl border border-line py-3">
            Submit resignation request
          </button>
        </div>
      ) : null}
    </div>
  )
}
