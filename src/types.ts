export type Role = 'hr' | 'employee' | 'device' | 'admin' | 'manager'

export function isHr(role: string | null | undefined) {
  return role === 'hr' || role === 'admin' || role === 'manager'
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
