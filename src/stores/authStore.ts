import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { Employee } from '@/types/database'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  employee: Employee | null
  loading: boolean
  initialize: () => Promise<void>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, _get) => ({
  user: null,
  session: null,
  employee: null,
  loading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      set({ user: session.user, session })
      // 従業員情報を取得
      const { data: emp } = await supabase
        .from('employees')
        .select('*')
        .eq('メールアドレス', session.user.email)
        .single()
      set({ employee: emp as Employee | null, loading: false })
    } else {
      set({ loading: false })
    }

    // Auth state listener
    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ user: session?.user ?? null, session })
      if (session?.user) {
        const { data: emp } = await supabase
          .from('employees')
          .select('*')
          .eq('メールアドレス', session.user.email)
          .single()
        set({ employee: emp as Employee | null })
      } else {
        set({ employee: null })
      }
    })
  },

  signInWithGoogle: async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, employee: null })
  },
}))

// 本社管理者かどうか
export function is本社管理者(employee: Employee | null): boolean {
  return employee?.役職 === '本社管理者'
}

// SVかどうか
export function isSV(employee: Employee | null): boolean {
  return employee?.役職 === 'SV'
}

// ホーム長かどうか
export function isホーム長(employee: Employee | null): boolean {
  return employee?.役職 === 'ホーム長'
}
