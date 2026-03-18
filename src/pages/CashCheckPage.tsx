import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { calcCheckTotal } from '@/types/database'
import type { Check } from '@/types/database'

export function CashCheckPage() {
  const navigate = useNavigate()
  const { 選択拠点 } = useLocationStore()
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('checks')
      .select('*')
      .eq('拠点', 選択拠点)
      .order('日付', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setChecks((data ?? []) as Check[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">残高チェック</h2>
        <button
          onClick={() => navigate('/cash-check/new')}
          className="flex items-center gap-1 text-sm bg-primary text-white rounded-lg px-3 py-2"
        >
          <Plus className="w-4 h-4" />
          新規
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : checks.length === 0 ? (
        <div className="text-center py-8 text-muted">残高チェック記録がありません</div>
      ) : (
        <div className="space-y-2">
          {checks.map((c) => {
            const total = calcCheckTotal(c)
            return (
              <div
                key={c.check_id}
                className="bg-card rounded-xl p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted">
                    {formatDate(c.日付)}
                  </span>
                  <span className="font-bold">{formatCurrency(total)}</span>
                </div>
                {c.差額登録済フラグ && (
                  <span className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5 mt-1 inline-block">
                    差額登録済
                  </span>
                )}
                {c.メモ特記事項 && (
                  <p className="text-sm text-muted mt-1">{c.メモ特記事項}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
