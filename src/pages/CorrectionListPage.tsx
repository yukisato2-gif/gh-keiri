import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/database'

export function CorrectionListPage() {
  const navigate = useNavigate()
  const { 選択拠点 } = useLocationStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    // MyBranchTransactions_Correction スライス再現: 修正依頼フラグ=TRUE
    supabase
      .from('transactions')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('修正依頼フラグ', true)
      .order('修正依頼日時', { ascending: false })
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">修正依頼一覧</h2>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-muted">
          修正依頼中の記録はありません
        </div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/transactions/${t.id}`)}
              className="w-full bg-card rounded-xl p-4 shadow-sm text-left border-l-4 border-warning"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">
                  {formatDate(t.日付)}
                </span>
                <span className="font-bold text-sm">
                  {formatCurrency(t.金額)}
                </span>
              </div>
              <p className="text-sm font-medium mt-1">{t.摘要カテゴリ}</p>
              <div className="mt-2 bg-yellow-50 rounded p-2">
                <p className="text-xs text-muted">修正依頼内容:</p>
                <p className="text-sm">{t.修正依頼内容}</p>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-xs text-muted">
                  依頼者: {t.修正依頼者}
                </span>
                {t.修正依頼日時 && (
                  <span className="text-xs text-muted">
                    {formatDate(t.修正依頼日時, 'MM/dd HH:mm')}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
