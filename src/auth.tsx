import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import type { Device, Role, User } from './types'

type AuthState = {
  ready: boolean
  role: Role | null
  user: User | null
  device: Device | null
  login: (email: string, password: string) => Promise<void>
  loginDevice: (name: string, password: string) => Promise<void>
  logout: () => void
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState<Role | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [device, setDevice] = useState<Device | null>(null)

  const hydrate = useCallback(async () => {
    if (!getToken()) {
      setReady(true)
      return
    }
    try {
      const me = await api<{ role: Role; user?: User; device?: Device }>('/auth/me')
      setRole(me.role)
      setUser(me.user || null)
      setDevice(me.device || null)
    } catch {
      setToken(null)
      setRole(null)
      setUser(null)
      setDevice(null)
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void hydrate()
  }, [hydrate])

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ token: string; user: User }>('/auth/login', {
      method: 'POST',
      body: { email, password },
    })
    setToken(data.token)
    setRole(data.user.role)
    setUser(data.user)
    setDevice(null)
  }, [])

  const loginDevice = useCallback(async (name: string, password: string) => {
    const data = await api<{ token: string; device: Device }>('/auth/device', {
      method: 'POST',
      body: { name, password },
    })
    setToken(data.token)
    setRole('device')
    setDevice(data.device)
    setUser(null)
  }, [])

  const logout = useCallback(() => {
    setToken(null)
    setRole(null)
    setUser(null)
    setDevice(null)
  }, [])

  const value = useMemo(
    () => ({ ready, role, user, device, login, loginDevice, logout, refresh: hydrate }),
    [ready, role, user, device, login, loginDevice, logout, hydrate],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('Auth missing')
  return ctx
}
