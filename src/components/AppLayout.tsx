import { type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { LayoutDashboard, List, PenSquare, Calculator, Menu, X, LogOut, MapPin, Bell, FileCheck, ClipboardList, Shield, Receipt, Settings, Wallet, FileText, CalendarCheck } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useAuthStore, is本社管理者, isSV, isホーム長 } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: ReactNode
}

// AppSheet のボトムナビゲーション: ダッシュボード, 入出金一覧確認, 入出金記録, 残高チェック
const bottomNavItems = [
  { path: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { path: '/transactions', label: '入出金一覧', icon: List },
  { path: '/transactions/new', label: '入出金記録', icon: PenSquare },
  { path: '/cash-check', label: '残高チェック', icon: Calculator },
]

export function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const { employee, signOut } = useAuthStore()
  const { 選択拠点, myLocations } = useLocationStore()

  const currentLocation = myLocations.find((l) => l.拠点id === 選択拠点)

  // 未読通知件数を取得
  useEffect(() => {
    if (!employee || !選択拠点) return

    const fetchUnread = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('id, recipient_email, recipient_role, read')
        .eq('拠点', 選択拠点)
        .eq('read', false)

      const count = (data ?? []).filter((n: { recipient_email: string | null; recipient_role: string | null }) => {
        if (n.recipient_email && n.recipient_email === employee.メールアドレス) return true
        if (n.recipient_role && n.recipient_role === employee.役職) return true
        if (!n.recipient_email && !n.recipient_role) return true
        return false
      }).length

      setUnreadCount(count)
    }

    fetchUnread()

    // Realtime subscription で通知件数を自動更新
    const channel = supabase
      .channel('notifications-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => {
        fetchUnread()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [employee, 選択拠点])

  const nav = (path: string) => {
    navigate(path)
    setMenuOpen(false)
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg">
      {/* ヘッダー */}
      <header className="sticky top-0 z-50 bg-primary text-white shadow-md">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <button onClick={() => setMenuOpen(true)} className="p-1">
              <Menu className="w-6 h-6" />
            </button>
            <h1 className="text-lg font-bold">GH経理</h1>
          </div>
          <div className="flex items-center gap-2 text-sm">
            {currentLocation && (
              <button
                onClick={() => navigate('/location-select')}
                className="flex items-center gap-1 bg-white/20 rounded-full px-3 py-1"
              >
                <MapPin className="w-3 h-3" />
                {currentLocation.拠点}
              </button>
            )}
            <button
              onClick={() => navigate('/notifications')}
              className="relative p-1"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* サイドメニュー (AppSheet のメニューナビゲーション再現 - フラット構造) */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMenuOpen(false)} />
          <nav className="relative w-72 bg-white h-full shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div>
                <p className="font-bold text-lg">GH経理</p>
                <p className="text-sm text-muted">{employee?.従業員名}</p>
                <p className="text-xs text-muted">{employee?.役職}</p>
              </div>
              <button onClick={() => setMenuOpen(false)}>
                <X className="w-5 h-5 text-muted" />
              </button>
            </div>

            {/* AppSheet サイドメニュー: フラットリスト */}
            <div className="py-2">
              {/* 1. ダッシュボード */}
              <MenuItem
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="ダッシュボード"
                active={location.pathname === '/'}
                onClick={() => nav('/')}
              />

              {/* 2. 入出金一覧確認 */}
              <MenuItem
                icon={<List className="w-4 h-4" />}
                label="入出金一覧確認"
                active={location.pathname === '/transactions'}
                onClick={() => nav('/transactions')}
              />

              {/* 3. 入出金記録 */}
              <MenuItem
                icon={<PenSquare className="w-4 h-4" />}
                label="入出金記録"
                active={location.pathname === '/transactions/new'}
                onClick={() => nav('/transactions/new')}
              />

              {/* 4. 残高チェック */}
              <MenuItem
                icon={<Calculator className="w-4 h-4" />}
                label="残高チェック"
                active={location.pathname.startsWith('/cash-check')}
                onClick={() => nav('/cash-check')}
              />

              {/* === 経理メニュー === */}
              <div className="border-t border-border mt-2 pt-2">
                <p className="px-4 py-1 text-xs text-muted font-medium uppercase">経理</p>
                <MenuItem
                  icon={<Wallet className="w-4 h-4" />}
                  label="立替金管理"
                  active={location.pathname === '/advance-payments'}
                  onClick={() => nav('/advance-payments')}
                />
                <MenuItem
                  icon={<FileText className="w-4 h-4" />}
                  label="請求管理"
                  active={location.pathname.startsWith('/billing')}
                  onClick={() => nav('/billing')}
                />
                {(isSV(employee) || is本社管理者(employee)) && (
                  <MenuItem
                    icon={<CalendarCheck className="w-4 h-4" />}
                    label="SV締め管理"
                    active={location.pathname === '/monthly-close'}
                    onClick={() => nav('/monthly-close')}
                  />
                )}
              </div>

              {/* 5. SVメニュー (SV/本社管理者のみ) */}
              {(isSV(employee) || is本社管理者(employee)) && (
                <MenuItem
                  icon={<FileCheck className="w-4 h-4" />}
                  label="SVメニュー"
                  active={location.pathname === '/sv-menu'}
                  onClick={() => nav('/sv-menu')}
                />
              )}

              {/* 6. ホーム長メニュー (ホーム長/SV/本社管理者) */}
              {(isホーム長(employee) || isSV(employee) || is本社管理者(employee)) && (
                <MenuItem
                  icon={<ClipboardList className="w-4 h-4" />}
                  label="ホーム長メニュー"
                  active={location.pathname === '/home-menu'}
                  onClick={() => nav('/home-menu')}
                />
              )}

              {/* 7. 従業員閲覧権限メニュー */}
              <MenuItem
                icon={<Shield className="w-4 h-4" />}
                label="従業員閲覧権限メニュー"
                active={location.pathname === '/employee-menu'}
                onClick={() => nav('/employee-menu')}
              />

              {/* 8. 本社管理者 - 請求メニュー (本社管理者のみ) */}
              {is本社管理者(employee) && (
                <MenuItem
                  icon={<Receipt className="w-4 h-4" />}
                  label="本社管理者 - 請求メニュー"
                  active={location.pathname === '/admin-billing'}
                  onClick={() => nav('/admin-billing')}
                />
              )}

              {/* 9. 本社管理者メニュー (本社管理者のみ) */}
              {is本社管理者(employee) && (
                <MenuItem
                  icon={<Settings className="w-4 h-4" />}
                  label="本社管理者メニュー"
                  active={location.pathname === '/admin-main'}
                  onClick={() => nav('/admin-main')}
                />
              )}

              {/* 区切り線 + 共通メニュー */}
              <div className="border-t border-border mt-2 pt-2">
                <MenuItem
                  icon={<MapPin className="w-4 h-4" />}
                  label="拠点切替"
                  active={location.pathname === '/location-select'}
                  onClick={() => nav('/location-select')}
                />
                <MenuItem
                  icon={<Bell className="w-4 h-4" />}
                  label="通知"
                  onClick={() => nav('/notifications')}
                />
                <MenuItem
                  icon={<LogOut className="w-4 h-4" />}
                  label="ログアウト"
                  onClick={() => { signOut(); setMenuOpen(false) }}
                  className="text-danger"
                />
              </div>
            </div>
          </nav>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="flex-1 pb-20">
        {children}
      </main>

      {/* ボトムナビゲーション (AppSheet ボトムバー再現) */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-lg">
        <div className="flex items-center justify-around h-16">
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  'flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors',
                  isActive ? 'text-primary font-bold' : 'text-muted'
                )}
              >
                <Icon className="w-5 h-5" />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}

function MenuItem({
  label,
  icon,
  active,
  onClick,
  className,
}: {
  label: string
  icon?: ReactNode
  active?: boolean
  onClick: () => void
  className?: string
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-gray-50 transition-colors',
        active && 'bg-blue-50 text-primary font-medium',
        className
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}
