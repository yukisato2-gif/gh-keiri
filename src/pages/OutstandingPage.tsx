import { Link } from 'react-router-dom'
import { useOutstandingBillings, useCurrentLocation } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate, formatCurrency } from '@/lib/formatters'
import { INVOICE_STATUS_LABELS } from '@/lib/constants'
import { AlertTriangle, FileText } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  issued: 'bg-primary/10 text-primary',
  sent: 'bg-primary/10 text-primary',
  partial: 'bg-warning/10 text-warning',
  overdue: 'bg-expense/10 text-expense',
}

function getDaysOverdue(dueDateStr: string | null): number | null {
  if (!dueDateStr) return null
  const due = new Date(dueDateStr)
  const now = new Date()
  const diff = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
  return diff > 0 ? diff : null
}

export function OutstandingPage() {
  const { locationId } = useCurrentLocation()
  const { billings, isLoading } = useOutstandingBillings(locationId)

  const totalOutstanding = billings.reduce((sum, b) => sum + ((b.balance ?? (b.total_amount + (b.carried_over_amount ?? 0) - b.paid_amount))), 0)
  const overdueCount = billings.filter((b) => b.status === 'overdue' || (b.due_date && getDaysOverdue(b.due_date) !== null)).length

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">未収管理</h2>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">未収件数</p>
          <p className="text-lg font-bold">{billings.length}件</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">未収合計</p>
          <p className="text-lg font-bold tabular-nums text-expense">{formatCurrency(totalOutstanding)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">期限超過</p>
          <p className={`text-lg font-bold ${overdueCount > 0 ? 'text-expense' : ''}`}>{overdueCount}件</p>
        </div>
      </div>

      {/* Outstanding billings list */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : billings.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-10 w-10" />}
            title="未収の請求書はありません"
            description="すべての請求が入金済みです"
          />
        ) : (
          <div className="divide-y divide-border">
            {billings.map((billing) => {
              const outstanding = billing.total_amount - billing.paid_amount
              const daysOverdue = getDaysOverdue(billing.due_date)

              return (
                <Link
                  key={billing.id}
                  to={`/billing/${billing.id}`}
                  className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-expense/10">
                    {daysOverdue ? (
                      <AlertTriangle className="h-4 w-4 text-expense" />
                    ) : (
                      <FileText className="h-4 w-4 text-primary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium">{billing.resident?.name ?? '-'}</span>
                      <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[billing.status] ?? ''}`}>
                        {INVOICE_STATUS_LABELS[billing.status] ?? billing.status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                      <span>{billing.billing_number}</span>
                      <span>{billing.billing_year}年{billing.billing_month}月</span>
                      {daysOverdue && (
                        <span className="text-expense font-medium">{daysOverdue}日超過</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <CurrencyDisplay amount={outstanding} type="expense" />
                    {billing.paid_amount > 0 && (
                      <p className="text-xs text-income">入金: {formatCurrency(billing.paid_amount)}</p>
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
