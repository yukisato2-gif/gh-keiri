import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useBilling, usePayments, useAddPayment, useCurrentEmployee } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate, formatCurrency, toISODate } from '@/lib/formatters'
import { PAYMENT_METHOD_LABELS } from '@/lib/constants'
import type { PaymentMethod, PaymentKind } from '@/types/database'
import { ArrowLeft, Plus, Banknote, Loader2 } from 'lucide-react'

export function PaymentPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { billing, isLoading: billingLoading, refetch: refetchBilling } = useBilling(id)
  const { payments, isLoading: paymentsLoading, refetch: refetchPayments } = usePayments(id)
  const addPayment = useAddPayment()
  const employee = useCurrentEmployee()

  const [showForm, setShowForm] = useState(false)
  const [amount, setAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(toISODate(new Date()))
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('transfer')
  const [paymentKind, setPaymentKind] = useState<PaymentKind>('receipt')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (billingLoading || paymentsLoading) {
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

  const outstanding = billing.balance ?? (billing.total_amount + (billing.carried_over_amount ?? 0) - billing.paid_amount)

  const handleSubmit = async () => {
    if (!employee || !amount || !paymentDate) return
    const amountNum = parseInt(amount, 10)
    if (isNaN(amountNum) || amountNum <= 0) return

    setIsSubmitting(true)
    const { error } = await addPayment({
      billing_id: billing.id,
      payment_date: paymentDate,
      amount: amountNum,
      payment_kind: paymentKind,
      payment_method: paymentMethod,
      notes: notes || null,
      recorded_by: employee.id,
    })

    if (error) {
      console.error('Failed to add payment:', error)
    } else {
      setShowForm(false)
      setAmount('')
      setNotes('')
      await refetchPayments()
      await refetchBilling()
    }
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(`/billing/${billing.id}`)} className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold">入金管理</h2>
      </div>

      {/* Billing summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">{billing.billing_number}</p>
        <p className="text-sm font-medium">{billing.resident?.name ?? '-'}</p>
        <div className="mt-2 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(billing.total_amount)}</p>
            <p className="text-xs text-muted-foreground">請求額</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-income">{formatCurrency(billing.paid_amount)}</p>
            <p className="text-xs text-muted-foreground">入金済</p>
          </div>
          <div>
            <p className={`text-lg font-bold tabular-nums ${outstanding > 0 ? 'text-expense' : 'text-income'}`}>
              {formatCurrency(outstanding)}
            </p>
            <p className="text-xs text-muted-foreground">未収残</p>
          </div>
        </div>
      </div>

      {/* Add payment button */}
      {outstanding > 0 && !showForm && (
        <button
          onClick={() => {
            setAmount(String(outstanding))
            setShowForm(true)
          }}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-md bg-income px-4 py-2.5 text-sm font-medium text-white hover:bg-income/90"
        >
          <Plus className="h-4 w-4" />
          入金を記録
        </button>
      )}

      {/* Payment form */}
      {showForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="font-medium">入金登録</h3>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">種別</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPaymentKind('receipt')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  paymentKind === 'receipt'
                    ? 'border-income bg-income/10 text-income'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                入金
              </button>
              <button
                type="button"
                onClick={() => setPaymentKind('refund')}
                className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors ${
                  paymentKind === 'refund'
                    ? 'border-expense bg-expense/10 text-expense'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                返金
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">入金日</label>
            <input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">入金額</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {outstanding > 0 && (
              <p className="mt-1 text-xs text-muted-foreground">未収残高: {formatCurrency(outstanding)}</p>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">入金方法</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {Object.entries(PAYMENT_METHOD_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">備考</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="任意"
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowForm(false)}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !amount || parseInt(amount, 10) <= 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-income px-4 py-2 text-sm font-medium text-white hover:bg-income/90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
              入金を記録
            </button>
          </div>
        </div>
      )}

      {/* Payment history */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="flex items-center gap-2 font-medium">
            <Banknote className="h-4 w-4" />
            入金履歴（{payments.length}件）
          </h3>
        </div>
        {payments.length > 0 ? (
          <div className="divide-y divide-border">
            {payments.map((payment) => (
              <div key={payment.id} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{formatDate(payment.payment_date)}</p>
                  <p className="text-xs text-muted-foreground">
                    {PAYMENT_METHOD_LABELS[payment.payment_method] ?? payment.payment_method}
                    {payment.notes && ` - ${payment.notes}`}
                  </p>
                </div>
                <CurrencyDisplay amount={payment.amount} type="income" className="shrink-0" />
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">入金履歴がありません</div>
        )}
      </div>
    </div>
  )
}
