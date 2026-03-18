import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { supabase } from '@/lib/supabase'
import type { Location, Authority } from '@/types/database'

interface LocationState {
  // USERSETTINGS("選択拠点") に相当
  選択拠点: string | null
  locations: Location[]
  myLocations: Location[] // 権限に基づくアクセス可能拠点
  authorities: Authority[]
  loading: boolean
  set選択拠点: (拠点id: string | null) => void
  loadLocations: (email: string, is本社管理者: boolean) => Promise<void>
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set, _get) => ({
      選択拠点: null,
      locations: [],
      myLocations: [],
      authorities: [],
      loading: true,

      set選択拠点: (拠点id) => set({ 選択拠点: 拠点id }),

      loadLocations: async (email, is本社管理者) => {
        // 全拠点を取得（エリア名をJOIN）
        const { data: allLocations } = await supabase
          .from('locations')
          .select('*, areas!エリア(エリア)')
          .order('拠点id')

        const locations = ((allLocations ?? []) as unknown as Record<string, unknown>[]).map((loc: Record<string, unknown>) => ({
          ...loc,
          エリア名: (loc.areas as { エリア: string } | null)?.エリア ?? loc.エリア,
        })) as Location[]

        if (is本社管理者) {
          // 本社管理者は全拠点アクセス可
          set({ locations, myLocations: locations, loading: false })
        } else {
          // Authority テーブルから自分の権限拠点を取得
          const { data: auths } = await supabase
            .from('authority')
            .select('*')
            .eq('従業員', email)

          const authorities = (auths ?? []) as Authority[]
          const myLocationIds = authorities.map((a) => a.拠点)
          const myLocations = locations.filter((l) =>
            myLocationIds.includes(l.拠点id)
          )

          set({ locations, myLocations, authorities, loading: false })
        }
      },
    }),
    {
      name: 'gh-keiri-location',
      partialize: (state) => ({ 選択拠点: state.選択拠点 }),
    }
  )
)
