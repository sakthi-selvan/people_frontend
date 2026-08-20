import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  Banknote,
  CalendarCheck,
  LayoutDashboard,
  ListChecks,
  LogOut,
  MonitorSmartphone,
  Palmtree,
  ScanFace,
  Settings,
  Users,
} from 'lucide-react'
import { useAuth } from '../auth'
import { Logo } from './Logo'
import { isHr } from '../types'

export function Shell() {
  const { user, logout, role } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const joining = !isHr(role) && role !== 'device' && (user?.hrStep || 0) < 7
  const visible = [
    { to: '/app', label: 'Home', icon: LayoutDashboard },
    ...(isHr(role)
      ? [
          { to: '/app/people', label: 'People', icon: Users },
          { to: '/app/attendance', label: 'Attendance', icon: CalendarCheck },
          { to: '/app/faces', label: 'Faces', icon: ScanFace },
          { to: '/app/leave', label: 'Leave', icon: Palmtree },
          { to: '/app/payroll', label: 'Payroll', icon: Banknote },
          { to: '/app/devices', label: 'Devices', icon: MonitorSmartphone },
        ]
      : joining && user
        ? [{ to: `/app/people/${user.id}`, label: 'Joining', icon: ListChecks }]
        : [
            { to: '/app/attendance', label: 'Attendance', icon: CalendarCheck },
            { to: '/app/leave', label: 'Leave', icon: Palmtree },
            { to: '/app/payroll', label: 'Payroll', icon: Banknote },
          ]),
    { to: '/app/settings', label: 'Settings', icon: Settings },
  ]
  const mobile = isHr(role)
    ? ['/app', '/app/people', '/app/attendance', '/app/payroll', '/app/leave', '/app/settings']
    : joining && user
      ? ['/app', `/app/people/${user.id}`, '/app/settings']
      : ['/app', '/app/attendance', '/app/payroll', '/app/leave', '/app/settings']

  return (
    <div className="min-h-svh bg-bg text-ink md:h-svh md:overflow-hidden md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface md:flex md:h-full md:flex-col md:overflow-hidden md:p-6">
        <div className="shrink-0">
          <Logo withWord />
        </div>
        <nav className="mt-10 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain">
          {visible.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm ${
                  isActive ? 'bg-accent text-accent-fg' : 'text-muted hover:bg-bg hover:text-ink'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={() => {
            logout()
            navigate('/login')
          }}
          className="mt-4 flex shrink-0 items-center gap-3 rounded-2xl px-3 py-2 text-sm text-muted hover:text-ink"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </aside>

      <div className="flex min-h-svh min-w-0 flex-col md:h-full md:min-h-0 md:overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-line bg-surface px-4 py-3 md:px-8">
          <div className="md:hidden">
            <Logo size={36} withWord />
          </div>
          <div className="hidden md:block">
            <p className="text-sm text-muted">{location.pathname.replace('/app', '') || 'Home'}</p>
          </div>
          <NavLink to="/app/settings" className="text-right">
            <p className="text-sm font-medium">{user?.name}</p>
            <p className="text-xs capitalize text-muted">{isHr(user?.role) ? 'HR' : 'Employee'} · Settings</p>
          </NavLink>
        </header>
        <main className="flex-1 px-4 py-5 pb-24 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:px-8 md:pb-8">
          <Outlet />
        </main>
        <nav
          className={`safe-bottom fixed inset-x-0 bottom-0 grid border-t border-line bg-surface px-2 pt-2 md:hidden ${
            mobile.length === 6 ? 'grid-cols-6' : mobile.length === 5 ? 'grid-cols-5' : mobile.length === 4 ? 'grid-cols-4' : 'grid-cols-3'
          }`}
        >
          {visible
            .filter((item) => mobile.includes(item.to))
            .map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] ${
                  isActive ? 'text-accent' : 'text-muted'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  )
}
