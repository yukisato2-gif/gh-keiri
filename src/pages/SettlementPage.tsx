import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useSettlements, useCurrentLocation, useCurrentEmployee, useAdvancePayments, useBillings, useUpsertSettlement } from '@/hooks/useAppData'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { EmptyState } from '@/components/shared/EmptyState'
import { formatCurrency } from '@/lib/formatters'
import { SETTLEMENT_STATUS_LABELS } from '@/lib/constants'
import { Building2, Calculator, Loader2 } from 'lucide-react'

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
  pending: 'bg-muted text-muted-foreground',
  requested: 'bg-primary/10 text-primary',
  transferred: 'bg-income/10 text-income',
  confirmed: 'bg-income/10 text-income',
}

export function SettlementPage() {
  const { locationId, locations } = useCurrentLocation()
  const employee = useCurrentEmployee()
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const { settlements, isLoading, refetch } = useSettlements(yearMonth)
  const { transactions } = useAdvancePayments(locationId, yearMonth)
  const { billings } = useBillings(locationId, yearMonth)
  const upsertSettlement = useUpsertSettlement()
  const [isCalculating, setIsCalculating] = useState(false)
  const monthOptions = getYearMonthOptions()

  const isAdmin = employee?.role === 'hq_admin' || employee?.role === 'section_chief'

  // Calculate settlement data for each location
  const locationSummaries = useMemo(() => {
    return locations.map((loc) => {
      const existingSettlement = settlements.find((s) => s.location_id === loc.id)
      const locTransactions = transactions.filter((tx) => tx.location_id === loc.id)
      const locBillings = billings.filter((b) => b.location_id === loc.id)

      const totalAdvance = locTransactions.reduce((sum, tx) => sum + tx.amount, 0)
      const totalPaid = locBillings.reduce((sum, b) => sum + b.paid_amount, 0)
      const replenishment = totalAdvance - totalPaid

      return {
        location: loc,
        settlement: existingSettlement,
        totalAdvance,
        totalPaid,
        replenishment,
        transactionCount: locTransactions.length,
      }
    }).filter((s) => s.totalAdvance > 0 || s.settlement)
  }, [locations, settlements, transactions, billings])

  const totalReplenishment = locationSummaries.reduce((sum, s) => sum + s.replenishment, 0)

  const handleCalculateAll = async () => {
    if (!isAdmin || isCalculating) return
    setIsCalculating(true)

    for (const summary of locationSummaries) {
      if (summary.totalAdvance === 0 && !summary.settlement) continue

      const [sy, sm] = yearMonth.split('-').map(Number)
      await upsertSettlement({
        location_id: summary.location.id,
        settlement_year: sy,
        settlement_month: sm,
        total_advance_amount: summary.totalAdvance,
        total_payment_received: summary.totalPaid,
        replenishment_amount: summary.replenishment,
        status: summary.settlement?.status ?? 'pending',
        transfer_date: summary.settlement?.transfer_date ?? null,
        transfer_amount: summary.settlement?.transfer_amount ?? null,
        transferred_by: summary.settlement?.transferred_by ?? null,
        confirmed_by: summary.settlement?.confirmed_by ?? null,
        confirmed_at: summary.settlement?.confirmed_at ?? null,
        notes: summary.settlement?.notes ?? null,
      })
    }

    await refetch()
    setIsCalculating(false)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">拠点精算</h2>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={yearMonth}
          onChange={(e) => setYearMonth(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          {monthOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>

        {isAdmin && locationSummaries.length > 0 && (
          <button
            onClick={handleCalculateAll}
            disabled={isCalculating}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isCalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            精算額を算出
          </button>
        )}
      </div>

      {/* Total summary */}
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-xs text-muted-foreground">立替合計</p>
            <p className="text-lg font-bold tabular-nums">
              {formatCurrency(locationSummaries.reduce((sum, s) => sum + s.totalAdvance, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">入金合計</p>
            <p className="text-lg font-bold tabular-nums text-income">
              {formatCurrency(locationSummaries.reduce((sum, s) => sum + s.totalPaid, 0))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">補充必要額</p>
            <p className="text-lg font-bold tabular-nums text-expense">{formatCurrency(totalReplenishment)}</p>
          </div>
        </div>
      </div>

      {/* Location list */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <LoadingSpinner />
          </div>
        ) : locationSummaries.length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-10 w-10" />}
            title="精算データがありません"
            description="この月の立替取引がありません"
          />
        ) : (
          <div className="divide-y divide-border">
            {locationSummaries.map(({ location, settlement, totalAdvance, totalPaid, replenishment, transactionCount }) => (
              <Link
                key={location.id}
                to={`/settlement/${location.id}/${yearMonth}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Building2 className="h-4 w-4 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{location.name}</span>
                    {settlement && (
                      <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_COLORS[settlement.status] ?? ''}`}>
                        {SETTLEMENT_STATUS_LABELS[settlement.status] ?? settlement.status}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    立替{transactionCount}件 {formatCurrency(totalAdvance)}
                    {totalPaid > 0 && ` / 入金 ${formatCurrency(totalPaid)}`}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold tabular-nums ${replenishment > 0 ? 'text-expense' : 'text-income'}`}>
                    {formatCurrency(replenishment)}
                  </p>
                  <p className="text-xs text-muted-foreground">補充額</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
