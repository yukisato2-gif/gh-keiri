import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import type { Transaction } from '@/types/database'

// AppSheet: 本社管理者 - 出納帳 ビュー再現
// 全拠点横断の残高サマリー
export function AllLocationLedgerPage() {
  const navigate = useNavigate()
  const { locations } = useLocationStore()
  const [summaries, setSummaries] = useState<
    { 拠点id: string; 拠点名: string; 入金: number; 出金: number; 残高: number; 件数: number }[]
  >([])
  const [loading, setLoading] = useState(true)
  const [yearMonth, setYearMonth] = useState(() => {
    const now = new Date()
    return now.getFullYear() * 100 + (now.getMonth() + 1)
  })

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('transactions')
        .select('拠点, 金額, 対応種別')
        .eq('年月', yearMonth)

      const txs = (data ?? []) as unknown as Pick<Transaction, '拠点' | '金額' | '対応種別'>[]

      // 拠点ごとに集計
      const map = new Map<string, { 入金: number; 出金: number; 件数: number }>()
      for (const t of txs) {
        if (!map.has(t.拠点)) map.set(t.拠点, { 入金: 0, 出金: 0, 件数: 0 })
        const s = map.get(t.拠点)!
        if (is入金(t.対応種別)) {
          s.入金 += t.金額
        } else {
          s.出金 += t.金額
        }
        s.件数++
      }

      const result = locations.map((loc) => {
        const s = map.get(loc.拠点id) ?? { 入金: 0, 出金: 0, 件数: 0 }
        return {
          拠点id: loc.拠点id,
          拠点名: loc.拠点,
          入金: s.入金,
          出金: s.出金,
          残高: s.入金 - s.出金,
          件数: s.件数,
        }
      })

      setSummaries(result)
      setLoading(false)
    }

    fetchAll()
  }, [locations, yearMonth])

  const formatYM = (ym: number) => `${Math.floor(ym / 100)}年${ym % 100}月`

  const totalIncome = summaries.reduce((s, r) => s + r.入金, 0)
  const totalExpense = summaries.reduce((s, r) => s + r.出金, 0)

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">出納帳（全拠点）</h2>
      <p className="text-sm text-muted mb-4">{formatYM(yearMonth)}</p>

      {/* 月切替 */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => {
            const m = yearMonth % 100
            if (m === 1) setYearMonth((Math.floor(yearMonth / 100) - 1) * 100 + 12)
            else setYearMonth(yearMonth - 1)
          }}
          className="text-sm bg-gray-100 rounded-lg px-3 py-1.5"
        >
          前月
        </button>
        <button
          onClick={() => {
            const m = yearMonth % 100
            if (m === 12) setYearMonth((Math.floor(yearMonth / 100) + 1) * 100 + 1)
            else setYearMonth(yearMonth + 1)
          }}
          className="text-sm bg-gray-100 rounded-lg px-3 py-1.5"
        >
          翌月
        </button>
      </div>

      {/* 全体サマリー */}
      <div className="bg-card rounded-xl shadow-sm p-4 mb-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted">入金合計</p>
            <p className="font-bold text-success">{formatCurrency(totalIncome)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">出金合計</p>
            <p className="font-bold text-danger">{formatCurrency(totalExpense)}</p>
          </div>
          <div>
            <p className="text-xs text-muted">差引残高</p>
            <p className="font-bold">{formatCurrency(totalIncome - totalExpense)}</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => (
            <button
              key={s.拠点id}
              onClick={() => {
                useLocationStore.getState().set選択拠点(s.拠点id)
                navigate('/transactions')
              }}
              className="w-full bg-card rounded-xl p-4 shadow-sm text-left"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{s.拠点名}</span>
                <span className={`font-bold ${s.残高 >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(s.残高)}
                </span>
              </div>
              <div className="flex items-center gap-4 mt-1 text-xs text-muted">
                <span>入金: {formatCurrency(s.入金)}</span>
                <span>出金: {formatCurrency(s.出金)}</span>
                <span>{s.件数}件</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
