import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'

// AppSheet: アクセス権限確認 ビュー再現
export function AccessInfoPage() {
  const { employee } = useAuthStore()
  const { myLocations, authorities: _authorities } = useLocationStore()

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">アクセス権限確認</h2>

      {/* 自分の情報 */}
      <div className="bg-card rounded-xl shadow-sm p-4 mb-4">
        <h3 className="font-bold text-sm mb-2">ログイン情報</h3>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">従業員名</span>
            <span className="font-medium">{employee?.従業員名 ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">メールアドレス</span>
            <span className="font-medium">{employee?.メールアドレス ?? '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">役職</span>
            <span className="font-medium">{employee?.役職 ?? '-'}</span>
          </div>
        </div>
      </div>

      {/* アクセス可能拠点 */}
      <div className="bg-card rounded-xl shadow-sm p-4">
        <h3 className="font-bold text-sm mb-2">アクセス可能拠点</h3>
        {myLocations.length === 0 ? (
          <p className="text-sm text-muted">アクセス可能な拠点がありません</p>
        ) : (
          <div className="space-y-2">
            {myLocations.map((loc) => (
              <div
                key={loc.拠点id}
                className="border border-border rounded-lg p-3"
              >
                <p className="font-medium text-sm">{loc.拠点}</p>
                <p className="text-xs text-muted">
                  エリア: {loc.エリア名 || loc.エリア}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
