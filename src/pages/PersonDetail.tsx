import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../api'
import { useAuth } from '../auth'
import { EmailStatus } from '../components/EmailStatus'
import { FaceCapture } from '../components/FaceCapture'
import { JoiningStage } from '../components/JoiningStage'
import { isHr, isInactive, type DocumentRequest, type HrStep, type User } from '../types'

type Letter = {
  id: string
  step: number
  key?: string
  title: string
  subject?: string
  body?: string
  html?: string
}
type Doc = { id: string; name: string; kind: string; notes?: string; createdAt?: string }
type EventRow = { id: string; step: number; action: string; note?: string; at: string }
type EmailRow = { id: string; step?: number; key?: string; subject: string; previewUrl?: string }
type Journey = {
  user: User
  steps: HrStep[]
  letters: Letter[]
  documents: Doc[]
  events: EventRow[]
  emails: EmailRow[]
  nextStep: number | null
  facePending: boolean
  canRequestResignation?: boolean
  canStartProbation?: boolean
  waitingOn?: 'hr' | 'employee' | null
  documentRequest?: DocumentRequest | null
  resignation?: { note?: string; at?: string } | null
}

const HR_ACTION: Record<number, string> = {
  1: 'Send offer letter',
  4: 'Approve documents',
  5: 'Approve joining',
  6: 'Send appointment letter',
  7: 'Complete onboarding',
  11: 'Complete probation review',
  12: 'Send confirmation letter',
  14: 'Approve resignation',
  16: 'Complete exit clearance',
  17: 'Complete full and final',
  18: 'Send relieving letter',
}

const LETTER_KEY: Record<number, string> = {
  1: 'offer_letter',
  6: 'appointment_letter',
  12: 'confirmation_letter',
  18: 'relieving_letter',
}

function canAct(role: string | null, actor: string) {
  if (isHr(role)) return true
  if (actor === 'employee' || actor === 'employee_head') return role === 'employee'
  return false
}

