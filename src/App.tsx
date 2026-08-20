import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth'
import { Shell } from './components/Shell'
import { AttendancePage } from './pages/Attendance'
import { DashboardPage } from './pages/Dashboard'
import { DeviceLoginPage } from './pages/DeviceLogin'
import { DevicesPage } from './pages/Devices'
import { FacesPage } from './pages/Faces'
import { LeavePage } from './pages/Leave'
import { KioskPage } from './pages/Kiosk'
import { LoginPage } from './pages/Login'
import { PayrollPage } from './pages/Payroll'
import { PeoplePage } from './pages/People'
import { PersonDetailPage } from './pages/PersonDetail'
import { ProfilePage } from './pages/Profile'
import { SettingsPage } from './pages/Settings'
import { isHr } from './types'

function Guard({
  children,
  allow,
}: {
  children: ReactNode
  allow: Array<'hr' | 'employee' | 'device'>
}) {
  const { ready, role } = useAuth()
  if (!ready) return <div className="p-8 text-muted">Loading…</div>
  if (!role) return <Navigate to="/login" replace />
  if (isHr(role) && allow.includes('hr')) return children
  if (role === 'employee' && allow.includes('employee')) return children
  if (role === 'device' && allow.includes('device')) return children
  return <Navigate to={role === 'device' ? '/kiosk' : '/app'} replace />
}

export default function App() {
  const { ready, role } = useAuth()
  if (!ready) return <div className="p-8 text-muted">Loading…</div>

  return (
    <Routes>
      <Route path="/login" element={role && role !== 'device' ? <Navigate to="/app" /> : <LoginPage />} />
      <Route path="/device" element={role === 'device' ? <Navigate to="/kiosk" /> : <DeviceLoginPage />} />
      <Route
        path="/kiosk"
        element={
          <Guard allow={['device']}>
            <KioskPage />
          </Guard>
        }
      />
      <Route
        path="/app"
        element={
          <Guard allow={['hr', 'employee']}>
            <Shell />
          </Guard>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="people" element={<PeoplePage />} />
        <Route path="people/:id" element={<PersonDetailPage />} />
        <Route path="attendance" element={<AttendancePage />} />
        <Route
          path="faces"
          element={
            <Guard allow={['hr']}>
              <FacesPage />
            </Guard>
          }
        />
        <Route path="leave" element={<LeavePage />} />
        <Route
          path="payroll"
          element={
            <Guard allow={['hr', 'employee']}>
              <PayrollPage />
            </Guard>
          }
        />
        <Route
          path="devices"
          element={
            <Guard allow={['hr']}>
              <DevicesPage />
            </Guard>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to={role === 'device' ? '/kiosk' : role ? '/app' : '/login'} replace />} />
    </Routes>
  )
}
