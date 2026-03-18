import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Filter } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isSV, is本社管理者 } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Billing, 請求書ステータス } from '@/types/database'
import { 請求書ステータスLabels, 請求書ステータスValues } from '@/types/database'

const statusColorMap: Record<請求書ステータス, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-indigo-100 text-indigo-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overpaid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-500',
}

export function BillingListPage() {
  const navigate = useNavigate()
  const { employee } = useAuthStore()
  const { 選択拠点 } = useLocationStore()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [statusFilter, setStatusFilter] = useState('')
  const [billings, setBillings] = useState<Billing[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilter, setShowFilter] = useState(false)

  const canCreate = isSV(employee) || is本社管理者(employee)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)

    let query = supabase
      .from('billings')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('billing_year', year)
      .eq('billing_month', month)
      .order('billing_date', { ascending: false })

    if (statusFilter) {
      query = query.eq('status', statusFilter)
    }

    query.then(({ data }) => {
      setBillings((data ?? []) as Billing[])
      setLoading(false)
    })
  }, [選択拠点, year, month, statusFilter])

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
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold">請求管理一覧</h2>
        <div className="flex gap-2">
          <button
            onClick={() => setShowFilter(!showFilter)}
            className={`flex items-center gap-1 text-sm rounded-lg px-3 py-2 ${
              showFilter || statusFilter ? 'bg-primary text-white' : 'bg-gray-100'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
          {canCreate && (
            <button
              onClick={() => navigate('/billing/create')}
              className="flex items-center gap-1 text-sm bg-primary text-white rounded-lg px-3 py-2"
            >
              <Plus className="w-4 h-4" />
              請求書作成
            </button>
          )}
        </div>
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

      {/* Filter panel */}
      {showFilter && (
        <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-16 shrink-0">ステータス</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
            >
              <option value="">すべて</option>
              {請求書ステータスValues.map((s) => (
                <option key={s} value={s}>
                  {請求書ステータスLabels[s]}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : billings.length === 0 ? (
        <div className="text-center py-8 text-muted">
          請求データがありません
        </div>
      ) : (
        <>
          <div className="text-sm text-muted mb-3 text-right">
            {billings.length}件
          </div>

          <div className="space-y-2">
            {billings.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate(`/billing/${b.id}`)}
                className="w-full bg-white rounded-xl shadow-sm p-4 text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-gray-500 font-mono">
                    {b.billing_number}
                  </span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      statusColorMap[b.status] ?? 'bg-gray-100 text-gray-700'
                    }`}
                  >
                    {請求書ステータスLabels[b.status] ?? b.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{b.利用者 ?? '-'}</p>
                    <p className="text-xs text-gray-500">
                      {formatDate(b.billing_date)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{formatCurrency(b.total_amount)}</p>
                    {b.balance > 0 && b.status !== 'draft' && (
                      <p className="text-xs text-red-600">
                        残高: {formatCurrency(b.balance)}
                      </p>
                    )}
                  </div>
                </div>
                {b.paid_amount > 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    入金済: {formatCurrency(b.paid_amount)}
                  </div>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
