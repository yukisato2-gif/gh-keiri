import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatDate } from '@/lib/utils'
import type { MOU } from '@/types/database'

// AppSheet: ホーム長 - 覚書取得一覧 ビュー再現
export function MOUListPage() {
  const { 選択拠点 } = useLocationStore()
  const [mous, setMous] = useState<MOU[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('mous')
      .select('*')
      .eq('拠点', 選択拠点)
      .order('作成日時', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setMous((data ?? []) as MOU[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">覚書取得一覧</h2>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : mous.length === 0 ? (
        <div className="text-center py-8 text-muted">覚書がありません</div>
      ) : (
        <div className="space-y-2">
          {mous.map((m) => (
            <div
              key={m.覚書id}
              className="bg-card rounded-xl p-4 shadow-sm"
            >
              <p className="font-medium">{m.利用者}</p>
              <div className="text-xs text-muted mt-1">
                <span>拠点: {m.拠点}</span>
                <span className="ml-3">
                  作成: {formatDate(m.作成日時, 'yyyy/MM/dd')}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
