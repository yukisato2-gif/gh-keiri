import { Outlet } from 'react-router-dom'
import { Header } from './Header'
import { Sidebar } from './Sidebar'
import { BottomNav } from './BottomNav'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { useAuth } from '@/hooks/useAuth'

export function AppShell() {
  useAuth()

  return (
    <AuthGuard>
      <div className="flex h-screen flex-col bg-background">
        <Header />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
            <div className="mx-auto max-w-5xl p-4 lg:p-6">
              <Outlet />
            </div>
          </main>
        </div>
        <BottomNav />
      </div>
    </AuthGuard>
  )
}
