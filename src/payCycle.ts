export function isoDate(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function payCycleFor(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth() - 1, 21)
  const end = new Date(date.getFullYear(), date.getMonth(), 20)
  return { from: isoDate(start), to: isoDate(end) }
}

export function shiftIsoMonths(iso: string, months: number) {
  const d = new Date(`${iso}T12:00:00`)
  d.setMonth(d.getMonth() + months)
  return isoDate(d)
}

export function periodLabel(from: string, to: string) {
  if (!from || !to) return ''
  const fmt = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${fmt(from)} – ${fmt(to)}`
}

export function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`
}
