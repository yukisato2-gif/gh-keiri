import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useTransactions, useCategories, useCurrentLocation, useCanApprove, usePendingCount, useResidents } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { EmptyState } from '@/components/shared/EmptyState'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate } from '@/lib/formatters'
import { TRANSACTION_TYPE_LABELS, INCOME_EXPENSE_LABELS, APPROVAL_STATUS_OPTIONS, BILLING_STATUS_LABELS } from '@/lib/constants'
import type { IncomeExpenseType, TransactionType, ApprovalStatus, BillingStatus } from '@/types/database'
import { Plus, ArrowRightLeft, Search, Clock } from 'lucide-react'

export function TransactionsPage() {
  const { locationId } = useCurrentLocation()
  const { transactions, isLoading } = useTransactions(locationId)
  const categories = useCategories()

  const canApprove = useCanApprove(locationId)
  const pendingCount = usePendingCount(locationId)
  const { residents } = useResidents(locationId)

  const [filterType, setFilterType] = useState<IncomeExpenseType | ''>('')
  const [filterTxType, setFilterTxType] = useState<TransactionType | ''>('')
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | ''>('')
  const [filterBillingStatus, setFilterBillingStatus] = useState<BillingStatus | ''>('')
  const [filterResidentId, setFilterResidentId] = useState('')
  const [searchText, setSearchText] = useState('')

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => !filterType || tx.income_expense === filterType)
      .filter((tx) => !filterTxType || tx.transaction_type === filterTxType)
      .filter((tx) => !filterStatus || tx.approval_status === filterStatus)
      .filter((tx) => !filterBillingStatus || tx.billing_status === filterBillingStatus)
      .filter((tx) => !filterResidentId || tx.resident_id === filterResidentId)
      .filter((tx) => !searchText || tx.description.includes(searchText))
      .sort((a, b) => b.transaction_date.localeCompare(a.transaction_date))
  }, [transactions, filterType, filterTxType, filterStatus, filterBillingStatus, filterResidentId, searchText])

  const getCategoryName = (categoryId: string) =>
    categories.find((c) => c.id === categoryId)?.name ?? ''

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold">入出金記録</h2>
          {canApprove && pendingCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-warning">
              <Clock className="h-3 w-3" />
              承認待ち {pendingCount}件
            </span>
          )}
        </div>
        <Link
          to="/transactions/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          新規記録
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="摘要で検索..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="w-full rounded-md border border-input bg-white py-1.5 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as IncomeExpenseType | '')}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全種別</option>
          <option value="income">入金</option>
          <option value="expense">出金</option>
        </select>
        <select
          value={filterTxType}
          onChange={(e) => setFilterTxType(e.target.value as TransactionType | '')}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全対応種別</option>
          {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as ApprovalStatus | '')}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {APPROVAL_STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterBillingStatus}
          onChange={(e) => setFilterBillingStatus(e.target.value as BillingStatus | '')}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全請求状態</option>
          {Object.entries(BILLING_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
        <select
          value={filterResidentId}
          onChange={(e) => setFilterResidentId(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全利用者</option>
          {residents.filter((r) => r.is_active).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </div>

      {/* Transaction List */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<ArrowRightLeft className="h-10 w-10" />}
            title="入出金記録がありません"
            description="右上の「新規記録」ボタンから入出金を記録できます"
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((tx) => (
              <Link key={tx.id} to={`/transactions/${tx.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer">
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${tx.income_expense === 'income' ? 'bg-income/10 text-income' : 'bg-expense/10 text-expense'}`}>
                  {INCOME_EXPENSE_LABELS[tx.income_expense].charAt(0)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{getCategoryName(tx.category_id)}</span>
                    <StatusBadge status={tx.approval_status} />
                    {tx.transaction_type === 'cash_advance' && tx.billing_status && (
                      <span className={`rounded px-1 py-0.5 text-xs ${
                        tx.billing_status === 'unbilled' ? 'bg-warning/10 text-warning' :
                        tx.billing_status === 'billed' ? 'bg-primary/10 text-primary' :
                        tx.billing_status === 'paid' ? 'bg-income/10 text-income' : 'bg-muted text-muted-foreground'
                      }`}>
                        {BILLING_STATUS_LABELS[tx.billing_status] ?? ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{TRANSACTION_TYPE_LABELS[tx.transaction_type]}</p>
                </div>
                <CurrencyDisplay
                  amount={tx.amount}
                  type={tx.income_expense}
                  className="shrink-0"
                  showSign
                />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
