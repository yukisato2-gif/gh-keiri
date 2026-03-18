import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import type { Transaction } from '@/types/database'

export function SVClosingPage() {
  const { user } = useAuthStore()
  const { 選択拠点 } = useLocationStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    // 未締めの入出金記録を取得
    supabase
      .from('transactions')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('締めステータス', '未')
      .order('日付', { ascending: false })
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点])

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selectedIds.size === transactions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(transactions.map((t) => t.id)))
    }
  }

  // SV締めアクション (AppSheet: 締めステータス="済" に更新)
  const handleClose = async () => {
    if (selectedIds.size === 0) return
    const now = new Date().toISOString()
    const ids = Array.from(selectedIds)

    await supabase
      .from('transactions')
      .update({
        締めステータス: '済',
        更新日時: now,
        更新者: user?.email,
      })
      .in('id', ids)

    // 締め済みのものを一覧から除外
    setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)))
    setSelectedIds(new Set())
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">SV - 入出金締め</h2>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : transactions.length === 0 ? (
        <div className="text-center py-8 text-muted">
          未締めの入出金記録はありません
        </div>
      ) : (
        <>
          {/* 操作バー */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={selectAll}
              className="text-sm text-primary font-medium"
            >
              {selectedIds.size === transactions.length
                ? '全選択解除'
                : `全選択 (${transactions.length}件)`}
            </button>
            <span className="text-sm text-muted">
              {selectedIds.size}件選択中
            </span>
          </div>

          {/* 一覧 */}
          <div className="space-y-2 mb-4">
            {transactions.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleSelect(t.id)}
                className={`w-full bg-card rounded-xl p-4 shadow-sm text-left border-2 transition-colors ${
                  selectedIds.has(t.id)
                    ? 'border-primary bg-blue-50'
                    : 'border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        selectedIds.has(t.id)
                          ? 'bg-primary border-primary'
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedIds.has(t.id) && (
                        <span className="text-white text-xs">✓</span>
                      )}
                    </div>
                    <span className="text-xs text-muted">
                      {formatDate(t.日付)}
                    </span>
                    <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">
                      {t.対応種別}
                    </span>
                    {t.修正依頼フラグ && (
                      <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                        修正依頼
                      </span>
                    )}
                  </div>
                  <span
                    className={`font-bold text-sm ${
                      is入金(t.対応種別) ? 'text-success' : 'text-danger'
                    }`}
                  >
                    {is入金(t.対応種別) ? '+' : '-'}
                    {formatCurrency(t.金額)}
                  </span>
                </div>
                <p className="text-sm mt-1 ml-7">{t.摘要カテゴリ}</p>
              </button>
            ))}
          </div>

          {/* 締めボタン */}
          <button
            onClick={handleClose}
            disabled={selectedIds.size === 0}
            className="w-full bg-green-600 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
          >
            SV締め ({selectedIds.size}件)
          </button>
        </>
      )}
    </div>
  )
}
