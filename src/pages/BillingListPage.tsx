import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useBillings, useCurrentLocation, useCurrentEmployee } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate, formatCurrency } from '@/lib/formatters'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'
import type { InvoiceStatus } from '@/types/database'
import { FileText, Plus } from 'lucide-react'

function getYearMonthOptions() {
  const now = new Date()
  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    options.push({ value, label })
  }
  return options
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  issued: 'bg-primary/10 text-primary',
  sent: 'bg-primary/10 text-primary',
  partial: 'bg-warning/10 text-warning',
  paid: 'bg-income/10 text-income',
  overdue: 'bg-expense/10 text-expense',
  cancelled: 'bg-muted text-muted-foreground line-through',
}

export function BillingListPage() {
  const { locationId } = useCurrentLocation()
  const employee = useCurrentEmployee()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [filterStatus, setFilterStatus] = useState('')
  const { billings, isLoading } = useBillings(locationId, yearMonth)
  const monthOptions = getYearMonthOptions()

  const canCreateBilling = employee?.role !== 'home_manager'

  const filtered = filterStatus
    ? billings.filter((b) => b.status === filterStatus)
    : billings

  const totalAmount = filtered.reduce((sum, b) => sum + b.total_amount, 0)
  const totalPaid = filtered.reduce((sum, b) => sum + b.paid_amount, 0)
  const totalCarriedOver = filtered.reduce((sum, b) => sum + (b.carried_over_amount ?? 0), 0)
  const totalOutstanding = totalAmount + totalCarriedOver - totalPaid

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">請求管理</h2>
        {canCreateBilling && (
          <Link
            to="/billing/create"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            請求書作成
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全ステータス</option>
          {Object.entries(INVOICE_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">請求合計</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">入金済</p>
          <p className="text-lg font-bold tabular-nums text-income">{formatCurrency(totalPaid)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">未収</p>
          <p className="text-lg font-bold tabular-nums text-expense">{formatCurrency(totalOutstanding)}</p>
        </div>
      </div>

      {/* Billing list */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="請求書がありません"
            description={canCreateBilling ? '「請求書作成」ボタンから作成できます' : 'この月の請求書はまだ作成されていません'}
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((billing) => (
              <Link
                key={billing.id}
                to={`/billing/${billing.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{billing.billing_number}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[billing.status] ?? ''}`}>
                      {INVOICE_STATUS_LABELS[billing.status] ?? billing.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                    <span>{billing.resident?.name ?? '-'}</span>
                    <span>{formatDate(billing.billing_date)}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <CurrencyDisplay amount={billing.total_amount} type="expense" />
                  {billing.paid_amount > 0 && (
                    <p className="text-xs text-income">入金: {formatCurrency(billing.paid_amount)}</p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
