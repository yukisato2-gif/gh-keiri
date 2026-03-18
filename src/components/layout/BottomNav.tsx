import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useCurrentEmployee } from '@/hooks/useAppData'
import { LayoutDashboard, ArrowRightLeft, FileBarChart, Settings, ScrollText, FileText } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'ホーム' },
  { to: '/transactions', icon: ArrowRightLeft, label: '入出金' },
  { to: '/billing', icon: FileText, label: '請求' },
  { to: '/reports', icon: FileBarChart, label: 'レポート' },
]

const auditNavItem = { to: '/audit-log', icon: ScrollText, label: '監査' }
const adminNavItem = { to: '/admin', icon: Settings, label: '管理' }

export function BottomNav() {
  const employee = useCurrentEmployee()
  const isAdmin = employee?.role === 'hq_admin' || employee?.role === 'section_chief'
  const canViewAudit = isAdmin || employee?.role === 'supervisor'

  let items = [...navItems]
  if (canViewAudit) items.push(auditNavItem)
  if (isAdmin) items.push(adminNavItem)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-border bg-white lg:hidden">
      {items.map(({ to, icon: Icon, label }) => (
        <NavLink
          key={to}
          to={to}
          end={to === '/'}
          className={({ isActive }) =>
            cn(
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
              isActive ? 'text-primary' : 'text-muted-foreground'
            )
          }
        >
          <Icon className="h-5 w-5" />
          {label}
        </NavLink>
      ))}
    </nav>
  )
}
