import { useState, useMemo } from 'react'
import { useMonthlyCloses, useMonthlyClose, useUpsertMonthlyClose, useCurrentLocation, useCurrentEmployee, useTransactions, useCarryOverTransactions } from '@/hooks/useAppData'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate } from '@/lib/formatters'
import { MONTHLY_CLOSE_STATUS_LABELS } from '@/lib/constants'
import { Lock, Unlock, AlertTriangle, Check, RotateCcw, ArrowRightLeft } from 'lucide-react'

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

const STATUS_STYLES: Record<string, { bg: string; icon: typeof Lock }> = {
  open: { bg: 'bg-muted text-muted-foreground', icon: Unlock },
  closed: { bg: 'bg-income/10 text-income', icon: Lock },
  modified: { bg: 'bg-warning/10 text-warning', icon: AlertTriangle },
}

export function MonthlyClosePage() {
  const { locationId } = useCurrentLocation()
  const employee = useCurrentEmployee()
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

  const { monthlyCloses, isLoading, refetch } = useMonthlyCloses(locationId)
  const currentClose = useMonthlyClose(locationId, selectedMonth)
  const upsertClose = useUpsertMonthlyClose()
  const { transactions } = useTransactions(locationId)
  const carryOverTransactions = useCarryOverTransactions()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState<'close' | 'reopen' | null>(null)
  const [carryOverResult, setCarryOverResult] = useState<{ count: number } | null>(null)
  const monthOptions = getYearMonthOptions()

  const canClose = employee?.role === 'supervisor' || employee?.role === 'section_chief' || employee?.role === 'hq_admin'

  // Count transactions for selected month
  const monthTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.transaction_date.startsWith(selectedMonth))
  }, [transactions, selectedMonth])

  const pendingCount = monthTransactions.filter((tx) => tx.approval_status === 'pending').length
  const draftCount = monthTransactions.filter((tx) => tx.approval_status === 'draft').length
  const unbilledExpenseCount = monthTransactions.filter(
    (tx) => tx.income_expense === 'expense' && tx.billing_status === 'unbilled'
  ).length

  const status = currentClose?.status ?? 'open'
  const statusStyle = STATUS_STYLES[status] ?? STATUS_STYLES.open
  const StatusIcon = statusStyle.icon

  const handleClose = async () => {
    if (!employee || !locationId) return
    setIsSubmitting(true)

    // Carry over unbilled expense transactions to next month
    const { count: carried, error: carryError } = await carryOverTransactions(locationId, selectedMonth)
    if (carryError) console.error('Carryover error:', carryError)
    if (carried > 0) setCarryOverResult({ count: carried })

    const [y, m] = selectedMonth.split('-').map(Number)
    const { error } = await upsertClose({
      location_id: locationId,
      close_year: y,
      close_month: m,
      status: 'closed',
      closed_by: employee.id,
      closed_at: new Date().toISOString(),
      modification_count: currentClose?.modification_count ?? 0,
      last_modified_at: currentClose?.last_modified_at ?? null,
      last_modified_by: currentClose?.last_modified_by ?? null,
      last_modified_reason: currentClose?.last_modified_reason ?? null,
    })

    if (error) console.error(error)
    setShowConfirmModal(null)
    await refetch()
    setIsSubmitting(false)
  }

  const handleReopen = async () => {
    if (!employee || !locationId || !currentClose) return
    setIsSubmitting(true)

    const [y, m] = selectedMonth.split('-').map(Number)
    const { error } = await upsertClose({
      location_id: locationId,
      close_year: y,
      close_month: m,
      status: 'open',
      closed_by: currentClose.closed_by,
      closed_at: currentClose.closed_at,
      modification_count: currentClose.modification_count,
      last_modified_at: currentClose.last_modified_at,
      last_modified_by: currentClose.last_modified_by,
      last_modified_reason: currentClose.last_modified_reason,
    })

    if (error) console.error(error)
    setShowConfirmModal(null)
    await refetch()
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">月次締め管理</h2>

      {/* Month selector */}
      <select
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
        className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
      >
        {monthOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      {/* Current status */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${statusStyle.bg}`}>
            <StatusIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-medium">{selectedMonth.replace('-', '年') + '月'}</h3>
            <p className={`text-sm font-medium ${statusStyle.bg.replace('bg-', 'text-').split(' ')[0]}`}>
              {MONTHLY_CLOSE_STATUS_LABELS[status]}
            </p>
          </div>
        </div>

        {currentClose?.closed_at && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            <p>締め日時: {formatDate(currentClose.closed_at)}</p>
            {currentClose.modification_count > 0 && (
              <p className="text-warning">締め後修正: {currentClose.modification_count}回</p>
            )}
            {currentClose.last_modified_reason && (
              <p>最終修正理由: {currentClose.last_modified_reason}</p>
            )}
          </div>
        )}
      </div>

      {/* Transaction summary for the month */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h3 className="mb-3 font-medium">取引状況</h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className="text-2xl font-bold">{monthTransactions.length}</p>
            <p className="text-xs text-muted-foreground">総件数</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${pendingCount > 0 ? 'text-warning' : ''}`}>{pendingCount}</p>
            <p className="text-xs text-muted-foreground">承認待ち</p>
          </div>
          <div className="text-center">
            <p className={`text-2xl font-bold ${draftCount > 0 ? 'text-warning' : ''}`}>{draftCount}</p>
            <p className="text-xs text-muted-foreground">下書き</p>
          </div>
        </div>

        {unbilledExpenseCount > 0 && status === 'open' && (
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-primary/10 p-2">
            <ArrowRightLeft className="h-4 w-4 text-primary shrink-0" />
            <p className="text-xs text-primary">
              未請求の支出が{unbilledExpenseCount}件あります。締め実行時に翌月へ繰り越されます。
            </p>
          </div>
        )}

        {(pendingCount > 0 || draftCount > 0) && status === 'open' && (
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-warning/10 p-2">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <p className="text-xs text-warning">
              未確定の取引があります。締め前に処理することを推奨します。
            </p>
          </div>
        )}
      </div>

      {/* Action buttons */}
      {canClose && (
        <div className="flex flex-wrap gap-2">
          {status === 'open' && (
            <button
              onClick={() => setShowConfirmModal('close')}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            >
              <Lock className="h-4 w-4" />
              SV締め実行
            </button>
          )}
          {(status === 'closed' || status === 'modified') && (
            <>
              <button
                onClick={() => setShowConfirmModal('close')}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                <Check className="h-4 w-4" />
                再締め実行
              </button>
              <button
                onClick={() => setShowConfirmModal('reopen')}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                <RotateCcw className="h-4 w-4" />
                締め解除
              </button>
            </>
          )}
        </div>
      )}

      {/* Carryover result */}
      {carryOverResult && (
        <div className="flex items-center gap-2 rounded-md bg-income/10 p-3">
          <Check className="h-4 w-4 text-income shrink-0" />
          <p className="text-sm text-income">
            {carryOverResult.count}件の未請求支出を翌月へ繰り越しました。
          </p>
          <button
            onClick={() => setCarryOverResult(null)}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            閉じる
          </button>
        </div>
      )}

      {/* History */}
      {!isLoading && monthlyCloses.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="font-medium">締め履歴</h3>
          </div>
          <div className="divide-y divide-border">
            {monthlyCloses.map((mc) => {
              const s = STATUS_STYLES[mc.status] ?? STATUS_STYLES.open
              const Icon = s.icon
              return (
                <div key={mc.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-full ${s.bg}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-sm font-medium">{mc.close_year}年{mc.close_month}月</span>
                    <p className="text-xs text-muted-foreground">
                      {MONTHLY_CLOSE_STATUS_LABELS[mc.status]}
                      {mc.modification_count > 0 && ` (修正${mc.modification_count}回)`}
                    </p>
                  </div>
                  {mc.closed_at && (
                    <span className="text-xs text-muted-foreground">{formatDate(mc.closed_at)}</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
        </div>
      )}

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-bold">
              {showConfirmModal === 'close' ? 'SV締めの確認' : '締め解除の確認'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {showConfirmModal === 'close'
                ? `${selectedMonth.replace('-', '年') + '月'}のSV締めを実行しますか？${unbilledExpenseCount > 0 ? `未請求の支出${unbilledExpenseCount}件は翌月へ繰り越されます。` : ''}締め後も現場での修正は可能ですが、修正理由の入力が必須になります。`
                : `${selectedMonth.replace('-', '年') + '月'}の締めを解除しますか？`
              }
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={showConfirmModal === 'close' ? handleClose : handleReopen}
                disabled={isSubmitting}
                className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {showConfirmModal === 'close' ? '締め実行' : '締め解除'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
