export function EmailStatus({
  state,
  label = 'message',
  previewUrl,
  error,
  onClose,
}: {
  state: 'idle' | 'sending' | 'sent' | 'error'
  label?: string
  previewUrl?: string
  error?: string
  onClose: () => void
}) {
  if (state === 'idle') return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 px-4">
      <div className="w-full max-w-sm rounded-3xl bg-surface p-6 text-center shadow-[inset_0_0_0_1px_var(--line)]">
        {state === 'sending' ? (
          <>
            <div className="mail-pulse mx-auto h-14 w-14 rounded-2xl border border-line bg-bg" />
            <p className="mt-4 font-display text-2xl">Sending {label}</p>
            <p className="mt-1 text-sm text-muted">Please wait while the email goes out.</p>
          </>
        ) : null}
        {state === 'sent' ? (
          <>
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-good text-accent-fg">
              <span className="text-xl">✓</span>
            </div>
            <p className="mt-4 font-display text-2xl">Sent</p>
            <p className="mt-1 text-sm text-muted">{label} was delivered.</p>
            {previewUrl ? (
              <a className="mt-3 inline-block text-sm text-accent" href={previewUrl} target="_blank" rel="noreferrer">
                Open email preview
              </a>
            ) : null}
            <button type="button" className="mt-5 w-full rounded-2xl bg-accent py-3 text-accent-fg" onClick={onClose}>
              Continue
            </button>
          </>
        ) : null}
        {state === 'error' ? (
          <>
            <p className="font-display text-2xl">Could not send</p>
            <p className="mt-2 text-sm text-danger">{error}</p>
            <button type="button" className="mt-5 w-full rounded-2xl border border-line py-3" onClick={onClose}>
              Close
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}
