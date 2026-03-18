import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import type { Transaction } from '@/types/database'

// AppSheet: 残高 ビュー再現
export function BalanceSummaryPage() {
  const { 選択拠点 } = useLocationStore()
  const [loading, setLoading] = useState(true)
  const [totalBalance, setTotalBalance] = useState(0)
  const [monthlyData, setMonthlyData] = useState<
    { 年月: number; 入金: number; 出金: number; 残高: number }[]
  >([])

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)

    supabase
      .from('transactions')
      .select('年月, 金額, 対応種別')
      .eq('拠点', 選択拠点)
      .order('年月', { ascending: false })
      .then(({ data }) => {
        const txs = (data ?? []) as unknown as Pick<Transaction, '年月' | '金額' | '対応種別'>[]

        // 全体残高
        let balance = 0
        for (const t of txs) {
          if (is入金(t.対応種別)) balance += t.金額
          else balance -= t.金額
        }
        setTotalBalance(balance)

        // 月別集計
        const map = new Map<number, { 入金: number; 出金: number }>()
        for (const t of txs) {
          if (!map.has(t.年月)) map.set(t.年月, { 入金: 0, 出金: 0 })
          const s = map.get(t.年月)!
          if (is入金(t.対応種別)) s.入金 += t.金額
          else s.出金 += t.金額
        }

        const monthly = Array.from(map.entries())
          .sort((a, b) => b[0] - a[0])
          .map(([ym, s]) => ({
            年月: ym,
            入金: s.入金,
            出金: s.出金,
            残高: s.入金 - s.出金,
          }))

        setMonthlyData(monthly)
        setLoading(false)
      })
  }, [選択拠点])

  const formatYM = (ym: number) => `${Math.floor(ym / 100)}年${ym % 100}月`

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">残高</h2>

      {/* 現在残高 */}
      <div className="bg-card rounded-xl shadow-sm p-6 mb-4 text-center">
        <p className="text-sm text-muted">現在の残高</p>
        <p className={`text-3xl font-bold mt-1 ${totalBalance >= 0 ? 'text-success' : 'text-danger'}`}>
          {loading ? '...' : formatCurrency(totalBalance)}
        </p>
      </div>

      {/* 月別推移 */}
      <h3 className="font-bold text-sm mb-2">月別推移</h3>
      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : monthlyData.length === 0 ? (
        <div className="text-center py-8 text-muted">データがありません</div>
      ) : (
        <div className="space-y-2">
          {monthlyData.map((m) => (
            <div
              key={m.年月}
              className="bg-card rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium text-sm">{formatYM(m.年月)}</span>
                <span className={`font-bold ${m.残高 >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(m.残高)}
                </span>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted">
                <span>入金: {formatCurrency(m.入金)}</span>
                <span>出金: {formatCurrency(m.出金)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
