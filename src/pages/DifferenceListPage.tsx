import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction } from '@/types/database'

// AppSheet: ホーム長 - 差額調整一覧 ビュー再現
export function DifferenceListPage() {
  const { 選択拠点 } = useLocationStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('拠点', 選択拠点)
      .in('対応種別', ['入金', '出金'])
      .order('日付', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">差額調整一覧</h2>
      <p className="text-sm text-muted mb-4">
        過剰金額登録・不足金額登録の一覧です
      </p>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-muted">差額調整記録がありません</div>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <div
              key={t.id}
              className="bg-card rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted">{formatDate(t.日付)}</span>
                  <span
                    className={`text-xs rounded px-1.5 py-0.5 ${
                      t.対応種別 === '入金'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    {t.対応種別}
                  </span>
                </div>
                <span className="font-bold">{formatCurrency(t.金額)}</span>
              </div>
              <div className="mt-1 text-xs text-muted">
                <span>締め: {t.締めステータス}</span>
                <span className="ml-3">作成者: {t.作成者}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
