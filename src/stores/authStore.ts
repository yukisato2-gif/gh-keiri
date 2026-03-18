import { create } from 'zustand'
import type { Session } from '@supabase/supabase-js'
import type { Employee } from '@/types/database'

interface AuthState {
  employee: Employee | null
  session: Session | null
  isLoading: boolean
  setEmployee: (employee: Employee | null) => void
  setSession: (session: Session | null) => void
  setLoading: (loading: boolean) => void
}

export const useAuthStore = create<AuthState>((set) => ({
  employee: null,
  session: null,
  isLoading: true,
  setEmployee: (employee) => set({ employee }),
  setSession: (session) => set({ session }),
  setLoading: (isLoading) => set({ isLoading }),
}))
