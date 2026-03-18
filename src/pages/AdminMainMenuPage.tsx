import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuthStore, is本社管理者 } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import type { Transaction } from '@/types/database'

// AppSheet: 本社管理者メニュー ダッシュボードビュー再現
// 本社管理者 - 利用者請求 + 本社管理者 - 出納帳 のインラインビュー
export function AdminMainMenuPage() {
  const { employee } = useAuthStore()

  if (!is本社管理者(employee)) {
    return (
      <div className="p-4 text-center text-muted">
        本社管理者のみアクセス可能です
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">本社管理者メニュー</h2>
      <InlineBillingList />
      <InlineLedger />
    </div>
  )
}

// 利用者請求 インラインビュー
interface BillingRecord {
  請求id: string
  利用者: string
  拠点: string
  対象年月: number
  合計金額: number
}

function InlineBillingList() {
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('monthly_billing')
      .select('請求id, 利用者, 拠点, 対象年月, 合計金額')
      .order('対象年月', { ascending: false })
      .limit(50)
      .then(({ data }) => {
        setRecords((data ?? []) as unknown as BillingRecord[])
        setLoading(false)
      })
  }, [])

  const formatYM = (ym: number) => `${Math.floor(ym / 100)}年${ym % 100}月`

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">利用者請求</h3>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : records.length === 0 ? (
        <p className="text-center text-muted py-4">データがありません</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.請求id} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{r.利用者}</span>
                <span className="font-bold text-sm">{formatCurrency(r.合計金額)}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                <span>{formatYM(r.対象年月)}</span>
                <span>拠点: {r.拠点}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 出納帳（全拠点） インラインビュー
function InlineLedger() {
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

      const map = new Map<string, { 入金: number; 出金: number; 件数: number }>()
      for (const t of txs) {
        if (!map.has(t.拠点)) map.set(t.拠点, { 入金: 0, 出金: 0, 件数: 0 })
        const s = map.get(t.拠点)!
        if (is入金(t.対応種別)) s.入金 += t.金額
        else s.出金 += t.金額
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

  const prevMonth = () => {
    const m = yearMonth % 100
    if (m === 1) setYearMonth((Math.floor(yearMonth / 100) - 1) * 100 + 12)
    else setYearMonth(yearMonth - 1)
  }
  const nextMonth = () => {
    const m = yearMonth % 100
    if (m === 12) setYearMonth((Math.floor(yearMonth / 100) + 1) * 100 + 1)
    else setYearMonth(yearMonth + 1)
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">出納帳（全拠点）</h3>

      <div className="flex items-center gap-2 mb-3">
        <button onClick={prevMonth} className="text-xs bg-gray-100 rounded px-2 py-1">前月</button>
        <span className="text-sm font-medium">{formatYM(yearMonth)}</span>
        <button onClick={nextMonth} className="text-xs bg-gray-100 rounded px-2 py-1">翌月</button>
      </div>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : (
        <div className="space-y-2">
          {summaries.map((s) => (
            <button
              key={s.拠点id}
              onClick={() => {
                useLocationStore.getState().set選択拠点(s.拠点id)
                navigate('/transactions')
              }}
              className="w-full text-left border border-border rounded-lg p-3"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{s.拠点名}</span>
                <span className={`font-bold text-sm ${s.残高 >= 0 ? 'text-success' : 'text-danger'}`}>
                  {formatCurrency(s.残高)}
                </span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted">
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
