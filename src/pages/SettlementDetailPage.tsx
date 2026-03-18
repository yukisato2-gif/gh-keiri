import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useSettlement, useUpdateSettlement, useUpsertSettlement, useAdvancePayments, useBillings, useCurrentEmployee, useCurrentLocation } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate, formatCurrency, toISODate } from '@/lib/formatters'
import { SETTLEMENT_STATUS_LABELS, BILLING_STATUS_LABELS } from '@/lib/constants'
import { ArrowLeft, Send, Check, Banknote, Loader2 } from 'lucide-react'

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-muted text-muted-foreground',
  requested: 'bg-primary/10 text-primary',
  transferred: 'bg-income/10 text-income',
  confirmed: 'bg-income/10 text-income',
}

export function SettlementDetailPage() {
  const { locationId, month } = useParams<{ locationId: string; month: string }>()
  const navigate = useNavigate()
  const employee = useCurrentEmployee()
  const { locations } = useCurrentLocation()
  const settlement = useSettlement(locationId, month)
  const { transactions, isLoading: txLoading } = useAdvancePayments(locationId, month)
  const { billings } = useBillings(locationId, month)
  const updateSettlement = useUpdateSettlement()
  const upsertSettlement = useUpsertSettlement()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showTransferForm, setShowTransferForm] = useState(false)
  const [transferAmount, setTransferAmount] = useState('')
  const [transferDate, setTransferDate] = useState(toISODate(new Date()))

  const location = locations.find((l) => l.id === locationId)
  const isAdmin = employee?.role === 'hq_admin' || employee?.role === 'section_chief'

  const totalAdvance = transactions.reduce((sum, tx) => sum + tx.amount, 0)
  const totalPaid = billings.reduce((sum, b) => sum + b.paid_amount, 0)
  const replenishment = totalAdvance - totalPaid

  const handleCreateSettlement = async () => {
    if (!locationId || !month || !employee) return
    setIsSubmitting(true)

    const [sy, sm] = month!.split('-').map(Number)
    const { error } = await upsertSettlement({
      location_id: locationId,
      settlement_year: sy,
      settlement_month: sm,
      total_advance_amount: totalAdvance,
      total_payment_received: totalPaid,
      replenishment_amount: replenishment,
      status: 'pending',
      transfer_date: null,
      transfer_amount: null,
      transferred_by: null,
      confirmed_by: null,
      confirmed_at: null,
      notes: null,
    })

    if (error) console.error(error)
    setIsSubmitting(false)
  }

  const handleRequestTransfer = async () => {
    if (!settlement || !employee) return
    setIsSubmitting(true)

    const { error } = await updateSettlement(settlement.id, {
      status: 'requested',
      total_advance_amount: totalAdvance,
      total_payment_received: totalPaid,
      replenishment_amount: replenishment,
    })

    if (error) console.error(error)
    setIsSubmitting(false)
  }

  const handleTransferComplete = async () => {
    if (!settlement || !employee || !transferAmount || !transferDate) return
    setIsSubmitting(true)

    const { error } = await updateSettlement(settlement.id, {
      status: 'transferred',
      transfer_date: transferDate,
      transfer_amount: parseInt(transferAmount, 10),
      transferred_by: employee.id,
    })

    if (error) console.error(error)
    setShowTransferForm(false)
    setIsSubmitting(false)
  }

  const handleConfirm = async () => {
    if (!settlement || !employee) return
    setIsSubmitting(true)

    const { error } = await updateSettlement(settlement.id, {
      status: 'confirmed',
      confirmed_by: employee.id,
      confirmed_at: new Date().toISOString(),
    })

    if (error) console.error(error)
    setIsSubmitting(false)
  }

  if (txLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/settlement')} className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h2 className="text-xl font-bold">{location?.name ?? '拠点'}</h2>
          <p className="text-sm text-muted-foreground">{month?.replace('-', '年') + '月'} 精算詳細</p>
        </div>
      </div>

      {/* Status */}
      {settlement && (
        <div className="flex items-center gap-2">
          <span className={`rounded px-2 py-1 text-sm font-medium ${STATUS_COLORS[settlement.status] ?? ''}`}>
            {SETTLEMENT_STATUS_LABELS[settlement.status] ?? settlement.status}
          </span>
        </div>
      )}

      {/* Summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAdvance)}</p>
            <p className="text-xs text-muted-foreground">立替合計</p>
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums text-income">{formatCurrency(totalPaid)}</p>
            <p className="text-xs text-muted-foreground">入金済</p>
          </div>
          <div>
            <p className={`text-lg font-bold tabular-nums ${replenishment > 0 ? 'text-expense' : 'text-income'}`}>
              {formatCurrency(replenishment)}
            </p>
            <p className="text-xs text-muted-foreground">補充額</p>
          </div>
        </div>

        {settlement?.transfer_amount != null && (
          <div className="mt-3 border-t border-border pt-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">振込額</span>
              <span className="font-medium">{formatCurrency(settlement.transfer_amount)}</span>
            </div>
            {settlement.transfer_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">振込日</span>
                <span className="font-medium">{formatDate(settlement.transfer_date)}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {isAdmin && (
        <div className="flex flex-wrap gap-2">
          {!settlement && (
            <button
              onClick={handleCreateSettlement}
              disabled={isSubmitting || totalAdvance === 0}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              精算を作成
            </button>
          )}
          {settlement?.status === 'pending' && (
            <button
              onClick={handleRequestTransfer}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              振込依頼
            </button>
          )}
          {settlement?.status === 'requested' && (
            <button
              onClick={() => {
                setTransferAmount(String(replenishment))
                setShowTransferForm(true)
              }}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-income px-4 py-2 text-sm font-medium text-white hover:bg-income/90 disabled:opacity-50"
            >
              <Banknote className="h-4 w-4" />
              振込完了を記録
            </button>
          )}
          {settlement?.status === 'transferred' && (
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-income px-4 py-2 text-sm font-medium text-white hover:bg-income/90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              確認済みにする
            </button>
          )}
        </div>
      )}

      {/* Transfer form */}
      {showTransferForm && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-3">
          <h3 className="font-medium">振込完了記録</h3>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">振込日</label>
            <input
              type="date"
              value={transferDate}
              onChange={(e) => setTransferDate(e.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">振込額</label>
            <input
              type="number"
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowTransferForm(false)}
              className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
            >
              キャンセル
            </button>
            <button
              onClick={handleTransferComplete}
              disabled={isSubmitting || !transferAmount}
              className="inline-flex items-center gap-1.5 rounded-md bg-income px-4 py-2 text-sm font-medium text-white hover:bg-income/90 disabled:opacity-50"
            >
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              記録する
            </button>
          </div>
        </div>
      )}

      {/* Transaction detail */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-medium">立替取引一覧（{transactions.length}件）</h3>
        </div>
        {transactions.length > 0 ? (
          <div className="divide-y divide-border">
            {transactions.map((tx) => (
              <Link
                key={tx.id}
                to={`/transactions/${tx.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</span>
                    <span className="text-xs text-muted-foreground">
                      {tx.resident?.name ?? '-'}
                    </span>
                    {tx.billing_status !== 'unbilled' && (
                      <span className="rounded px-1 py-0.5 text-[10px] bg-muted text-muted-foreground">
                        {BILLING_STATUS_LABELS[tx.billing_status] ?? tx.billing_status}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm">{tx.description}</p>
                </div>
                <CurrencyDisplay amount={tx.amount} type="expense" className="shrink-0" />
              </Link>
            ))}
          </div>
        ) : (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">立替取引がありません</div>
        )}
      </div>

      {/* Related billings */}
      {billings.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">関連請求書（{billings.length}件）</h3>
          </div>
          <div className="divide-y divide-border">
            {billings.map((billing) => (
              <Link
                key={billing.id}
                to={`/billing/${billing.id}`}
                className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <span className="text-sm font-medium">{billing.billing_number}</span>
                  <p className="text-xs text-muted-foreground">{billing.resident?.name ?? '-'}</p>
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
        </div>
      )}
    </div>
  )
}
