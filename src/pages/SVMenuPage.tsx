import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import type { Transaction } from '@/types/database'

// AppSheet: SVメニュー ダッシュボードビュー再現
// SV締め一覧 + 修正依頼一覧 のインラインビュー
export function SVMenuPage() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">SVメニュー</h2>
      <InlineSVClosing />
      <InlineCorrectionList />
    </div>
  )
}

// SV締め インラインビュー
function InlineSVClosing() {
  const { user } = useAuthStore()
  const { 選択拠点 } = useLocationStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
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

  const handleClose = async () => {
    if (selectedIds.size === 0) return
    const now = new Date().toISOString()
    const ids = Array.from(selectedIds)
    await supabase
      .from('transactions')
      .update({ 締めステータス: '済', 更新日時: now, 更新者: user?.email })
      .in('id', ids)
    setTransactions((prev) => prev.filter((t) => !selectedIds.has(t.id)))
    setSelectedIds(new Set())
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">SV - 入出金締め</h3>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : transactions.length === 0 ? (
        <p className="text-center text-muted py-4">未締めの入出金記録はありません</p>
      ) : (
        <>
          <div className="flex items-center justify-between mb-2">
            <button onClick={selectAll} className="text-xs text-primary font-medium">
              {selectedIds.size === transactions.length ? '全選択解除' : `全選択 (${transactions.length}件)`}
            </button>
            <span className="text-xs text-muted">{selectedIds.size}件選択中</span>
          </div>

          <div className="space-y-1 max-h-64 overflow-y-auto mb-3">
            {transactions.map((t) => (
              <button
                key={t.id}
                onClick={() => toggleSelect(t.id)}
                className={`w-full flex items-center justify-between rounded-lg p-2 text-left text-sm border ${
                  selectedIds.has(t.id) ? 'border-primary bg-blue-50' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    selectedIds.has(t.id) ? 'bg-primary border-primary' : 'border-gray-300'
                  }`}>
                    {selectedIds.has(t.id) && <span className="text-white text-[10px]">✓</span>}
                  </div>
                  <span className="text-xs text-muted">{formatDate(t.日付)}</span>
                  <span className="text-xs">{t.摘要カテゴリ}</span>
                </div>
                <span className={`font-bold text-xs ${is入金(t.対応種別) ? 'text-success' : 'text-danger'}`}>
                  {is入金(t.対応種別) ? '+' : '-'}{formatCurrency(t.金額)}
                </span>
              </button>
            ))}
          </div>

          <button
            onClick={handleClose}
            disabled={selectedIds.size === 0}
            className="w-full bg-green-600 text-white rounded-lg px-4 py-2 font-medium text-sm disabled:opacity-50"
          >
            SV締め ({selectedIds.size}件)
          </button>
        </>
      )}
    </div>
  )
}

// 修正依頼一覧 インラインビュー
function InlineCorrectionList() {
  const navigate = useNavigate()
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
      .eq('修正依頼フラグ', true)
      .order('修正依頼日時', { ascending: false })
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">修正依頼一覧</h3>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : transactions.length === 0 ? (
        <p className="text-center text-muted py-4">修正依頼中の記録はありません</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/transactions/${t.id}`)}
              className="w-full text-left border-l-4 border-warning rounded-lg p-3 border border-border"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{formatDate(t.日付)}</span>
                <span className="font-bold text-sm">{formatCurrency(t.金額)}</span>
              </div>
              <p className="text-sm mt-1">{t.摘要カテゴリ}</p>
              <p className="text-xs text-muted mt-1 truncate">{t.修正依頼内容}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
