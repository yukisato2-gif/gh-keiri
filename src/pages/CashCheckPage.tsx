// @ts-nocheck
import { useState, useMemo } from 'react'
import { useTransactions, useCashChecks, useAddCashCheck, useAddTransaction, useCurrentLocation, useCurrentEmployee, useCategories } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { DENOMINATIONS } from '@/lib/constants'
import { formatDate, formatCurrency, toISODate } from '@/lib/formatters'
import type { CashCheck } from '@/types/database'
import { ClipboardCheck, CheckCircle, AlertCircle, Scale, Loader2 } from 'lucide-react'

type DenominationKey = typeof DENOMINATIONS[number]['key']
type DenominationCounts = Record<DenominationKey, number>

const initialCounts: DenominationCounts = Object.fromEntries(
  DENOMINATIONS.map((d) => [d.key, 0])
) as DenominationCounts

export function CashCheckPage() {
  const [tab, setTab] = useState<'new' | 'history' | 'adjustments'>('new')
  const [counts, setCounts] = useState<DenominationCounts>({ ...initialCounts })
  const [checkDate, setCheckDate] = useState(toISODate(new Date()))
  const [notes, setNotes] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [adjustingCheckId, setAdjustingCheckId] = useState<string | null>(null)

  const addCashCheck = useAddCashCheck()
  const addTransaction = useAddTransaction()
  const categories = useCategories()
  const { locationId: currentLocationId } = useCurrentLocation()
  const { transactions, refetch: refetchTransactions } = useTransactions(currentLocationId)
  const { cashChecks, isLoading, refetch: refetchChecks } = useCashChecks(currentLocationId)
  const employee = useCurrentEmployee()

  const totalAmount = useMemo(
    () => DENOMINATIONS.reduce((sum, d) => sum + counts[d.key] * d.value, 0),
    [counts]
  )

  const expectedBalance = useMemo(() => {
    return transactions
      .filter((tx) => tx.transaction_date <= checkDate)
      .reduce((sum, tx) => sum + (tx.income_expense === 'income' ? tx.amount : -tx.amount), 0)
  }, [transactions, checkDate])

  const difference = totalAmount - expectedBalance
  const isMatched = difference === 0

  const locationChecks = cashChecks
    .sort((a, b) => b.check_date.localeCompare(a.check_date))

  // Cash checks with differences for the adjustments tab
  const checksWithDifference = locationChecks.filter((c) => c.difference !== 0)

  const isAdjusted = (check: CashCheck) => {
    return transactions.some(
      (tx) =>
        (tx.transaction_type === 'shortage_entry' || tx.transaction_type === 'surplus_entry') &&
        tx.description === `残高チェック差額調整 (${check.check_date})`
    )
  }

  const handleCountChange = (key: DenominationKey, value: string) => {
    const num = parseInt(value, 10)
    setCounts((prev) => ({ ...prev, [key]: isNaN(num) || num < 0 ? 0 : num }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await addCashCheck({
      location_id: currentLocationId,
      check_date: checkDate,
      ...counts,
      expected_balance: expectedBalance,
      checked_by: employee.id,
      notes: notes.trim() || null,
    })

    if (error) {
      console.error('Failed to save cash check:', error)
      return
    }

    setCounts({ ...initialCounts })
    setNotes('')
    setSubmitted(true)
    refetchChecks()
    setTimeout(() => setSubmitted(false), 3000)
  }

  const handleAdjustment = async (check: CashCheck) => {
    setAdjustingCheckId(check.id)
    const isShortage = check.difference < 0
    const txType = isShortage ? 'shortage_entry' : 'surplus_entry'
    const category = categories.find((c) => c.transaction_type === txType)

    if (!category) {
      console.error('Adjustment category not found')
      setAdjustingCheckId(null)
      return
    }

    const { error } = await addTransaction({
      location_id: check.location_id,
      transaction_date: check.check_date,
      transaction_type: txType,
      income_expense: isShortage ? 'expense' : 'income',
      category_id: category.id,
      resident_id: null,
      description: `残高チェック差額調整 (${check.check_date})`,
      amount: Math.abs(check.difference),
      receipt_image_path: null,
      notes: `実査額: ${formatCurrency(check.total_amount)}, 帳簿残高: ${formatCurrency(check.expected_balance ?? 0)}, 差額: ${formatCurrency(check.difference)}`,
      recorded_by: employee.id,
      approval_status: 'draft',
      approved_by: null,
      approved_at: null,
      rejection_reason: null,
    })

    if (error) {
      console.error('Failed to create adjustment:', error)
    } else {
      refetchTransactions()
    }
    setAdjustingCheckId(null)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">残高チェック</h2>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg border border-border bg-muted p-1">
        {([['new', '新規チェック'], ['history', 'チェック履歴'], ['adjustments', '差額調整']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* New Check Tab */}
      {tab === 'new' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {submitted && (
            <div className="flex items-center gap-2 rounded-lg border border-income/30 bg-income/10 p-3">
              <CheckCircle className="h-4 w-4 text-income" />
              <p className="text-sm font-medium text-income">残高チェックを保存しました</p>
            </div>
          )}

          {/* Date */}
          <div className="rounded-lg border border-border bg-card p-4">
            <label className="mb-1.5 block text-sm font-medium">チェック日</label>
            <input
              type="date"
              value={checkDate}
              onChange={(e) => setCheckDate(e.target.value)}
              max={toISODate(new Date())}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Denomination Inputs */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-medium">金種別枚数入力</h3>
              <p className="text-xs text-muted-foreground">ホーム金庫＋手提げ金庫の合算値を入力</p>
            </div>
            <div className="divide-y divide-border">
              {DENOMINATIONS.map((d) => (
                <div key={d.key} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-sm font-medium w-24">{d.label}</span>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={counts[d.key] || ''}
                      onChange={(e) => handleCountChange(d.key, e.target.value)}
                      placeholder="0"
                      className="w-20 rounded-md border border-input px-2 py-1.5 text-right text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <span className="text-xs text-muted-foreground">枚</span>
                    <span className="w-24 text-right text-sm tabular-nums text-muted-foreground">
                      {formatCurrency(counts[d.key] * d.value)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Balance Summary */}
          <div className={`rounded-lg border-2 p-4 ${isMatched ? 'border-income/30 bg-income/5' : 'border-expense/30 bg-expense/5'}`}>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">実査合計金額</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">帳簿残高</span>
                <span className="text-lg font-bold tabular-nums">{formatCurrency(expectedBalance)}</span>
              </div>
              <hr className="border-border" />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">差額</span>
                <CurrencyDisplay
                  amount={Math.abs(difference)}
                  type={difference === 0 ? 'neutral' : difference > 0 ? 'income' : 'expense'}
                  className="text-lg font-bold"
                  showSign={difference !== 0}
                />
              </div>
              <div className="flex items-center gap-2 pt-1">
                {isMatched ? (
                  <>
                    <CheckCircle className="h-5 w-5 text-income" />
                    <span className="text-sm font-medium text-income">残高が一致しています</span>
                  </>
                ) : (
                  <>
                    <AlertCircle className="h-5 w-5 text-expense" />
                    <span className="text-sm font-medium text-expense">
                      残高が一致していません（{difference > 0 ? '過剰' : '不足'}: {formatCurrency(Math.abs(difference))}）
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="rounded-lg border border-border bg-card p-4">
            <label className="mb-1.5 block text-sm font-medium">メモ/特記事項</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={!isMatched ? 'ネクストアクションを記入してください' : '補足事項があれば入力'}
              className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            チェック結果を保存
          </button>
        </form>
      )}

      {/* History Tab */}
      {tab === 'history' && (
        <div className="rounded-lg border border-border bg-card">
          {locationChecks.length === 0 ? (
            <EmptyState
              icon={<ClipboardCheck className="h-10 w-10" />}
              title="チェック履歴がありません"
            />
          ) : (
            <div className="divide-y divide-border">
              {locationChecks.map((check) => (
                <div key={check.id} className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{formatDate(check.check_date)}</span>
                    {check.difference === 0 ? (
                      <span className="flex items-center gap-1 text-xs text-income">
                        <CheckCircle className="h-3.5 w-3.5" /> 一致
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-xs text-expense">
                        <AlertCircle className="h-3.5 w-3.5" /> 不一致
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
                    <span>実査: {formatCurrency(check.total_amount)}</span>
                    <span>帳簿: {formatCurrency(check.expected_balance ?? 0)}</span>
                    {check.difference !== 0 && (
                      <span className="text-expense">差額: {formatCurrency(Math.abs(check.difference))}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Adjustments Tab */}
      {tab === 'adjustments' && (
        <div className="rounded-lg border border-border bg-card">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : checksWithDifference.length === 0 ? (
            <EmptyState
              icon={<Scale className="h-10 w-10" />}
              title="差額のあるチェックはありません"
              description="残高チェックで差額が発生した場合、ここで調整できます"
            />
          ) : (
            <div className="divide-y divide-border">
              {checksWithDifference.map((check) => {
                const adjusted = isAdjusted(check)
                const isAdjusting = adjustingCheckId === check.id
                return (
                  <div key={check.id} className="px-4 py-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">{formatDate(check.check_date)}</span>
                      {adjusted ? (
                        <span className="rounded bg-income/10 px-2 py-0.5 text-xs font-medium text-income">調整済み</span>
                      ) : (
                        <span className="rounded bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">未調整</span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">実査額</span>
                        <p className="font-medium tabular-nums">{formatCurrency(check.total_amount)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">帳簿残高</span>
                        <p className="font-medium tabular-nums">{formatCurrency(check.expected_balance ?? 0)}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">差額</span>
                        <p className={`font-medium tabular-nums ${check.difference > 0 ? 'text-income' : 'text-expense'}`}>
                          {check.difference > 0 ? '+' : ''}{formatCurrency(check.difference)}
                        </p>
                      </div>
                    </div>
                    {check.notes && (
                      <p className="text-xs text-muted-foreground">メモ: {check.notes}</p>
                    )}
                    {!adjusted && (
                      <button
                        onClick={() => handleAdjustment(check)}
                        disabled={isAdjusting}
                        className="inline-flex items-center gap-1.5 rounded-md border border-primary px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 disabled:opacity-50"
                      >
                        {isAdjusting ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            処理中...
                          </>
                        ) : (
                          <>
                            <Scale className="h-3.5 w-3.5" />
                            差額調整を登録（{check.difference < 0 ? '不足金' : '過剰金'}）
                          </>
                        )}
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
