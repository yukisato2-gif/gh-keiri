import { useState, useMemo } from 'react'
import { useTransactions, useCategories, useCurrentLocation, useAdvancePayments, useBillings, useResidents } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatCurrency, formatDate } from '@/lib/formatters'
import {
  TRANSACTION_TYPE_LABELS,
  INCOME_EXPENSE_LABELS,
  APPROVAL_STATUS_LABELS,
  BILLING_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
} from '@/lib/constants'
import { ChevronLeft, ChevronRight, Download, Printer, FileBarChart, TrendingUp, TrendingDown, Receipt, FileText } from 'lucide-react'

function getYearMonth(offset: number) {
  const d = new Date()
  d.setMonth(d.getMonth() + offset)
  return { year: d.getFullYear(), month: d.getMonth() + 1 }
}

function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, '0')}`
}

function ymLabel(year: number, month: number) {
  return `${year}年${month}月`
}

type TabType = 'general' | 'advance' | 'billing'

export function ReportsPage() {
  const { locationId } = useCurrentLocation()
  const { transactions, isLoading } = useTransactions(locationId)
  const categories = useCategories()
  const { residents } = useResidents(locationId)

  const [monthOffset, setMonthOffset] = useState(0)
  const [activeTab, setActiveTab] = useState<TabType>('general')
  const { year, month } = getYearMonth(monthOffset)
  const currentYm = ymKey(year, month)

  const { transactions: advanceTx } = useAdvancePayments(locationId, currentYm)
  const { billings } = useBillings(locationId, currentYm)

  const monthlyTx = useMemo(
    () => transactions.filter((tx) => tx.transaction_date.startsWith(currentYm)),
    [transactions, currentYm]
  )

  // Advance payment summary by resident
  const advanceSummary = useMemo(() => {
    const map = new Map<string, { name: string; total: number; unbilled: number; billed: number; paid: number; count: number }>()
    for (const tx of advanceTx) {
      const name = residents.find((r) => r.id === tx.resident_id)?.name ?? '未指定'
      const key = tx.resident_id ?? '__none__'
      const entry = map.get(key) ?? { name, total: 0, unbilled: 0, billed: 0, paid: 0, count: 0 }
      entry.total += tx.amount
      entry.count++
      if (tx.billing_status === 'unbilled') entry.unbilled += tx.amount
      else if (tx.billing_status === 'billed') entry.billed += tx.amount
      else if (tx.billing_status === 'paid' || tx.billing_status === 'partial') entry.paid += tx.amount
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => b.total - a.total)
  }, [advanceTx, residents])

  // Billing summary
  const billingSummary = useMemo(() => {
    const totalAmount = billings.reduce((s, b) => s + b.total_amount, 0)
    const paidAmount = billings.reduce((s, b) => s + b.paid_amount, 0)
    const outstanding = totalAmount - paidAmount
    const byStatus = new Map<string, number>()
    for (const b of billings) {
      byStatus.set(b.status, (byStatus.get(b.status) ?? 0) + 1)
    }
    return { totalAmount, paidAmount, outstanding, count: billings.length, byStatus }
  }, [billings])

  const summary = useMemo(() => {
    const approved = monthlyTx.filter((tx) => tx.approval_status === 'approved')
    const income = approved.filter((tx) => tx.income_expense === 'income').reduce((s, tx) => s + tx.amount, 0)
    const expense = approved.filter((tx) => tx.income_expense === 'expense').reduce((s, tx) => s + tx.amount, 0)
    const totalCount = monthlyTx.length
    const approvedCount = approved.length
    const pendingCount = monthlyTx.filter((tx) => tx.approval_status === 'pending').length
    const draftCount = monthlyTx.filter((tx) => tx.approval_status === 'draft').length
    return { income, expense, balance: income - expense, totalCount, approvedCount, pendingCount, draftCount }
  }, [monthlyTx])

  const categoryBreakdown = useMemo(() => {
    const approved = monthlyTx.filter((tx) => tx.approval_status === 'approved')
    const map = new Map<string, { name: string; income: number; expense: number; count: number }>()

    for (const tx of approved) {
      const cat = categories.find((c) => c.id === tx.category_id)
      const name = cat?.name ?? '未分類'
      const entry = map.get(tx.category_id) ?? { name, income: 0, expense: 0, count: 0 }
      if (tx.income_expense === 'income') entry.income += tx.amount
      else entry.expense += tx.amount
      entry.count++
      map.set(tx.category_id, entry)
    }

    return [...map.values()].sort((a, b) => (b.income + b.expense) - (a.income + a.expense))
  }, [monthlyTx, categories])

  const handleExportCSV = () => {
    const header = ['日付', '入出金区分', '対応種別', 'カテゴリ', '摘要', '金額', '承認状態', '記録者', '備考']
    const rows = monthlyTx
      .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
      .map((tx) => {
        const cat = categories.find((c) => c.id === tx.category_id)
        return [
          tx.transaction_date,
          INCOME_EXPENSE_LABELS[tx.income_expense] ?? tx.income_expense,
          TRANSACTION_TYPE_LABELS[tx.transaction_type] ?? tx.transaction_type,
          cat?.name ?? '',
          tx.description,
          tx.income_expense === 'expense' ? `-${tx.amount}` : String(tx.amount),
          APPROVAL_STATUS_LABELS[tx.approval_status] ?? tx.approval_status,
          tx.recorder?.name ?? '',
          tx.notes ?? '',
        ]
      })

    const bom = '\uFEFF'
    const csv = bom + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `入出金レポート_${currentYm}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-xl font-bold">月次レポート</h2>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            disabled={monthlyTx.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            PDF印刷
          </button>
          <button
            onClick={handleExportCSV}
            disabled={monthlyTx.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download className="h-4 w-4" />
            CSV出力
          </button>
        </div>
      </div>

      {/* Print Header (visible only in print) */}
      <div className="hidden print:block print:mb-4">
        <h1 className="text-xl font-bold text-center">入出金月次レポート</h1>
        <p className="text-center text-sm text-muted-foreground mt-1">{ymLabel(year, month)}</p>
        <p className="text-center text-xs text-muted-foreground">出力日: {new Date().toLocaleDateString('ja-JP')}</p>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-center gap-4 print:hidden">
        <button onClick={() => setMonthOffset((m) => m - 1)} className="rounded-md p-1.5 hover:bg-muted">
          <ChevronLeft className="h-5 w-5" />
        </button>
        <span className="text-lg font-bold min-w-[120px] text-center">{ymLabel(year, month)}</span>
        <button
          onClick={() => setMonthOffset((m) => m + 1)}
          disabled={monthOffset >= 0}
          className="rounded-md p-1.5 hover:bg-muted disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 print:hidden">
        {([
          { key: 'general', label: '入出金', icon: FileBarChart },
          { key: 'advance', label: '立替金', icon: Receipt },
          { key: 'billing', label: '請求', icon: FileText },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === key ? 'bg-white shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Advance Payment Tab */}
      {activeTab === 'advance' && (
        advanceTx.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-10 w-10" />}
            title="データがありません"
            description={`${ymLabel(year, month)}の立替金記録がありません`}
          />
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">立替合計</div>
                <p className="mt-1 text-lg font-bold">{formatCurrency(advanceSummary.reduce((s, r) => s + r.total, 0))}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">未請求</div>
                <p className="mt-1 text-lg font-bold text-warning">{formatCurrency(advanceSummary.reduce((s, r) => s + r.unbilled, 0))}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">件数</div>
                <p className="mt-1 text-lg font-bold">{advanceTx.length}件</p>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-medium">利用者別立替金集計</h3>
              </div>
              <div className="divide-y divide-border">
                <div className="grid grid-cols-5 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>利用者</span>
                  <span className="text-right">合計</span>
                  <span className="text-right">未請求</span>
                  <span className="text-right">請求済</span>
                  <span className="text-right">件数</span>
                </div>
                {advanceSummary.map((row) => (
                  <div key={row.name} className="grid grid-cols-5 gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium">{row.name}</span>
                    <span className="text-right">{formatCurrency(row.total)}</span>
                    <span className="text-right text-warning">{row.unbilled > 0 ? formatCurrency(row.unbilled) : '-'}</span>
                    <span className="text-right text-primary">{row.billed > 0 ? formatCurrency(row.billed) : '-'}</span>
                    <span className="text-right text-muted-foreground">{row.count}件</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}

      {/* Billing Tab */}
      {activeTab === 'billing' && (
        billings.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="データがありません"
            description={`${ymLabel(year, month)}の請求データがありません`}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">請求合計</div>
                <p className="mt-1 text-lg font-bold">{formatCurrency(billingSummary.totalAmount)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">入金済</div>
                <p className="mt-1 text-lg font-bold text-income">{formatCurrency(billingSummary.paidAmount)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">未収</div>
                <p className="mt-1 text-lg font-bold text-expense">{formatCurrency(billingSummary.outstanding)}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-4">
                <div className="text-sm text-muted-foreground">請求件数</div>
                <p className="mt-1 text-lg font-bold">{billingSummary.count}件</p>
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  {[...billingSummary.byStatus.entries()].map(([status, count]) => (
                    <span key={status}>{INVOICE_STATUS_LABELS[status] ?? status} {count}</span>
                  ))}
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-medium">請求書一覧</h3>
              </div>
              <div className="divide-y divide-border">
                {billings.map((b) => (
                  <div key={b.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{b.billing_number}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">{INVOICE_STATUS_LABELS[b.status] ?? b.status}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{b.resident?.name ?? '-'}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold tabular-nums">{formatCurrency(b.total_amount)}</p>
                      {b.paid_amount > 0 && (
                        <p className="text-xs text-income">入金: {formatCurrency(b.paid_amount)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )
      )}

      {/* General Tab (existing content) */}
      {activeTab === 'general' && (monthlyTx.length === 0 ? (
        <EmptyState
          icon={<FileBarChart className="h-10 w-10" />}
          title="データがありません"
          description={`${ymLabel(year, month)}の入出金記録がありません`}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingUp className="h-4 w-4 text-income" />
                入金合計
              </div>
              <CurrencyDisplay amount={summary.income} type="income" className="mt-1 text-lg" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <TrendingDown className="h-4 w-4 text-expense" />
                出金合計
              </div>
              <CurrencyDisplay amount={summary.expense} type="expense" className="mt-1 text-lg" />
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">収支</div>
              <p className={`mt-1 text-lg font-bold ${summary.balance >= 0 ? 'text-income' : 'text-expense'}`}>
                {formatCurrency(summary.balance)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-4">
              <div className="text-sm text-muted-foreground">取引件数</div>
              <p className="mt-1 text-lg font-bold">{summary.totalCount}件</p>
              <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                {summary.approvedCount > 0 && <span>承認済 {summary.approvedCount}</span>}
                {summary.pendingCount > 0 && <span className="text-warning">待ち {summary.pendingCount}</span>}
                {summary.draftCount > 0 && <span>下書き {summary.draftCount}</span>}
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          {categoryBreakdown.length > 0 && (
            <div className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="font-medium">カテゴリ別集計（承認済みのみ）</h3>
              </div>
              <div className="divide-y divide-border">
                {/* Header row */}
                <div className="grid grid-cols-4 gap-2 px-4 py-2 text-xs font-medium text-muted-foreground">
                  <span>カテゴリ</span>
                  <span className="text-right">入金</span>
                  <span className="text-right">出金</span>
                  <span className="text-right">件数</span>
                </div>
                {categoryBreakdown.map((cat) => (
                  <div key={cat.name} className="grid grid-cols-4 gap-2 px-4 py-2.5 text-sm">
                    <span className="font-medium">{cat.name}</span>
                    <span className="text-right text-income">{cat.income > 0 ? formatCurrency(cat.income) : '-'}</span>
                    <span className="text-right text-expense">{cat.expense > 0 ? formatCurrency(cat.expense) : '-'}</span>
                    <span className="text-right text-muted-foreground">{cat.count}件</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Transaction List */}
          <div className="rounded-lg border border-border bg-card">
            <div className="border-b border-border px-4 py-3">
              <h3 className="font-medium">取引明細</h3>
            </div>
            <div className="divide-y divide-border">
              {monthlyTx
                .sort((a, b) => a.transaction_date.localeCompare(b.transaction_date))
                .map((tx) => {
                  const cat = categories.find((c) => c.id === tx.category_id)
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="shrink-0 text-xs text-muted-foreground w-20">{formatDate(tx.transaction_date)}</span>
                      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs">{cat?.name ?? ''}</span>
                      <span className="min-w-0 flex-1 truncate text-sm">{tx.description}</span>
                      <CurrencyDisplay amount={tx.amount} type={tx.income_expense} className="shrink-0 text-sm" showSign />
                    </div>
                  )
                })}
            </div>
          </div>
        </>
      ))}
    </div>
  )
}
