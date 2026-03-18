import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useBilling, useUpdateBilling, useCurrentEmployee, usePayments, useCurrentLocation } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate, formatCurrency } from '@/lib/formatters'
import { INVOICE_STATUS_LABELS, PAYMENT_METHOD_LABELS } from '@/lib/constants'
import type { InvoiceStatus } from '@/types/database'
import { generateBillingPdf } from '@/lib/billingPdf'
import { ArrowLeft, Send, Check, X, FileText, Banknote, Printer } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-muted text-muted-foreground',
  issued: 'bg-primary/10 text-primary',
  sent: 'bg-primary/10 text-primary',
  partial: 'bg-warning/10 text-warning',
  paid: 'bg-income/10 text-income',
  overdue: 'bg-expense/10 text-expense',
  cancelled: 'bg-muted text-muted-foreground',
}

const NEXT_STATUS: Partial<Record<InvoiceStatus, { status: InvoiceStatus; label: string }>> = {
  draft: { status: 'issued', label: '発行確定' },
  issued: { status: 'sent', label: '送付済みにする' },
}

export function BillingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { billing, isLoading, refetch } = useBilling(id)
  const { payments } = usePayments(id)
  const updateBilling = useUpdateBilling()
  const employee = useCurrentEmployee()
  const { locations } = useCurrentLocation()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCancelModal, setShowCancelModal] = useState(false)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!billing) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <p className="text-center text-muted-foreground">請求書が見つかりません</p>
      </div>
    )
  }

  const canManage = employee?.role !== 'home_manager'
  const nextAction = NEXT_STATUS[billing.status as keyof typeof NEXT_STATUS]
  const outstanding = billing.balance ?? (billing.total_amount + (billing.carried_over_amount ?? 0) - billing.paid_amount)

  const handleStatusChange = async (newStatus: InvoiceStatus) => {
    setIsSubmitting(true)
    const { error } = await updateBilling(billing.id, { status: newStatus })
    if (error) console.error(error)
    await refetch()
    setIsSubmitting(false)
  }

  const handleCancel = async () => {
    setIsSubmitting(true)
    const { error } = await updateBilling(billing.id, { status: 'cancelled' })
    if (error) console.error(error)
    setShowCancelModal(false)
    await refetch()
    setIsSubmitting(false)
  }

  const location = locations.find((l) => l.id === billing?.location_id)

  const handlePdf = () => {
    if (!billing || !billing.resident || !location) return
    generateBillingPdf({
      billing,
      items: billing.items ?? [],
      location,
      resident: billing.resident,
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <h2 className="text-xl font-bold">請求書詳細</h2>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3">
        <span className={`rounded px-2 py-1 text-sm font-medium ${STATUS_COLORS[billing.status] ?? ''}`}>
          {INVOICE_STATUS_LABELS[billing.status] ?? billing.status}
        </span>
        <span className="text-sm text-muted-foreground">{billing.billing_number}</span>
      </div>

      {/* Detail Card */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        <DetailRow label="利用者" value={billing.resident?.name ?? '-'} />
        <DetailRow label="対象年月" value={`${billing.billing_year}年${billing.billing_month}月`} />
        <DetailRow label="請求日" value={formatDate(billing.billing_date)} />
        {billing.due_date && <DetailRow label="支払期限" value={formatDate(billing.due_date)} />}
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">請求合計</span>
          <span className="text-lg font-bold tabular-nums">{formatCurrency(billing.total_amount)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">入金済</span>
          <span className="text-sm font-medium text-income tabular-nums">{formatCurrency(billing.paid_amount)}</span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">未収残高</span>
          <span className={`text-sm font-bold tabular-nums ${outstanding > 0 ? 'text-expense' : 'text-income'}`}>
            {formatCurrency(outstanding)}
          </span>
        </div>
        {billing.notes && <DetailRow label="備考" value={billing.notes} />}
      </div>

      {/* Billing Items */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 font-medium">
            <FileText className="h-4 w-4" />
            請求明細（{billing.items?.length ?? 0}件）
          </h3>
        </div>
        {billing.items && billing.items.length > 0 ? (
          <div className="divide-y divide-border">
            {billing.items.map((item) => (
              <Link
                key={item.id}
                to={item.transaction ? `/transactions/${item.transaction_id}` : '#'}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-xs text-muted-foreground">
                    {item.transaction ? formatDate(item.transaction.transaction_date) : '-'}
                  </p>
                  <p className="truncate text-sm">{item.transaction?.description ?? '-'}</p>
                </div>
                <CurrencyDisplay amount={item.amount} type="expense" className="shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">明細がありません</div>
        )}
      </div>

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-2 font-medium">
              <Banknote className="h-4 w-4" />
              入金履歴（{payments.length}件）
            </h3>
          </div>
          <div className="divide-y divide-border">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{formatDate(payment.payment_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                    {payment.notes && ` - ${payment.notes}`}
                  </p>
                </div>
                <CurrencyDisplay amount={payment.amount} type="income" className="shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      {canManage && (
        <div className="flex flex-wrap gap-2">
          {billing.status !== 'draft' && billing.status !== 'cancelled' && (
            <button
              onClick={handlePdf}
              className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
            >
              <Printer className="h-4 w-4" />
              PDF出力
            </button>
          )}
          {outstanding > 0 && billing.status !== 'draft' && billing.status !== 'cancelled' && (
            <Link
              to={`/billing/${billing.id}/payment`}
              className="inline-flex items-center gap-1.5 rounded-md bg-income px-4 py-2 text-sm font-medium text-white hover:bg-income/90"
            >
              <Banknote className="h-4 w-4" />
              入金を記録
            </Link>
          )}
          {nextAction && (
            <button
              onClick={() => handleStatusChange(nextAction.status)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Send className="h-4 w-4" />
              {nextAction.label}
            </button>
          )}
          {billing.status !== 'cancelled' && billing.status !== 'paid' && (
            <button
              onClick={() => setShowCancelModal(true)}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md border border-expense px-4 py-2 text-sm font-medium text-expense hover:bg-expense/10 disabled:opacity-50"
            >
              <X className="h-4 w-4" />
              取消
            </button>
          )}
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-bold text-expense">請求書の取消</h3>
            <p className="mt-2 text-sm text-muted-foreground">この請求書を取り消しますか？</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowCancelModal(false)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleCancel}
                disabled={isSubmitting}
                className="rounded-md bg-expense px-4 py-2 text-sm text-white hover:bg-expense/90 disabled:opacity-50"
              >
                取消する
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}
