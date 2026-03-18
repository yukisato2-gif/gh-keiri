import { useNavigate } from 'react-router-dom'
import { MapPin, Check } from 'lucide-react'
import { useLocationStore } from '@/stores/locationStore'

// AppSheet: USERSETTINGS("選択拠点") による拠点切替を再現
export function LocationSelectPage() {
  const navigate = useNavigate()
  const { 選択拠点, myLocations, set選択拠点 } = useLocationStore()

  const handleSelect = (拠点id: string) => {
    set選択拠点(拠点id)
    navigate('/')
  }

  // エリアごとにグルーピング
  const grouped = myLocations.reduce<Record<string, typeof myLocations>>(
    (acc, loc) => {
      const area = loc.エリア名 || loc.エリア || '未分類'
      if (!acc[area]) acc[area] = []
      acc[area]!.push(loc)
      return acc
    },
    {}
  )

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">拠点選択</h2>
      <p className="text-sm text-muted mb-4">
        操作する拠点を選択してください
      </p>

      {Object.entries(grouped).map(([area, locations]) => (
        <div key={area} className="mb-4">
          <h3 className="text-sm font-bold text-muted mb-2">{area}</h3>
          <div className="space-y-2">
            {locations.map((loc) => (
              <button
                key={loc.拠点id}
                onClick={() => handleSelect(loc.拠点id)}
                className={`w-full flex items-center justify-between bg-card rounded-xl p-4 shadow-sm border-2 transition-colors ${
                  選択拠点 === loc.拠点id
                    ? 'border-primary bg-blue-50'
                    : 'border-transparent'
                }`}
              >
                <div className="flex items-center gap-3">
                  <MapPin className="w-5 h-5 text-muted" />
                  <span className="font-medium">{loc.拠点}</span>
                </div>
                {選択拠点 === loc.拠点id && (
                  <Check className="w-5 h-5 text-primary" />
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
