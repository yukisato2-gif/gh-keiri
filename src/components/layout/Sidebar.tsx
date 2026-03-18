import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { useCurrentEmployee } from '@/hooks/useAppData'
import { LayoutDashboard, ArrowRightLeft, ClipboardCheck, FileBarChart, Settings, ScrollText, Receipt, FileText, Lock, AlertTriangle, Building2 } from 'lucide-react'

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'ダッシュボード' },
  { to: '/transactions', icon: ArrowRightLeft, label: '入出金記録' },
  { to: '/advance-payments', icon: Receipt, label: '立替金管理' },
  { to: '/billing', icon: FileText, label: '請求管理' },
  { to: '/cash-check', icon: ClipboardCheck, label: '残高チェック' },
  { to: '/reports', icon: FileBarChart, label: '月次レポート' },
]

const outstandingNavItem = { to: '/billing/outstanding', icon: AlertTriangle, label: '未収管理' }
const settlementNavItem = { to: '/settlement', icon: Building2, label: '拠点精算' }
const monthlyCloseNavItem = { to: '/monthly-close', icon: Lock, label: '月次締め' }
const auditNavItem = { to: '/audit-log', icon: ScrollText, label: '監査ログ' }
const adminNavItem = { to: '/admin', icon: Settings, label: '管理設定' }

export function Sidebar() {
  const employee = useCurrentEmployee()
  const isAdmin = employee?.role === 'hq_admin' || employee?.role === 'section_chief'
  const canViewAudit = isAdmin || employee?.role === 'supervisor'

  let items = [...navItems]
  if (canViewAudit) items.push(outstandingNavItem)
  if (isAdmin) items.push(settlementNavItem)
  if (canViewAudit) items.push(monthlyCloseNavItem)
  if (canViewAudit) items.push(auditNavItem)
  if (isAdmin) items.push(adminNavItem)

  return (
    <aside className="hidden w-56 shrink-0 border-r border-border bg-white lg:block">
      <nav className="flex flex-col gap-1 p-3">
        {items.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
