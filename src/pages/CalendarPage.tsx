import { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import type { Transaction } from '@/types/database'

// AppSheet カレンダービュー再現
export function CalendarPage() {
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

  const prevMonth = () => {
    if (month === 1) { setYear(year - 1); setMonth(12) }
    else setMonth(month - 1)
  }
  const nextMonth = () => {
    if (month === 12) { setYear(year + 1); setMonth(1) }
    else setMonth(month + 1)
  }

  // 日ごとにグループ化
  const byDay = new Map<number, Transaction[]>()
  for (const t of transactions) {
    const day = new Date(t.日付).getDate()
    if (!byDay.has(day)) byDay.set(day, [])
    byDay.get(day)!.push(t)
  }

  // カレンダーグリッド生成
  const firstDay = new Date(year, month - 1, 1).getDay() // 0=日
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
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">カレンダー</h2>

      {/* 月切替 */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={prevMonth} className="p-2">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-lg">{year}年{month}月</span>
        <button onClick={nextMonth} className="p-2">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : (
        <div className="bg-card rounded-xl shadow-sm overflow-hidden">
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
                    className={`min-h-[60px] p-1 border-r border-border last:border-r-0 ${
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
        </div>
      )}

      {/* 月次サマリー */}
      <div className="mt-4 bg-card rounded-xl shadow-sm p-4">
        <h3 className="font-bold text-sm mb-2">月次サマリー</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted">入金</p>
            <p className="font-bold text-success text-sm">
              {formatCurrency(transactions.filter((t) => is入金(t.対応種別)).reduce((s, t) => s + t.金額, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">出金</p>
            <p className="font-bold text-danger text-sm">
              {formatCurrency(transactions.filter((t) => !is入金(t.対応種別)).reduce((s, t) => s + t.金額, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted">件数</p>
            <p className="font-bold text-sm">{transactions.length}件</p>
          </div>
        </div>
      </div>
    </div>
  )
}
