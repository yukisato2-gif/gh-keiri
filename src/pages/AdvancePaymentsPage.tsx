import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency } from '@/lib/utils'
import type { User, ResidentBalance } from '@/types/database'

export function AdvancePaymentsPage() {
  const { 選択拠点 } = useLocationStore()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [balances, setBalances] = useState<ResidentBalance[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)

    const loadData = async () => {
      // Fetch all users for this location
      const { data: users } = await supabase
        .from('users')
        .select('*')
        .eq('拠点', 選択拠点)
        .order('利用者')

      const userList = (users ?? []) as User[]

      // Fetch unbilled advance transactions for each user
      const { data: unbilledTx } = await supabase
        .from('transactions')
        .select('利用者, 金額')
        .eq('拠点', 選択拠点)
        .eq('対応種別', '立替金')
        .eq('billing_status', 'unbilled')

      // Fetch unpaid billing balances
      const { data: unpaidBillings } = await supabase
        .from('billings')
        .select('利用者, balance')
        .eq('拠点', 選択拠点)
        .not('status', 'in', '("paid","cancelled")')

      // Aggregate unbilled amounts by user
      const unbilledMap = new Map<string, number>()
      for (const tx of (unbilledTx ?? []) as { 利用者: string; 金額: number }[]) {
        if (!tx.利用者) continue
        unbilledMap.set(tx.利用者, (unbilledMap.get(tx.利用者) ?? 0) + tx.金額)
      }

      // Aggregate unpaid amounts by user
      const unpaidMap = new Map<string, number>()
      for (const b of (unpaidBillings ?? []) as { 利用者: string; balance: number }[]) {
        if (!b.利用者) continue
        unpaidMap.set(b.利用者, (unpaidMap.get(b.利用者) ?? 0) + b.balance)
      }

      // Build balance rows
      const result: ResidentBalance[] = userList.map((u) => {
        const unbilled = unbilledMap.get(u.利用者) ?? 0
        const unpaid = unpaidMap.get(u.利用者) ?? 0
        const total = unbilled + unpaid
        const isOver = u.advance_limit != null && total > u.advance_limit

        return {
          利用者id: u.利用者id,
          利用者: u.利用者,
          advance_limit: u.advance_limit,
          unbilled_amount: unbilled,
          unpaid_amount: unpaid,
          total_balance: total,
          is_over_limit: isOver,
        }
      })

      // Sort: over-limit first, then by total balance descending
      result.sort((a, b) => {
        if (a.is_over_limit !== b.is_over_limit) return a.is_over_limit ? -1 : 1
        return b.total_balance - a.total_balance
      })

      setBalances(result)
      setLoading(false)
    }

    loadData()
  }, [選択拠点, year, month])

  const goMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setYear(y)
    setMonth(m)
  }

  const overLimitCount = balances.filter((b) => b.is_over_limit).length

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">利用者別立替一覧・残高</h2>

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

      {/* Over-limit warning */}
      {overLimitCount > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <span className="text-sm text-red-700 font-medium">
            上限超過: {overLimitCount}名
          </span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : balances.length === 0 ? (
        <div className="text-center py-8 text-muted">
          利用者データがありません
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="text-sm text-muted mb-3 text-right">
            {balances.length}名
          </div>

          {/* Mobile-friendly cards */}
          <div className="space-y-2">
            {balances.map((b) => (
              <div
                key={b.利用者id}
                className={`bg-white rounded-xl shadow-sm p-4 ${
                  b.is_over_limit ? 'border-2 border-red-300' : ''
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">{b.利用者}</span>
                  <div className="flex items-center gap-2">
                    {b.is_over_limit && (
                      <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                        上限超過
                      </span>
                    )}
                    {b.advance_limit != null && (
                      <span className="text-xs text-gray-500">
                        上限: {formatCurrency(b.advance_limit)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <p className="text-xs text-gray-500">未請求額</p>
                    <p className="font-medium">{formatCurrency(b.unbilled_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">未入金額</p>
                    <p className="font-medium">{formatCurrency(b.unpaid_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">総残高</p>
                    <p className={`font-bold ${b.is_over_limit ? 'text-red-600' : ''}`}>
                      {formatCurrency(b.total_balance)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table (hidden on mobile) */}
          <div className="hidden lg:block mt-6">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b text-gray-500">
                  <th className="py-2 px-3">利用者名</th>
                  <th className="py-2 px-3 text-right">立替上限</th>
                  <th className="py-2 px-3 text-right">未請求額</th>
                  <th className="py-2 px-3 text-right">未入金額</th>
                  <th className="py-2 px-3 text-right">総残高</th>
                  <th className="py-2 px-3 text-center">ステータス</th>
                </tr>
              </thead>
              <tbody>
                {balances.map((b) => (
                  <tr
                    key={b.利用者id}
                    className={`border-b ${b.is_over_limit ? 'bg-red-50' : ''}`}
                  >
                    <td className="py-2 px-3 font-medium">{b.利用者}</td>
                    <td className="py-2 px-3 text-right">
                      {b.advance_limit != null ? formatCurrency(b.advance_limit) : '-'}
                    </td>
                    <td className="py-2 px-3 text-right">{formatCurrency(b.unbilled_amount)}</td>
                    <td className="py-2 px-3 text-right">{formatCurrency(b.unpaid_amount)}</td>
                    <td className={`py-2 px-3 text-right font-bold ${b.is_over_limit ? 'text-red-600' : ''}`}>
                      {formatCurrency(b.total_balance)}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {b.is_over_limit ? (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                          上限超過
                        </span>
                      ) : (
                        <span className="rounded-full px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700">
                          正常
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
