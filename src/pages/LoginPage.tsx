import { useAuthStore } from '@/stores/authStore'

export function LoginPage() {
  const { signInWithGoogle } = useAuthStore()

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-sm bg-card rounded-xl shadow-lg p-8 text-center">
        <div className="mb-6">
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mb-4">
            <span className="text-white text-2xl font-bold">経</span>
          </div>
          <h1 className="text-2xl font-bold">GH経理</h1>
          <p className="text-muted text-sm mt-1">グループホーム経理・立替精算管理</p>
        </div>
        <button
          onClick={signInWithGoogle}
          className="w-full bg-primary text-white rounded-lg px-4 py-3 font-medium hover:bg-primary-dark transition-colors"
        >
          Googleアカウントでログイン
        </button>
      </div>
    </div>
  )
}