export function PersonDetailPage() {
  const { id } = useParams()
  const { role, refresh } = useAuth()
  const hr = isHr(role)
  const [journey, setJourney] = useState<Journey | null>(null)
  const [openStep, setOpenStep] = useState<number | 'face' | null>(null)
  const [note, setNote] = useState('')
  const [docName, setDocName] = useState('')
  const [docKind, setDocKind] = useState('id')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<{ subject: string; body: string } | null>(null)
  const [emailState, setEmailState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [emailMeta, setEmailMeta] = useState({ label: 'message', previewUrl: '', error: '' })
  const [docRequestNote, setDocRequestNote] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  async function load() {
    if (!id) return
    const data = await api<Journey>(`/users/${id}/journey`)
    setJourney(data)
    setOpenStep((current) => {
      if (current) return current
      if (data.facePending && data.user.hrStep >= 6) return 'face'
      if (data.canRequestResignation && !isHr(role)) return 13
      if (!isHr(role) && data.nextStep && data.nextStep > 7) return 7
      return data.nextStep
    })
  }

  useEffect(() => {
    void load()
  }, [id])

  const person = journey?.user
  const waitingResignation = Boolean(journey?.canRequestResignation)
  const steps = (journey?.steps || []).filter((s) => s.id < 8 || s.id > 10)
  const nextStep = !hr && journey?.nextStep && journey.nextStep > 7 && journey.nextStep < 13 ? null : (journey?.nextStep ?? null)
  const selected = openStep ?? nextStep
  const selectedMeta = typeof selected === 'number' ? steps.find((s) => s.id === selected) : null
  const selectedLetter =
    typeof selected === 'number' ? journey?.letters.find((l) => l.step === selected) : undefined
  const selectedEvent =
    typeof selected === 'number' ? [...(journey?.events || [])].reverse().find((e) => e.step === selected) : undefined
  const isNext = typeof selected === 'number' && selected === nextStep
  const isDone = typeof selected === 'number' && (person?.hrStep || 0) >= selected
  const isLocked = typeof selected === 'number' && (person?.hrStep || 0) + 1 < selected
  const letterKey = typeof selected === 'number' ? LETTER_KEY[selected] : undefined

  useEffect(() => {
    if (!id || !letterKey || selectedLetter) {
      if (selectedLetter) setPreview({ subject: selectedLetter.subject || selectedLetter.title, body: selectedLetter.body || '' })
      else if (!letterKey) setPreview(null)
      return
    }
    void api<{ subject: string; body: string }>(`/users/${id}/preview/${letterKey}`)
      .then(setPreview)
      .catch(() => setPreview(null))
  }, [id, letterKey, selectedLetter?.id])

  async function runStep(skip = false) {
    if (!id) return
    const willEmail = !skip && Boolean(letterKey)
    setError('')
    if (willEmail) {
      setEmailMeta({ label: selectedMeta?.label.toLowerCase() || 'letter', previewUrl: '', error: '' })
      setEmailState('sending')
    }
    try {
      const result = await api<{ email?: EmailRow; journey: Journey }>(`/users/${id}/workflow`, {
        method: 'POST',
        body: {
          skip,
          note,
          subject: !skip && letterKey ? preview?.subject : undefined,
          body: !skip && letterKey ? preview?.body : undefined,
        },
      })
      setNote('')
      setJourney(result.journey)
      setOpenStep(result.journey.facePending ? 'face' : result.journey.nextStep && result.journey.nextStep > 7 && !isHr(role) ? 7 : result.journey.nextStep)
      await refresh()
      if (willEmail) {
        setEmailMeta({
          label: selectedMeta?.label.toLowerCase() || 'letter',
          previewUrl: result.email?.previewUrl || '',
          error: '',
        })
        setEmailState('sent')
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not complete step'
      setError(message)
      if (willEmail) {
        setEmailMeta((m) => ({ ...m, error: message }))
        setEmailState('error')
      }
    }
  }

  async function addDocument() {
    if (!id || !docName.trim()) return
    setError('')
    try {
      await api(`/users/${id}/documents`, {
        method: 'POST',
        body: { name: docName, kind: docKind, notes: note },
      })
      setDocName('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add document')
    }
  }

  async function saveFace(descriptor: number[], photo: string) {
    if (!id) return
    setError('')
    try {
      await api(`/users/${id}/face`, { method: 'POST', body: { descriptor, photo } })
      await refresh()
      await load()
      setOpenStep(nextStep && nextStep > 7 && !isHr(role) ? 7 : nextStep)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Face enrolment failed')
    }
  }

  async function requestDocuments() {
    if (!id) return
    setError('')
    try {
      const result = await api<{ journey: Journey }>(`/users/${id}/document-request`, {
        method: 'POST',
        body: { note: docRequestNote },
      })
      setDocRequestNote('')
      setJourney(result.journey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not request documents')
    }
  }

  async function ackDocuments() {
    if (!id) return
    setError('')
    try {
      const result = await api<{ journey: Journey }>(`/users/${id}/document-request/ack`, { method: 'POST', body: {} })
      setJourney(result.journey)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not clear document request')
    }
  }

  const actorCanRun = selectedMeta ? canAct(role, selectedMeta.actor) : false
  const canSkip = hr
  const canSubmitResignation = waitingResignation && !hr && selected === 13
  const showStepActions = !isInactive(person) && (isNext || canSubmitResignation)

  const nextLabel = useMemo(() => {
    if (!journey) return ''
    if (isInactive(person)) return 'Inactive · exited'
    if (journey.facePending) return 'Enrol face'
    if ((person?.hrStep || 0) >= 13) return steps.find((s) => s.id === nextStep)?.label || 'Exit in progress'
    if (journey.canStartProbation) return 'Active employment'
    if (waitingResignation && !nextStep) return hr ? 'No exit in progress' : 'Request resignation'
    if (!nextStep) return hr ? 'Lifecycle complete' : 'Joining complete'
    return steps.find((s) => s.id === nextStep)?.label || ''
  }, [journey, steps, nextStep, hr, waitingResignation, person])

  if (!person || !journey) return <p className="text-muted">Loading…</p>
  if (!hr) return <JoiningStage userId={person.id} />

  return (
    <div className="space-y-6 lg:flex lg:min-h-0 lg:flex-col">
      <EmailStatus
        state={emailState}
        label={emailMeta.label}
        previewUrl={emailMeta.previewUrl}
        error={emailMeta.error}
        onClose={() => setEmailState('idle')}
      />

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{person.code}</p>
          <h1 className="font-display text-3xl">{person.name}</h1>
          <p className="text-muted">
            {person.email} · {person.department || 'No department'} · {person.hasFace ? 'Face enrolled' : 'No face yet'}
            {isInactive(person) ? ' · Inactive' : ''}
          </p>
        </div>
        {hr ? (
          <div className="flex flex-wrap gap-2">
            <Link to={`/app/attendance?person=${person.id}`} className="rounded-2xl bg-accent px-4 py-2 text-sm text-accent-fg">
              {isInactive(person) ? 'Past attendance' : 'View attendance'}
            </Link>
            <Link to={`/app/payroll?person=${person.id}`} className="rounded-2xl border border-line px-4 py-2 text-sm">
              {isInactive(person) ? 'Past payroll' : 'View payroll'}
            </Link>
          </div>
        ) : null}
      </div>

      {isInactive(person) ? (
        <section className="rounded-3xl border border-line bg-surface px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Account</p>
          <p className="mt-1 font-display text-2xl">Inactive</p>
          <p className="mt-1 text-sm text-muted">
            This person has exited. Login is blocked, and they cannot request leave or take other employee actions. They are not included in payroll or attendance downloads. History stays on file.
          </p>
        </section>
      ) : null}

      {(person.hrStep >= 13 || journey.resignation) ? (
        <section className="rounded-3xl border border-accent bg-surface px-4 py-4">
          <p className="text-xs uppercase tracking-wide text-muted">Priority · Resignation preview</p>
          <p className="mt-1 font-display text-2xl">{person.name}</p>
          {journey.resignation?.at ? (
            <p className="mt-1 text-sm text-muted">Submitted {new Date(journey.resignation.at).toLocaleString()}</p>
          ) : null}
          {journey.resignation?.note ? (
            <p className="mt-2 whitespace-pre-wrap text-sm">{journey.resignation.note}</p>
          ) : (
            <p className="mt-2 text-sm text-muted">No reason was given.</p>
          )}
          {journey.letters.filter((letter) => letter.step >= 13).map((letter) => (
            <article key={letter.id} className="mt-3 rounded-2xl border border-line bg-bg p-4">
              <p className="text-xs uppercase tracking-wide text-muted">{letter.subject || letter.title}</p>
              <pre className="mt-2 whitespace-pre-wrap font-display text-[15px] leading-7">{letter.body}</pre>
            </article>
          ))}
        </section>
      ) : null}

      {hr && !isInactive(person) ? (
        <form
          className="flex flex-col gap-2 rounded-3xl border border-line bg-surface p-4 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault()
            void (async () => {
              setResetMsg('')
              setError('')
              try {
                await api(`/users/${person.id}/reset-password`, { method: 'POST', body: { password: resetPassword } })
                setResetPassword('')
                setResetMsg('Password reset')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Could not reset password')
              }
            })()
          }}
        >
          <label className="block min-w-0 flex-1 text-sm">
            Reset password
            <input
              type="password"
              className="mt-1 w-full rounded-2xl border border-line px-4 py-3"
              placeholder="New password"
              value={resetPassword}
              onChange={(e) => setResetPassword(e.target.value)}
            />
          </label>
          <button type="submit" className="rounded-2xl bg-ink px-4 py-3 text-bg">
            Reset
          </button>
          {resetMsg ? <p className="text-sm text-good sm:w-full">{resetMsg}</p> : null}
        </form>
      ) : null}

      <div className="rounded-3xl border border-accent bg-surface px-4 py-4">
        <p className="text-xs uppercase tracking-wide text-muted">Review</p>
        <p className="mt-1 font-display text-2xl">{nextLabel}</p>
        <p className="mt-1 text-sm text-muted">
          {isInactive(person)
            ? 'This account is closed. Open stages below only to read history.'
            : journey.documentRequest?.open
              ? 'Waiting for this person to add new documents. Older files stay on this page.'
              : journey.canStartProbation
                ? 'Joining is done. Salary and payslips run from Payroll using attendance. They are not stages on this person.'
                : journey.waitingOn === 'employee'
                  ? 'Waiting for this person to finish their stage.'
                  : 'Review the current stage, then approve to move them to the next one.'}
        </p>
        {journey.canStartProbation ? (
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to={`/app/payroll?person=${person.id}`} className="rounded-2xl bg-accent px-4 py-2 text-sm text-accent-fg">
              Open payroll
            </Link>
            <button
              type="button"
              className="rounded-2xl border border-line px-4 py-2 text-sm"
              onClick={() => {
                void (async () => {
                  setError('')
                  try {
                    const result = await api<{ journey: Journey }>(`/users/${person.id}/workflow`, {
                      method: 'POST',
                      body: { start: 'probation', note },
                    })
                    setJourney(result.journey)
                    setOpenStep(12)
                  } catch (err) {
                    setError(err instanceof Error ? err.message : 'Could not start probation')
                  }
                })()
              }}
            >
              Complete probation review
            </button>
          </div>
        ) : null}
      </div>

      <section className="space-y-3 rounded-3xl border border-line bg-surface p-4">
        <h2 className="font-display text-2xl">Documents</h2>
        <p className="text-sm text-muted">All submissions stay saved. Asking for new files does not remove the old ones.</p>
        {journey.documents.length === 0 ? <p className="text-sm text-muted">No documents yet.</p> : null}
        {journey.documents.map((doc) => {
          const isNew = Boolean(journey.documentRequest?.at && doc.createdAt && doc.createdAt >= journey.documentRequest.at)
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
        {journey.documentRequest?.open ? (
          <p className="text-sm">Asked to resubmit{journey.documentRequest.note ? `: ${journey.documentRequest.note}` : ''}.</p>
        ) : null}
        {journey.documentRequest?.submitted ? (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm">New documents were sent. Older files are still listed above.</p>
            <button type="button" className="rounded-2xl border border-line px-3 py-2 text-sm" onClick={() => void ackDocuments()}>
              Mark as reviewed
            </button>
          </div>
        ) : null}
        {!isInactive(person) ? (
          <div className="grid gap-2">
            <textarea
              className="w-full rounded-2xl border border-line px-4 py-3"
              placeholder="What should they send again?"
              value={docRequestNote}
              onChange={(e) => setDocRequestNote(e.target.value)}
            />
            <button type="button" className="rounded-2xl border border-line py-3" onClick={() => void requestDocuments()}>
              Ask to resubmit documents
            </button>
          </div>
        ) : null}
      </section>

      <div className="gap-6 lg:grid lg:grid-cols-[minmax(240px,300px)_minmax(0,1fr)] lg:items-start">
      <ol className="space-y-2 lg:sticky lg:top-0 lg:max-h-[calc(100svh-12rem)] lg:overflow-y-auto lg:overscroll-contain">
        {steps.map((step) => {
          const done = person.hrStep >= step.id
          const current = nextStep === step.id
          const waiting = waitingResignation && step.id === 13
          const skipped = journey.events.some((e) => e.step === step.id && e.action === 'skip')
          const heading = step.id === 1 ? 'Joining' : step.id === 11 ? 'Confirmation' : step.id === 13 ? 'Exit' : null
          return (
            <li key={step.id}>
              {heading ? <p className="mb-2 mt-3 px-1 text-xs uppercase tracking-wide text-muted first:mt-0">{heading}</p> : null}
              <button
                type="button"
                onClick={() => setOpenStep(step.id)}
                className={`w-full rounded-2xl border px-4 py-3 text-left ${
                  selected === step.id ? 'border-accent bg-surface' : 'border-line bg-surface/60'
                }`}
              >
                <p className="text-xs text-muted">
                  {step.id} · {done ? (skipped ? 'Skipped' : 'Done') : waiting ? 'Not requested' : current ? 'Next' : 'Locked'}
                </p>
                <p className={done && selected !== step.id ? 'text-muted' : ''}>{step.label}</p>
              </button>
            </li>
          )
        })}
        {journey.facePending || person.hasFace ? (
          <li>
            <button
              type="button"
              onClick={() => setOpenStep('face')}
              className={`w-full rounded-2xl border px-4 py-3 text-left ${
                selected === 'face' ? 'border-accent bg-surface' : 'border-line bg-surface/60'
              }`}
            >
              <p className="text-xs text-muted">{person.hasFace ? 'Done' : 'Next'}</p>
              <p>Face enrolment</p>
            </button>
          </li>
        ) : null}
      </ol>

      <section className="mt-6 space-y-4 rounded-3xl border border-line bg-surface p-4 lg:mt-0">
        {selected === 'face' ? (
          person.hasFace ? (
            <p>Face is enrolled. Attendance check-in can use this record.</p>
          ) : (
            <>
              <h2 className="font-display text-2xl">Enrol face</h2>
              <p className="text-sm text-muted">Look at the camera to continue the attendance flow. On HTTP, a scan animation is used instead.</p>
              <FaceCapture onCapture={(d, photo) => void saveFace(d, photo)} label="Verify and save face" scanKey={person.email} />
            </>
          )
        ) : null}

        {selectedMeta ? (
          <>
            <div>
              <p className="text-xs text-muted">
                {isDone
                  ? 'Issued'
                  : waitingResignation && selected === 13
                    ? hr
                      ? 'Waiting for employee'
                      : 'Not requested'
                    : isNext
                      ? 'In progress'
                      : 'Locked'}
              </p>
              <h2 className="font-display text-2xl">{selectedMeta.label}</h2>
            </div>

            {isLocked ? <p className="text-sm text-muted">Finish the previous step to open this one.</p> : null}
            {waitingResignation && selected === 13 && hr ? (
              <p className="text-sm text-muted">The employee must submit this request. It is not in progress until they do.</p>
            ) : null}

            {preview ? (
              <article className="rounded-2xl border border-line bg-bg p-5">
                {hr && isNext && letterKey ? (
                  <div className="space-y-3">
                    <p className="text-xs uppercase tracking-wide text-muted">Review then send</p>
                    <input
                      className="w-full rounded-2xl border border-line bg-surface px-4 py-3"
                      value={preview.subject}
                      onChange={(e) => setPreview({ ...preview, subject: e.target.value })}
                    />
                    <textarea
                      className="min-h-56 w-full rounded-2xl border border-line bg-surface px-4 py-3 font-display text-[15px] leading-7"
                      value={preview.body}
                      onChange={(e) => setPreview({ ...preview, body: e.target.value })}
                    />
                  </div>
                ) : (
                  <>
                    <p className="text-xs uppercase tracking-wide text-muted">{preview.subject}</p>
                    <pre className="mt-3 whitespace-pre-wrap font-display text-[15px] leading-7">{preview.body}</pre>
                  </>
                )}
              </article>
            ) : null}

            {selected === 3 || selected === 4 || selected === 16 ? (
              <ul className="space-y-2">
                {journey.documents.length === 0 ? <li className="text-sm text-muted">No documents yet.</li> : null}
                {journey.documents.map((doc) => {
                  const isNew = Boolean(journey.documentRequest?.at && doc.createdAt && doc.createdAt >= journey.documentRequest.at)
                  return (
                    <li key={doc.id} className="rounded-2xl border border-line px-4 py-3">
                      <p className="font-medium">
                        {doc.name}
                        {isNew ? <span className="ml-2 text-xs uppercase tracking-wide text-accent">New</span> : null}
                      </p>
                      <p className="text-xs text-muted">
                        {doc.kind}
                        {doc.createdAt ? ` · ${new Date(doc.createdAt).toLocaleString()}` : ''}
                        {doc.notes ? ` · ${doc.notes}` : ''}
                      </p>
                    </li>
                  )
                })}
              </ul>
            ) : null}

            {isNext && selected === 3 ? (
              <div className="grid gap-2">
                <input className="rounded-2xl border border-line px-4 py-3" placeholder="Document name" value={docName} onChange={(e) => setDocName(e.target.value)} />
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

            {selectedEvent?.action === 'skip' ? (
              <p className="text-sm text-warn">This step was skipped. The next action is shown above.</p>
            ) : null}

            {showStepActions ? (
              <div className="space-y-3">
                <textarea
                  className="w-full rounded-2xl border border-line px-4 py-3"
                  placeholder={canSubmitResignation ? 'Reason for leaving (optional)' : 'Note for this step'}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
                {error ? <p className="text-sm text-danger">{error}</p> : null}
                {hr && letterKey ? (
                  <p className="text-sm text-muted">Review the letter above, then send it to this person only.</p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row">
                  {actorCanRun || canSubmitResignation ? (
                    <button type="button" onClick={() => void runStep(false)} className="flex-1 rounded-2xl bg-accent py-3 text-accent-fg">
                      {canSubmitResignation
                        ? 'Submit resignation request'
                        : selectedMeta && HR_ACTION[selectedMeta.id]
                          ? HR_ACTION[selectedMeta.id]
                          : letterKey
                            ? `Send ${selectedMeta.label.toLowerCase()}`
                            : 'Approve and continue'}
                    </button>
                  ) : (
                    <p className="flex-1 text-sm text-muted">
                      {waitingResignation && selected === 13
                        ? 'Waiting for the employee to submit a resignation request.'
                        : `Waiting on ${selectedMeta.actor.replaceAll('_', ' / ')}.`}
                    </p>
                  )}
                  {canSkip && isNext ? (
                    <button type="button" onClick={() => void runStep(true)} className="rounded-2xl border border-line px-4 py-3">
                      Skip
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      </div>
    </div>
  )
}
