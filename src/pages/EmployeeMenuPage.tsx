import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import type { Authority } from '@/types/database'

// AppSheet: 従業員閲覧権限メニュー ダッシュボードビュー再現
// アクセス権限確認 + 従業員アクセス権限一覧 のインラインビュー
export function EmployeeMenuPage() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">従業員閲覧権限メニュー</h2>
      <InlineAccessInfo />
      <InlineAuthorityList />
    </div>
  )
}

// アクセス権限確認 インラインビュー
function InlineAccessInfo() {
  const { employee } = useAuthStore()
  const { myLocations } = useLocationStore()

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">アクセス権限確認</h3>

      {/* ログイン情報 */}
      <div className="space-y-1 text-sm mb-3">
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

      {/* アクセス可能拠点 */}
      <h4 className="font-bold text-xs text-muted mb-2">アクセス可能拠点</h4>
      {myLocations.length === 0 ? (
        <p className="text-sm text-muted">アクセス可能な拠点がありません</p>
      ) : (
        <div className="space-y-1">
          {myLocations.map((loc) => (
            <div key={loc.拠点id} className="border border-border rounded-lg p-2">
              <p className="text-sm font-medium">{loc.拠点}</p>
              <p className="text-xs text-muted">エリア: {loc.エリア名 || loc.エリア}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 従業員アクセス権限一覧 インラインビュー
function InlineAuthorityList() {
  const { 選択拠点 } = useLocationStore()
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('authority')
      .select('*')
      .eq('拠点', 選択拠点)
      .order('従業員')
      .then(({ data }) => {
        setAuthorities((data ?? []) as Authority[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">従業員アクセス権限一覧</h3>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : authorities.length === 0 ? (
        <p className="text-center text-muted py-4">権限データがありません</p>
      ) : (
        <div className="space-y-1">
          {authorities.map((a) => (
            <div key={a.権限id} className="flex items-center justify-between border border-border rounded-lg p-2">
              <span className="text-sm font-medium">{a.従業員}</span>
              <span className="text-xs text-muted">{a.拠点}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
