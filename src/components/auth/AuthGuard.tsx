import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/authStore'
import { supabase } from '@/lib/supabase'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { signOut } from '@/hooks/useAuth'
import { AlertCircle, LogOut } from 'lucide-react'

interface AuthGuardProps {
  children: React.ReactNode
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { employee, isLoading, session } = useAuthStore()

  // Demo mode: skip auth
  if (!supabase) {
    return <>{children}</>
  }

  // Loading
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <LoadingSpinner size="lg" />
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        </div>
      </div>
    )
  }

  // Not authenticated
  if (!session) {
    return <Navigate to="/login" replace />
  }

  // Authenticated but no employee record
  if (!employee) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm space-y-4 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-warning" />
          <h2 className="text-lg font-bold">アカウント未登録</h2>
          <p className="text-sm text-muted-foreground">
            このGoogleアカウントに紐づく従業員レコードが見つかりません。
            システム管理者に連絡してアカウント登録を依頼してください。
          </p>
          <button
            onClick={signOut}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
