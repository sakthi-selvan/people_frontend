export type Role = 'hr' | 'employee' | 'device' | 'admin' | 'manager'

export function isHr(role: string | null | undefined) {
  return role === 'hr' || role === 'admin' || role === 'manager'
}

export type DocumentRequest = {
  open?: boolean
  submitted?: boolean
  note?: string
  at?: string
  submittedAt?: string
}

export type User = {
  id: string
  code: string
  name: string
  email: string
  phone?: string
  role: Role
  department: string
  managerId: string | null
  status: string
  hrStep: number
  hasFace: boolean
  hasPassword: boolean
  baseSalary: number
  shiftId: string | null
  joiningDate: string
  documentRequest?: DocumentRequest | null
}

export function isInactive(user?: Pick<User, 'status'> | null) {
  return user?.status === 'exited'
}

export function canResign(user?: Pick<User, 'status' | 'hrStep' | 'role'> | null) {
  if (!user || isInactive(user)) return false
  if (user.role && user.role !== 'employee') return false
  return user.hrStep >= 7 && user.hrStep < 13
}

export function personStageLabel(person: Pick<User, 'status' | 'hrStep'>) {
  if (person.status === 'exited') return 'inactive'
  if (person.hrStep < 7) return `joining ${person.hrStep}/7`
  if (person.hrStep >= 13) return 'resigning'
  if (person.hrStep < 11) return 'active'
  if (person.hrStep === 12) return 'confirmed'
  return `step ${person.hrStep}`
}

export type Device = {
  id: string
  name: string
  location: string
}

export type HrStep = {
  id: number
  key: string
  label: string
  actor: string
}

export const THEMES = [
  { id: 'atlas', name: 'Atlas', note: 'Daylight navy and teal' },
  { id: 'noir', name: 'Noir', note: 'Low-light operations' },
  { id: 'sage', name: 'Sage', note: 'Warm paper and forest' },
] as const

export type ThemeId = (typeof THEMES)[number]['id']
