import { useLocationStore } from '@/stores/locationStore'
import { useCurrentEmployee, useCurrentLocation } from '@/hooks/useAppData'
import { signOut } from '@/hooks/useAuth'
import { ROLE_LABELS } from '@/lib/constants'
import { BookOpen, ChevronDown, LogOut } from 'lucide-react'
import { NotificationBell } from '@/components/notifications/NotificationBell'

export function Header() {
  const currentEmployee = useCurrentEmployee()
  const { locations } = useCurrentLocation()
  const { selectedLocation, setSelectedLocation } = useLocationStore()

  const currentLocation = selectedLocation ?? locations[0]

  const handleLogout = async () => {
    await signOut()
  }

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-white px-4 lg:px-6">
      <div className="flex items-center gap-2">
        <BookOpen className="h-5 w-5 text-primary" />
        <h1 className="text-lg font-bold text-foreground hidden sm:block">GH経理</h1>
      </div>

      <div className="relative ml-auto flex items-center gap-3">
        <div className="relative">
          <select
            value={currentLocation?.id ?? ''}
            onChange={(e) => {
              const loc = locations.find((l) => l.id === e.target.value)
              if (loc) setSelectedLocation(loc)
            }}
            className="appearance-none rounded-md border border-border bg-white py-1.5 pl-3 pr-8 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>{loc.name}</option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>

        <NotificationBell />

        <div className="hidden items-center gap-2 sm:flex">
          <div className="text-right">
            <p className="text-sm font-medium">{currentEmployee.name}</p>
            <p className="text-xs text-muted-foreground">{ROLE_LABELS[currentEmployee.role]}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted"
            title="ログアウト"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  )
}
