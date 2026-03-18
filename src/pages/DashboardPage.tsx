import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import { calcCheckTotal } from '@/types/database'
import type { Transaction, Check } from '@/types/database'

interface DashboardFilter {
  対応種別: string
  締めステータス: string
}

const emptyDashboardFilter: DashboardFilter = { 対応種別: '', 締めステータス: '' }

type DashboardSortField = '日付' | '対応種別' | '金額'
type DashboardSortDir = 'asc' | 'desc'

// AppSheet ダッシュボード再現: カレンダー + 残高 + 残高チェック のインラインビュー
export function DashboardPage() {
  const { 選択拠点, myLocations } = useLocationStore()
  const navigate = useNavigate()
  const [showFilterPanel, setShowFilterPanel] = useState(false)
  const [filter, setFilter] = useState<DashboardFilter>(emptyDashboardFilter)
  const [sortField, setSortField] = useState<DashboardSortField>('日付')
  const [sortDir, setSortDir] = useState<DashboardSortDir>('desc')

  const hasActiveFilter = filter.対応種別 || filter.締めステータス

  // 拠点未選択の場合は拠点選択へ
  useEffect(() => {
    if (!選択拠点 && myLocations.length > 0) {
      if (myLocations.length === 1) {
        useLocationStore.getState().set選択拠点(myLocations[0]!.拠点id)
      } else {
        navigate('/location-select')
      }
    }
  }, [選択拠点, myLocations, navigate])

  return (
    <div className="p-4 space-y-4">
      {/* ヘッダー行: タイトル + ソートアイコン */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">ダッシュボード</h2>
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

      {/* フィルター・ソートパネル */}
      {showFilterPanel && (
        <div className="bg-card rounded-xl p-4 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm">フィルター・ソート</span>
            {hasActiveFilter && (
              <button
                onClick={() => setFilter(emptyDashboardFilter)}
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
              onChange={(e) => setSortField(e.target.value as DashboardSortField)}
              className="text-sm border rounded-lg px-2 py-1.5 flex-1"
            >
              <option value="日付">日付</option>
              <option value="対応種別">対応種別</option>
              <option value="金額">金額</option>
            </select>
            <button
              onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
              className="text-sm border rounded-lg px-3 py-1.5 bg-white"
            >
              {sortDir === 'asc' ? '↑ 昇順' : '↓ 降順'}
            </button>
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
        </div>
      )}

      {/* 2カラムレイアウト (PC: 横並び, モバイル: 縦並び) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* 左: カレンダー (大きめ) */}
        <div className="lg:col-span-2">
          <InlineCalendar filter={filter} sortField={sortField} sortDir={sortDir} />
        </div>

        {/* 右: 残高 + 残高チェック */}
        <div className="space-y-4">
          <InlineBalance />
          <InlineCashCheckList />
        </div>
      </div>
    </div>
  )
}

// === カレンダー インラインビュー ===
function InlineCalendar({ filter, sortField, sortDir }: {
  filter: DashboardFilter
  sortField: DashboardSortField
  sortDir: DashboardSortDir
}) {
  const { 選択拠点 } = useLocationStore()
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  const yearMonth = year * 100 + month

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('年月', yearMonth)
      .order('日付')
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点, yearMonth])

  // フィルター・ソート適用
  const filtered = useMemo(() => {
    let list = [...transactions]
    if (filter.対応種別) list = list.filter((t) => t.対応種別 === filter.対応種別)
    if (filter.締めステータス) list = list.filter((t) => t.締めステータス === filter.締めステータス)
    list.sort((a, b) => {
      const av = a[sortField] ?? ''
      const bv = b[sortField] ?? ''
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv), 'ja')
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [transactions, filter, sortField, sortDir])

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) }
    else setMonth(month + 1)
  }

  // 日ごとにグループ化 (フィルター適用後)
  const byDay = new Map<number, Transaction[]>()
  for (const t of filtered) {
    const day = new Date(t.日付).getDate()
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(t)
  }

  // カレンダーグリッド生成
  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()
  const weeks: (number | null)[][] = []
  let week: (number | null)[] = Array(firstDay).fill(null)
  for (let d = 1; d <= daysInMonth; d++) {
    week.push(d)
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">カレンダー</h3>

      {/* 月切替 */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={prevMonth} className="p-1">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold">{year}年{month}月</span>
        <button onClick={nextMonth} className="p-1">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : (
        <>
          {/* 曜日ヘッダー */}
          <div className="grid grid-cols-7 text-center text-xs font-bold text-muted border-b border-border">
            {['日', '月', '火', '水', '木', '金', '土'].map((d) => (
              <div key={d} className={`py-2 ${d === '日' ? 'text-red-500' : d === '土' ? 'text-blue-500' : ''}`}>
                {d}
              </div>
            ))}
          </div>

          {/* 日グリッド */}
          {weeks.map((w, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0">
              {w.map((day, di) => {
                const dayTx = day ? byDay.get(day) ?? [] : []
                const income = dayTx.filter((t) => is入金(t.対応種別)).reduce((s, t) => s + t.金額, 0)
                const expense = dayTx.filter((t) => !is入金(t.対応種別)).reduce((s, t) => s + t.金額, 0)
                const isToday = day === new Date().getDate() && month === new Date().getMonth() + 1 && year === new Date().getFullYear()

                return (
                  <div
                    key={di}
                    className={`min-h-[56px] p-1 border-r border-border last:border-r-0 ${
                      !day ? 'bg-gray-50' : ''
                    } ${isToday ? 'bg-blue-50' : ''}`}
                  >
                    {day && (
                      <>
                        <div className={`text-xs font-medium ${
                          di === 0 ? 'text-red-500' : di === 6 ? 'text-blue-500' : ''
                        }`}>
                          {day}
                        </div>
                        {dayTx.length > 0 && (
                          <div className="mt-0.5 space-y-0.5">
                            {income > 0 && (
                              <div className="text-[10px] text-success truncate">
                                +{formatCurrency(income)}
                              </div>
                            )}
                            {expense > 0 && (
                              <div className="text-[10px] text-danger truncate">
                                -{formatCurrency(expense)}
                              </div>
                            )}
                            <div className="text-[10px] text-muted">
                              {dayTx.length}件
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          ))}

          {/* 月次サマリー */}
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-xs text-muted">入金</p>
              <p className="font-bold text-success text-sm">
                {formatCurrency(filtered.filter((t) => is入金(t.対応種別)).reduce((s, t) => s + t.金額, 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">出金</p>
              <p className="font-bold text-danger text-sm">
                {formatCurrency(filtered.filter((t) => !is入金(t.対応種別)).reduce((s, t) => s + t.金額, 0))}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">件数</p>
              <p className="font-bold text-sm">
                {filtered.length}{filtered.length !== transactions.length ? ` / ${transactions.length}` : ''}件
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// === 残高 インラインビュー ===
function InlineBalance() {
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

        let balance = 0
        for (const t of txs) {
          if (is入金(t.対応種別)) balance += t.金額
          else balance -= t.金額
        }
        setTotalBalance(balance)

        const map = new Map<number, { 入金: number; 出金: number }>()
        for (const t of txs) {
          if (!map.has(t.年月)) map.set(t.年月, { 入金: 0, 出金: 0 })
          const s = map.get(t.年月)!
          if (is入金(t.対応種別)) s.入金 += t.金額
          else s.出金 += t.金額
        }

        const monthly = Array.from(map.entries())
          .sort((a, b) => b[0] - a[0])
          .slice(0, 3)
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
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">残高</h3>

      {/* 現在残高 */}
      <div className="text-center mb-3">
        <p className="text-xs text-muted">現在の残高</p>
        <p className={`text-2xl font-bold mt-1 ${totalBalance >= 0 ? 'text-success' : 'text-danger'}`}>
          {loading ? '...' : formatCurrency(totalBalance)}
        </p>
      </div>

      {/* 直近の月別推移 */}
      {!loading && monthlyData.length > 0 && (
        <div className="space-y-2 border-t border-border pt-2">
          {monthlyData.map((m) => (
            <div key={m.年月} className="flex items-center justify-between text-sm">
              <span className="text-muted">{formatYM(m.年月)}</span>
              <span className={`font-bold ${m.残高 >= 0 ? 'text-success' : 'text-danger'}`}>
                {formatCurrency(m.残高)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// === 残高チェック インラインビュー ===
function InlineCashCheckList() {
  const navigate = useNavigate()
  const { 選択拠点 } = useLocationStore()
  const [checks, setChecks] = useState<Check[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('checks')
      .select('*')
      .eq('拠点', 選択拠点)
      .order('日付', { ascending: false })
      .limit(5)
      .then(({ data }) => {
        setChecks((data ?? []) as Check[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">残高チェック</h3>
        <button
          onClick={() => navigate('/cash-check/new')}
          className="flex items-center gap-1 text-xs bg-primary text-white rounded-lg px-2 py-1"
        >
          <Plus className="w-3 h-3" />
          追加
        </button>
      </div>

      {loading ? (
        <p className="text-center text-muted text-sm py-4">読み込み中...</p>
      ) : checks.length === 0 ? (
        <p className="text-center text-muted text-sm py-4">記録なし</p>
      ) : (
        <div className="space-y-2">
          {checks.map((c) => {
            const total = calcCheckTotal(c)
            return (
              <div key={c.check_id} className="border border-border rounded-lg p-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted">{formatDate(c.日付)}</span>
                  <span className="font-bold text-sm">{formatCurrency(total)}</span>
                </div>
                {c.差額登録済フラグ && (
                  <span className="text-[10px] bg-green-100 text-green-700 rounded px-1 py-0.5 mt-1 inline-block">
                    差額登録済
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
