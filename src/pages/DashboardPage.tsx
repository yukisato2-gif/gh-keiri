import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions, useCashChecks, useCurrentLocation, useCanApprove, usePendingCount, useAdvancePayments, useOutstandingBillings, useMonthlyClose } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate, formatCurrency } from '@/lib/formatters'
import { TRANSACTION_TYPE_LABELS, INCOME_EXPENSE_LABELS } from '@/lib/constants'
import { ArrowRightLeft, TrendingUp, TrendingDown, Wallet, ClipboardCheck, Plus, Clock, Receipt, AlertTriangle, Lock } from 'lucide-react'
import { Calendar } from '@/components/shared/Calendar'

export function DashboardPage() {
  const { locationId } = useCurrentLocation()
  const { transactions, isLoading: txLoading } = useTransactions(locationId)
  const { cashChecks, isLoading: checkLoading } = useCashChecks(locationId)
  const canApprove = useCanApprove(locationId)
  const pendingCount = usePendingCount(locationId)
  const now = new Date()
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const { transactions: advancePayments } = useAdvancePayments(locationId, currentYm)
  const { billings: outstandingBillings } = useOutstandingBillings(locationId)
  const monthlyClose = useMonthlyClose(locationId, currentYm)

  const locationTransactions = transactions

  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const transactionDates = useMemo(
    () => new Set(locationTransactions.map((tx) => tx.transaction_date)),
    [locationTransactions]
  )

  const selectedDateTransactions = useMemo(() => {
    if (!selectedDate) return []
    return locationTransactions
      .filter((tx) => tx.transaction_date === selectedDate)
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
  }, [selectedDate, locationTransactions])

  const summary = useMemo(() => {
    const income = locationTransactions
      .filter((tx) => tx.income_expense === 'income')
      .reduce((sum, tx) => sum + tx.amount, 0)
    const expense = locationTransactions
      .filter((tx) => tx.income_expense === 'expense')
      .reduce((sum, tx) => sum + tx.amount, 0)
    return { income, expense, balance: income - expense }
  }, [locationTransactions])

  const lastCheck = useMemo(
    () => cashChecks.sort((a, b) => b.check_date.localeCompare(a.check_date))[0],
    [cashChecks]
  )

  if (txLoading || checkLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  const unbilledAdvances = advancePayments.filter((tx) => tx.billing_status === 'unbilled')
  const unbilledCount = unbilledAdvances.length
  const unbilledAmount = unbilledAdvances.reduce((sum, tx) => sum + tx.amount, 0)
  const totalOutstanding = outstandingBillings.reduce((sum, b) => sum + (b.balance ?? (b.total_amount + (b.carried_over_amount ?? 0) - b.paid_amount)), 0)

  const recentTransactions = locationTransactions
    .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">ダッシュボード</h2>
        <Link
          to="/transactions/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          入出金記録
        </Link>
      </div>

      {/* Calendar */}
      <Calendar
        transactionDates={transactionDates}
        selectedDate={selectedDate}
        onDateSelect={setSelectedDate}
      />

      {/* Selected Date Transactions */}
      {selectedDate && (
        selectedDateTransactions.length > 0 ? (
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="text-sm font-medium">{formatDate(selectedDate)} の取引</h3>
            </div>
            <div className="divide-y divide-border">
              {selectedDateTransactions.map((tx) => (
                <Link key={tx.id} to={`/transactions/${tx.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{INCOME_EXPENSE_LABELS[tx.income_expense]}</span>
                      <StatusBadge status={tx.approval_status} />
                    </div>
                    <p className="mt-0.5 truncate text-sm">{tx.description}</p>
                  </div>
                  <CurrencyDisplay amount={tx.amount} type={tx.income_expense} className="ml-3 text-sm" showSign />
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {formatDate(selectedDate)} の取引はありません
          </div>
        )
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4 text-income" />
            今月入金
          </div>
          <CurrencyDisplay amount={summary.income} type="income" className="mt-1 text-lg lg:text-xl" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingDown className="h-4 w-4 text-expense" />
            今月出金
          </div>
          <CurrencyDisplay amount={summary.expense} type="expense" className="mt-1 text-lg lg:text-xl" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet className="h-4 w-4 text-primary" />
            現在残高
          </div>
          <p className="mt-1 text-lg font-bold lg:text-xl">{formatCurrency(summary.balance)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ClipboardCheck className="h-4 w-4" />
            最終チェック
          </div>
          <p className="mt-1 text-lg font-bold lg:text-xl">
            {lastCheck ? formatDate(lastCheck.check_date) : '未実施'}
          </p>
          {lastCheck && lastCheck.difference !== 0 && (
            <p className="text-xs text-expense">差額: {formatCurrency(lastCheck.difference)}</p>
          )}
        </div>
      </div>

      {/* Pending Approval Card */}
      {canApprove && pendingCount > 0 && (
        <Link
          to="/transactions?status=pending"
          className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 hover:bg-warning/20 transition-colors"
        >
          <Clock className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium">承認待ちの取引が {pendingCount}件 あります</p>
            <p className="text-xs text-muted-foreground">クリックして確認する</p>
          </div>
        </Link>
      )}

      {/* Unbilled Advance Payments Alert */}
      {unbilledCount > 0 && (
        <Link
          to="/advance-payments"
          className="flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/10 p-3 hover:bg-primary/20 transition-colors"
        >
          <Receipt className="h-5 w-5 text-primary" />
          <div>
            <p className="text-sm font-medium">未請求の立替金が {unbilledCount}件（{formatCurrency(unbilledAmount)}）あります</p>
            <p className="text-xs text-muted-foreground">クリックして確認する</p>
          </div>
        </Link>
      )}

      {/* Outstanding Billings Alert */}
      {outstandingBillings.length > 0 && (
        <Link
          to="/billing/outstanding"
          className="flex items-center gap-3 rounded-lg border border-expense/30 bg-expense/10 p-3 hover:bg-expense/20 transition-colors"
        >
          <AlertTriangle className="h-5 w-5 text-expense" />
          <div>
            <p className="text-sm font-medium">
              未収の請求書が {outstandingBillings.length}件（{formatCurrency(totalOutstanding)}）あります
            </p>
            <p className="text-xs text-muted-foreground">クリックして確認する</p>
          </div>
        </Link>
      )}

      {/* Monthly Close Status */}
      {monthlyClose && monthlyClose.status === 'modified' && (
        <Link
          to="/monthly-close"
          className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-3 hover:bg-warning/20 transition-colors"
        >
          <Lock className="h-5 w-5 text-warning" />
          <div>
            <p className="text-sm font-medium">今月の締め後に修正が発生しています（{monthlyClose.modification_count}回）</p>
            <p className="text-xs text-muted-foreground">SV再確認が必要です</p>
          </div>
        </Link>
      )}

      {/* Alert Banner */}
      {lastCheck && lastCheck.difference !== 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
          <p className="text-sm font-medium text-warning">
            残高不一致が検出されています。差額: {formatCurrency(Math.abs(lastCheck.difference))}
          </p>
        </div>
      )}

      {/* Recent Transactions */}
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 className="font-medium flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4" />
            最近の入出金
          </h3>
          <Link to="/transactions" className="text-sm text-primary hover:underline">すべて表示</Link>
        </div>
        <div className="divide-y divide-border">
          {recentTransactions.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">入出金記録がありません</p>
          ) : (
            recentTransactions.map((tx) => (
              <Link key={tx.id} to={`/transactions/${tx.id}`} className="flex items-center justify-between px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {INCOME_EXPENSE_LABELS[tx.income_expense]}
                    </span>
                    <StatusBadge status={tx.approval_status} />
                  </div>
                  <p className="mt-0.5 truncate text-sm">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{TRANSACTION_TYPE_LABELS[tx.transaction_type]}</p>
                </div>
                <CurrencyDisplay
                  amount={tx.amount}
                  type={tx.income_expense}
                  className="ml-3 text-sm"
                  showSign
                />
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
