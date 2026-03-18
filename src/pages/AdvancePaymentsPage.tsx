import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAdvancePayments, useCurrentLocation, useResidents, useCategories, useResidentBalances } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatDate, formatCurrency, toISODate } from '@/lib/formatters'
import { BILLING_STATUS_LABELS } from '@/lib/constants'
import { Receipt, Users, AlertTriangle } from 'lucide-react'

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

export function AdvancePaymentsPage() {
  const { locationId } = useCurrentLocation()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [filterResidentId, setFilterResidentId] = useState('')
  const [filterBillingStatus, setFilterBillingStatus] = useState('')

  const { transactions, isLoading } = useAdvancePayments(locationId, yearMonth)
  const { residents } = useResidents(locationId)
  const categories = useCategories()
  const residentBalances = useResidentBalances(locationId)
  const monthOptions = getYearMonthOptions()

  const filtered = useMemo(() => {
    return transactions
      .filter((tx) => !filterResidentId || tx.resident_id === filterResidentId)
      .filter((tx) => !filterBillingStatus || tx.billing_status === filterBillingStatus)
  }, [transactions, filterResidentId, filterBillingStatus])

  // Group by resident
  const byResident = useMemo(() => {
    const map = new Map<string, { resident: string; total: number; count: number }>()
    for (const tx of filtered) {
      const residentName = residents.find((r) => r.id === tx.resident_id)?.name ?? '未指定'
      const key = tx.resident_id ?? '__none__'
      const existing = map.get(key)
      if (existing) {
        existing.total += tx.amount
        existing.count++
      } else {
        map.set(key, { resident: residentName, total: tx.amount, count: 1 })
      }
    }
    return Array.from(map.entries())
  }, [filtered, residents])

  const totalAmount = filtered.reduce((sum, tx) => sum + tx.amount, 0)
  const unbilledAmount = filtered.filter((tx) => tx.billing_status === 'unbilled').reduce((sum, tx) => sum + tx.amount, 0)

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">利用者別立替金一覧</h2>

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
          value={filterResidentId}
          onChange={(e) => setFilterResidentId(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全利用者</option>
          {residents.filter((r) => r.is_active).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <select
          value={filterBillingStatus}
          onChange={(e) => setFilterBillingStatus(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全請求状態</option>
          {Object.entries(BILLING_STATUS_LABELS).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">立替合計</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">未請求額</p>
          <p className="text-lg font-bold tabular-nums text-warning">{formatCurrency(unbilledAmount)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-3">
          <p className="text-xs text-muted-foreground">件数</p>
          <p className="text-lg font-bold">{filtered.length}件</p>
        </div>
      </div>

      {/* 利用者残高テーブル */}
      {residentBalances.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" />
              利用者残高
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2 text-left font-medium">利用者</th>
                  <th className="px-4 py-2 text-right font-medium">未請求額</th>
                  <th className="px-4 py-2 text-right font-medium">未入金額</th>
                  <th className="px-4 py-2 text-right font-medium">総残高</th>
                  <th className="px-4 py-2 text-right font-medium">上限</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {residentBalances.map((rb) => (
                  <tr key={rb.resident_id} className={rb.is_over_limit ? 'bg-expense/5' : ''}>
                    <td className="px-4 py-2.5 font-medium">
                      {rb.resident_name}
                      {rb.is_over_limit && (
                        <AlertTriangle className="inline ml-1 h-3.5 w-3.5 text-expense" />
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-warning">{formatCurrency(rb.unbilled_amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-primary">{formatCurrency(rb.unpaid_amount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-bold">{formatCurrency(rb.total_balance)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                      {rb.advance_limit != null ? formatCurrency(rb.advance_limit) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* By Resident summary */}
      {byResident.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="border-b border-border px-4 py-3">
            <h3 className="flex items-center gap-2 font-medium">
              <Users className="h-4 w-4" />
              利用者別集計
            </h3>
          </div>
          <div className="divide-y divide-border">
            {byResident.map(([key, data]) => (
              <div key={key} className="flex items-center justify-between px-4 py-2.5">
                <div>
                  <span className="text-sm font-medium">{data.resident}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{data.count}件</span>
                </div>
                <span className="text-sm font-bold tabular-nums">{formatCurrency(data.total)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transaction list */}
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-medium">立替取引明細</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Receipt className="h-10 w-10" />}
            title="立替取引がありません"
            description="指定期間に承認済みの立替取引はありません"
          />
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((tx) => (
              <Link
                key={tx.id}
                to={`/transactions/${tx.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</span>
                    <span className="rounded bg-muted px-1.5 py-0.5 text-xs">
                      {residents.find((r) => r.id === tx.resident_id)?.name ?? '未指定'}
                    </span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${
                      tx.billing_status === 'unbilled' ? 'bg-warning/10 text-warning' :
                      tx.billing_status === 'billed' ? 'bg-primary/10 text-primary' :
                      tx.billing_status === 'paid' ? 'bg-income/10 text-income' : 'bg-muted text-muted-foreground'
                    }`}>
                      {BILLING_STATUS_LABELS[tx.billing_status] ?? tx.billing_status}
                    </span>
                  </div>
                  <p className="mt-0.5 truncate text-sm font-medium">{tx.description}</p>
                </div>
                <CurrencyDisplay amount={tx.amount} type="expense" className="shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
