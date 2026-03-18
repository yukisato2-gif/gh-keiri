import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Location } from '@/types/database'

interface LocationState {
  selectedLocation: Location | null
  authorizedLocations: Location[]
  setSelectedLocation: (location: Location | null) => void
  setAuthorizedLocations: (locations: Location[]) => void
}

export const useLocationStore = create<LocationState>()(
  persist(
    (set) => ({
      selectedLocation: null,
      authorizedLocations: [],
      setSelectedLocation: (selectedLocation) => set({ selectedLocation }),
      setAuthorizedLocations: (authorizedLocations) => set({ authorizedLocations }),
    }),
    {
      name: 'gh-suitocho-location',
      partialize: (state) => ({ selectedLocation: state.selectedLocation }),
    }
  )
)
