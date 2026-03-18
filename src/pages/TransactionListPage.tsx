import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Download, Plus, FileText, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import { generate入出金明細PDF } from '@/lib/pdfReport'
import type { Transaction } from '@/types/database'
import { 請求ステータスLabels } from '@/types/database'

type SortField = '日付' | '対応種別' | '金額' | '利用者' | '締めステータス'
type SortDir = 'asc' | 'desc'

interface FilterState {
  dateFrom: string
  dateTo: string
  対応種別: string
  締めステータス: string
  billing_status: string  // 経理拡張: 請求ステータスフィルタ
}

const emptyFilter: FilterState = { dateFrom: '', dateTo: '', 対応種別: '', 締めステータス: '', billing_status: '' }

export function TransactionListPage() {
  const navigate = useNavigate()
  const { 選択拠点 } = useLocationStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [sortField, setSortField] = useState<SortField>('日付')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [filter, setFilter] = useState<FilterState>(emptyFilter)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('拠点', 選択拠点)
      .order('日付', { ascending: false })
      .order('作成日時', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点])

  const hasActiveFilter = filter.dateFrom || filter.dateTo || filter.対応種別 || filter.締めステータス || filter.billing_status

  const filteredAndSorted = useMemo(() => {
    let list = [...transactions]
    // Filter
    if (filter.dateFrom) list = list.filter((t) => t.日付 >= filter.dateFrom)
    if (filter.dateTo) list = list.filter((t) => t.日付 <= filter.dateTo)
    if (filter.対応種別) list = list.filter((t) => t.対応種別 === filter.対応種別)
    if (filter.締めステータス) list = list.filter((t) => t.締めステータス === filter.締めステータス)
    if (filter.billing_status) list = list.filter((t) => t.billing_status === filter.billing_status)
    // Sort
    list.sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ja')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [transactions, filter, sortField, sortDir])

  // CSV出力 (AppSheet の CSV出力アクション再現)
  const handleCSVExport = () => {
    if (transactions.length === 0) return
    const headers = ['日付', '対応種別', '摘要カテゴリ', '金額', '利用者', '摘要', '締めステータス']
    const rows = transactions.map((t) => [
      t.日付,
      t.対応種別,
      t.摘要カテゴリ,
      String(t.金額),
      t.利用者 ?? '',
      t.摘要 ?? '',
      t.締めステータス,
    ])
    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n')
    const bom = '\uFEFF'
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `入出金記録_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">入出金一覧確認</h2>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (transactions.length === 0) return
              const now = new Date()
              const ym = `${now.getFullYear()}年${now.getMonth() + 1}月`
              const loc = useLocationStore.getState()
              const locName = loc.myLocations.find((l) => l.拠点id === loc.選択拠点)?.拠点 ?? ''
              generate入出金明細PDF(transactions, {
                拠点名: locName,
                対象年月: ym,
                作成日: now.toLocaleDateString('ja-JP'),
              })
            }}
            className="flex items-center gap-1 text-sm bg-gray-100 rounded-lg px-3 py-2"
          >
            <FileText className="w-4 h-4" />
            PDF
          </button>
          <button
            onClick={handleCSVExport}
            className="flex items-center gap-1 text-sm bg-gray-100 rounded-lg px-3 py-2"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button
            onClick={() => navigate('/transactions/new')}
            className="flex items-center gap-1 text-sm bg-primary text-white rounded-lg px-3 py-2"
          >
            <Plus className="w-4 h-4" />
            新規
          </button>
          <button
            onClick={() => setShowFilterPanel(!showFilterPanel)}
            className={`relative flex items-center gap-1 text-sm rounded-lg px-3 py-2 ${
              showFilterPanel ? 'bg-primary text-white' : 'bg-gray-100'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            {hasActiveFilter && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* フィルター・ソートパネル (AppSheet再現) */}
      {showFilterPanel && (
        <div className="bg-card rounded-xl p-4 shadow-sm mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">フィルター・ソート</span>
            {hasActiveFilter && (
              <button
                onClick={() => setFilter(emptyFilter)}
                className="text-xs text-primary flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                フィルター解除
              </button>
            )}
          </div>

          {/* ソート */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted w-12 shrink-0">並替</span>
            <select
              value={sortField}
              onChange={(e) => setSortField(e.target.value as SortField)}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
            >
              <option value="日付">日付</option>
              <option value="対応種別">対応種別</option>
              <option value="金額">金額</option>
              <option value="利用者">利用者</option>
              <option value="締めステータス">締めステータス</option>
            </select>
            <button
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              className="text-sm border rounded-lg px-3 py-1.5 bg-white"
            >
              {sortDir === 'asc' ? '↑ 昇順' : '↓ 降順'}
            </button>
          </div>

          {/* 日付フィルター */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted w-12 shrink-0">日付</span>
            <input
              type="date"
              value={filter.dateFrom}
              onChange={(e) => setFilter({ ...filter, dateFrom: e.target.value })}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
              placeholder="開始日"
            />
            <span className="text-muted">〜</span>
            <input
              type="date"
              value={filter.dateTo}
              onChange={(e) => setFilter({ ...filter, dateTo: e.target.value })}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
              placeholder="終了日"
            />
          </div>

          {/* 対応種別フィルター */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted w-12 shrink-0">種別</span>
            <select
              value={filter.対応種別}
              onChange={(e) => setFilter({ ...filter, 対応種別: e.target.value })}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
            >
              <option value="">すべて</option>
              <option value="立替金">立替金</option>
              <option value="本社入金">本社入金</option>
              <option value="入金">入金</option>
              <option value="出金">出金</option>
              <option value="手数料">手数料</option>
              <option value="資金移動">資金移動</option>
            </select>
          </div>

          {/* 締めステータスフィルター */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted w-12 shrink-0">締め</span>
            <select
              value={filter.締めステータス}
              onChange={(e) => setFilter({ ...filter, 締めステータス: e.target.value })}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
            >
              <option value="">すべて</option>
              <option value="未">未</option>
              <option value="済">済</option>
            </select>
          </div>

          {/* 経理拡張: 請求ステータスフィルター */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted w-12 shrink-0">請求</span>
            <select
              value={filter.billing_status}
              onChange={(e) => setFilter({ ...filter, billing_status: e.target.value })}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
            >
              <option value="">すべて</option>
              <option value="unbilled">未請求</option>
              <option value="billed">請求済</option>
              <option value="paid">入金済</option>
              <option value="partial">一部入金</option>
              <option value="carried_over">繰越</option>
            </select>
          </div>

          <div className="text-xs text-muted text-right">
            {filteredAndSorted.length} / {transactions.length} 件
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : filteredAndSorted.length === 0 ? (
        <div className="text-center py-8 text-muted">
          {transactions.length === 0 ? '入出金記録がありません' : 'フィルター条件に一致する記録がありません'}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredAndSorted.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/transactions/${t.id}`)}
              className="w-full bg-card rounded-xl p-4 shadow-sm text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted">
                    {formatDate(t.日付)}
                  </span>
                  <TypeBadge type={t.対応種別} />
                  {t.締めステータス === '済' && (
                    <span className="text-xs bg-green-100 text-green-700 rounded px-1.5 py-0.5">
                      済
                    </span>
                  )}
                  {t.修正依頼フラグ && (
                    <span className="text-xs bg-red-100 text-red-700 rounded px-1.5 py-0.5">
                      修正依頼
                    </span>
                  )}
                  {t.billing_status && t.billing_status !== 'unbilled' && (
                    <BillingStatusBadge status={t.billing_status} />
                  )}
                </div>
                <span
                  className={`font-bold ${
                    is入金(t.対応種別) ? 'text-success' : 'text-danger'
                  }`}
                >
                  {is入金(t.対応種別) ? '+' : '-'}
                  {formatCurrency(t.金額)}
                </span>
              </div>
              <div className="mt-1 text-sm">
                <span className="text-gray-800">{t.摘要カテゴリ}</span>
                {t.摘要 && (
                  <span className="text-muted ml-2">{t.摘要}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function BillingStatusBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    billed: 'bg-indigo-100 text-indigo-700',
    paid: 'bg-green-100 text-green-700',
    partial: 'bg-amber-100 text-amber-700',
    carried_over: 'bg-gray-200 text-gray-600',
  }
  const label = 請求ステータスLabels[status as keyof typeof 請求ステータスLabels] ?? status
  return (
    <span className={`text-xs rounded px-1.5 py-0.5 ${colorMap[status] ?? 'bg-gray-100 text-gray-700'}`}>
      {label}
    </span>
  )
}

function TypeBadge({ type }: { type: string }) {
  const colorMap: Record<string, string> = {
    立替金: 'bg-blue-100 text-blue-700',
    本社入金: 'bg-green-100 text-green-700',
    入金: 'bg-emerald-100 text-emerald-700',
    出金: 'bg-orange-100 text-orange-700',
    手数料: 'bg-yellow-100 text-yellow-700',
    資金移動: 'bg-purple-100 text-purple-700',
  }
  return (
    <span
      className={`text-xs rounded px-1.5 py-0.5 ${colorMap[type] ?? 'bg-gray-100 text-gray-700'}`}
    >
      {type}
    </span>
  )
}
