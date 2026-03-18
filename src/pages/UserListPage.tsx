import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import type { User } from '@/types/database'

// AppSheet: ホーム長 - 利用者 ビュー再現
export function UserListPage() {
  const { 選択拠点 } = useLocationStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('users')
      .select('*')
      .eq('拠点', 選択拠点)
      .order('利用者')
      .then(({ data }) => {
        setUsers((data ?? []) as User[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">利用者一覧</h2>
      <p className="text-sm text-muted mb-4">
        この拠点の利用者一覧です
      </p>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : users.length === 0 ? (
        <div className="text-center py-8 text-muted">利用者がいません</div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.利用者id}
              className="bg-card rounded-xl p-4 shadow-sm"
            >
              <p className="font-medium">{u.利用者}</p>
              <p className="text-sm text-muted">拠点: {u.拠点}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
