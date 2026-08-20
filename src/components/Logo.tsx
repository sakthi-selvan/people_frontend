export function Logo({ size = 40, withWord = false }: { size?: number; withWord?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <img
        src="/logo.png"
        alt="People"
        width={size}
        height={size}
        className="rounded-2xl bg-surface object-cover"
        style={{ width: size, height: size }}
      />
      {withWord ? (
        <div className="leading-tight">
          <p className="font-display text-xl text-ink">People</p>
          <p className="text-xs text-muted">HR · attendance · payroll</p>
        </div>
      ) : null}
    </div>
  )
}
