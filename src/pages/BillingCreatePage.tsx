import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, FileText, CheckSquare, Square } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, generateId } from '@/lib/utils'
import type { Transaction } from '@/types/database'

interface UserBillingGroup {
  利用者: string
  transactions: Transaction[]
  totalAmount: number
  selected: boolean
}

export function BillingCreatePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { 選択拠点 } = useLocationStore()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [groups, setGroups] = useState<UserBillingGroup[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [result, setResult] = useState<{ success: boolean; count: number } | null>(null)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)

    const loadUnbilled = async () => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('拠点', 選択拠点)
        .eq('対応種別', '立替金')
        .eq('billing_status', 'unbilled')
        .eq('billing_year', year)
        .eq('billing_month', month)
        .order('利用者')
        .order('日付')

      const txList = (data ?? []) as Transaction[]

      // Group by user
      const map = new Map<string, Transaction[]>()
      for (const tx of txList) {
        const key = tx.利用者 ?? '(不明)'
        if (!map.has(key)) map.set(key, [])
        map.get(key)!.push(tx)
      }

      const grouped: UserBillingGroup[] = Array.from(map.entries()).map(
        ([利用者, transactions]) => ({
          利用者,
          transactions,
          totalAmount: transactions.reduce((sum, t) => sum + t.金額, 0),
          selected: true,
        })
      )

      setGroups(grouped)
      setLoading(false)
    }

    loadUnbilled()
  }, [選択拠点, year, month])

  const toggleSelect = (index: number) => {
    setGroups((prev) =>
      prev.map((g, i) => (i === index ? { ...g, selected: !g.selected } : g))
    )
  }

  const toggleAll = () => {
    const allSelected = groups.every((g) => g.selected)
    setGroups((prev) => prev.map((g) => ({ ...g, selected: !allSelected })))
  }

  const selectedGroups = groups.filter((g) => g.selected)
  const totalSelected = selectedGroups.reduce((sum, g) => sum + g.totalAmount, 0)

  // Generate billing number: INV-YYYYMM-XXXX
  const generateBillingNumber = (index: number): string => {
    const ym = `${year}${String(month).padStart(2, '0')}`
    const seq = String(index + 1).padStart(4, '0')
    return `INV-${ym}-${seq}`
  }

  const handleCreate = async () => {
    if (!選択拠点 || !user?.email || selectedGroups.length === 0) return
    setCreating(true)
    setShowConfirm(false)

    try {
      // Get existing billing count for this month to set sequence numbers
      const { count: existingCount } = await supabase
        .from('billings')
        .select('*', { count: 'exact', head: true })
        .eq('拠点', 選択拠点)
        .eq('billing_year', year)
        .eq('billing_month', month)

      const startSeq = (existingCount ?? 0)

      for (let i = 0; i < selectedGroups.length; i++) {
        const group = selectedGroups[i]
        const billingId = generateId()
        const billingNumber = generateBillingNumber(startSeq + i)
        const today = new Date().toISOString().split('T')[0]

        // Create billing record
        await supabase.from('billings').insert({
          id: billingId,
          billing_number: billingNumber,
          拠点: 選択拠点,
          利用者: group.利用者,
          billing_year: year,
          billing_month: month,
          billing_date: today,
          total_amount: group.totalAmount,
          carried_over_amount: 0,
          paid_amount: 0,
          balance: group.totalAmount,
          status: 'draft',
          created_by: user.email,
        })

        // Create billing items for each transaction
        const items = group.transactions.map((tx) => ({
          id: generateId(),
          billing_id: billingId,
          transaction_id: tx.id,
          amount: tx.金額,
        }))

        await supabase.from('billing_items').insert(items)

        // Update transaction billing status
        const txIds = group.transactions.map((tx) => tx.id)
        await supabase
          .from('transactions')
          .update({
            billing_status: 'billed',
            billing_id: billingId,
            更新日時: new Date().toISOString(),
            更新者: user.email,
          })
          .in('id', txIds)
      }

      setResult({ success: true, count: selectedGroups.length })
    } catch {
      setResult({ success: false, count: 0 })
    } finally {
      setCreating(false)
    }
  }

  const goMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setYear(y)
    setMonth(m)
  }

  return (
    <div className="p-4">
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/billing')}
          className="bg-gray-100 rounded-lg p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold">請求書作成</h2>
      </div>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4 mb-4">
        <button
          onClick={() => goMonth(-1)}
          className="bg-gray-100 text-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          &lt; 前月
        </button>
        <span className="text-lg font-bold">
          {year}年{month}月
        </span>
        <button
          onClick={() => goMonth(1)}
          className="bg-gray-100 text-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          翌月 &gt;
        </button>
      </div>

      {/* Success result */}
      {result && (
        <div
          className={`rounded-xl p-4 mb-4 ${
            result.success
              ? 'bg-green-50 border border-green-200'
              : 'bg-red-50 border border-red-200'
          }`}
        >
          {result.success ? (
            <div>
              <p className="font-medium text-green-700">
                {result.count}件の請求書を作成しました
              </p>
              <button
                onClick={() => navigate('/billing')}
                className="mt-2 text-sm text-primary underline"
              >
                請求一覧へ戻る
              </button>
            </div>
          ) : (
            <p className="font-medium text-red-700">
              請求書の作成に失敗しました。もう一度お試しください。
            </p>
          )}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : groups.length === 0 ? (
        <div className="text-center py-8 text-muted">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>未請求の立替取引はありません</p>
          <p className="text-xs mt-1">
            {year}年{month}月の対象データがありません
          </p>
        </div>
      ) : (
        <>
          {/* Select all */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={toggleAll}
              className="text-sm text-primary font-medium"
            >
              {groups.every((g) => g.selected) ? '全選択解除' : '全選択'}
            </button>
            <span className="text-sm text-muted">
              {selectedGroups.length} / {groups.length}名選択
            </span>
          </div>

          {/* User groups */}
          <div className="space-y-2 mb-4">
            {groups.map((g, index) => (
              <button
                key={g.利用者}
                onClick={() => toggleSelect(index)}
                className={`w-full bg-white rounded-xl shadow-sm p-4 text-left border-2 transition-colors ${
                  g.selected ? 'border-primary bg-blue-50' : 'border-transparent'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {g.selected ? (
                      <CheckSquare className="w-5 h-5 text-primary" />
                    ) : (
                      <Square className="w-5 h-5 text-gray-300" />
                    )}
                    <span className="font-medium">{g.利用者}</span>
                  </div>
                  <span className="font-bold">{formatCurrency(g.totalAmount)}</span>
                </div>
                <p className="text-sm text-gray-500 ml-7 mt-1">
                  {g.transactions.length}件の取引
                </p>
              </button>
            ))}
          </div>

          {/* Summary and create button */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-gray-500">選択利用者数</span>
              <span className="font-medium">{selectedGroups.length}名</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500">合計金額</span>
              <span className="text-lg font-bold">{formatCurrency(totalSelected)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={selectedGroups.length === 0 || creating}
            className="w-full bg-primary text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
          >
            {creating ? '作成中...' : `一括作成 (${selectedGroups.length}件)`}
          </button>
        </>
      )}

      {/* Confirmation dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3">請求書作成の確認</h3>
            <p className="text-sm text-gray-600 mb-4">
              以下の内容で請求書を作成します。よろしいですか？
            </p>
            <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
              <p>対象月: {year}年{month}月</p>
              <p>利用者数: {selectedGroups.length}名</p>
              <p>合計金額: {formatCurrency(totalSelected)}</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-4 py-2"
              >
                キャンセル
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-primary text-white rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {creating ? '作成中...' : '作成する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
