import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdvancePayments, useCurrentLocation, useCurrentEmployee, useResidents, useAddBilling } from '@/hooks/useAppData'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate, formatCurrency, toISODate } from '@/lib/formatters'
import { ArrowLeft, Loader2, Check } from 'lucide-react'

function getYearMonthOptions() {
  const now = new Date()
  const options: { value: string; label: string }[] = []
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = `${d.getFullYear()}年${d.getMonth() + 1}月`
    options.push({ value, label })
  }
  return options
}

export function BillingCreatePage() {
  const navigate = useNavigate()
  const { locationId } = useCurrentLocation()
  const employee = useCurrentEmployee()
  const { residents } = useResidents(locationId)
  const now = new Date()
  const [yearMonth, setYearMonth] = useState(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
  const [selectedResidentId, setSelectedResidentId] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { transactions, isLoading } = useAdvancePayments(locationId, yearMonth)
  const addBilling = useAddBilling()
  const monthOptions = getYearMonthOptions()

  // Filter to only unbilled transactions
  const unbilledTransactions = useMemo(() => {
    return transactions.filter((tx) => tx.billing_status === 'unbilled')
  }, [transactions])

  // Group by resident
  const residentGroups = useMemo(() => {
    const map = new Map<string, typeof unbilledTransactions>()
    for (const tx of unbilledTransactions) {
      const key = tx.resident_id ?? '__none__'
      const arr = map.get(key) ?? []
      arr.push(tx)
      map.set(key, arr)
    }
    return Array.from(map.entries())
      .filter(([key]) => !selectedResidentId || key === selectedResidentId)
      .sort(([, a], [, b]) => b.length - a.length)
  }, [unbilledTransactions, selectedResidentId])

  const handleCreateBilling = async (residentId: string, residentTxs: typeof unbilledTransactions) => {
    if (isSubmitting || !employee) return
    setIsSubmitting(true)

    const [y, m] = yearMonth.split('-').map(Number)
    const totalAmount = residentTxs.reduce((sum, tx) => sum + tx.amount, 0)
    const billingNumber = `INV-${yearMonth.replace('-', '')}-${String(residentTxs.length).padStart(4, '0')}`

    const { error } = await addBilling(
      {
        billing_number: billingNumber,
        location_id: locationId,
        resident_id: residentId,
        billing_year: y,
        billing_month: m,
        billing_date: toISODate(new Date()),
        due_date: null,
        total_amount: totalAmount,
        carried_over_amount: 0,
        paid_amount: 0,
        status: 'draft',
        notes: null,
        created_by: employee.id,
      },
      residentTxs.map((tx) => ({ transaction_id: tx.id, amount: tx.amount }))
    )

    if (error) {
      console.error('Failed to create billing:', error)
    } else {
      navigate('/billing')
    }
    setIsSubmitting(false)
  }

  const handleBulkCreate = async () => {
    if (isSubmitting || !employee) return
    setIsSubmitting(true)

    const [y, m] = yearMonth.split('-').map(Number)
    let seq = 1
    for (const [residentId, txs] of residentGroups) {
      if (residentId === '__none__') continue

      const totalAmount = txs.reduce((sum, tx) => sum + tx.amount, 0)
      const billingNumber = `INV-${yearMonth.replace('-', '')}-${String(seq++).padStart(4, '0')}`

      const { error } = await addBilling(
        {
          billing_number: billingNumber,
          location_id: locationId,
          resident_id: residentId,
          billing_year: y,
          billing_month: m,
          billing_date: toISODate(new Date()),
          due_date: null,
          total_amount: totalAmount,
          carried_over_amount: 0,
          paid_amount: 0,
          status: 'draft',
          notes: null,
          created_by: employee.id,
        },
        txs.map((tx) => ({ transaction_id: tx.id, amount: tx.amount }))
      )

      if (error) {
        console.error('Failed to create billing:', error)
        setIsSubmitting(false)
        return
      }
    }

    navigate('/billing')
    setIsSubmitting(false)
  }

  const hasBillableGroups = residentGroups.some(([key]) => key !== '__none__')

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold">請求書作成</h2>
      </div>

      {/* Month & Resident selection */}
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
        <select
          value={selectedResidentId}
          onChange={(e) => setSelectedResidentId(e.target.value)}
          className="rounded-md border border-input bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">全利用者</option>
          {residents.filter((r) => r.is_active).map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>

        {hasBillableGroups && !selectedResidentId && (
          <button
            onClick={handleBulkCreate}
            disabled={isSubmitting}
            className="ml-auto inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            一括作成
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner size="lg" />
        </div>
      ) : residentGroups.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-muted-foreground">未請求の立替取引がありません</p>
        </div>
      ) : (
        residentGroups.map(([residentId, txs]) => {
          const residentName = residents.find((r) => r.id === residentId)?.name ?? '利用者未指定'
          const total = txs.reduce((sum, tx) => sum + tx.amount, 0)
          const isUnassigned = residentId === '__none__'

          return (
            <div key={residentId} className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div>
                  <h3 className="font-medium">{residentName}</h3>
                  <p className="text-xs text-muted-foreground">{txs.length}件 合計 {formatCurrency(total)}</p>
                </div>
                {!isUnassigned && (
                  <button
                    onClick={() => handleCreateBilling(residentId, txs)}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    請求書作成
                  </button>
                )}
                {isUnassigned && (
                  <span className="text-xs text-warning">利用者未指定のため請求書を作成できません</span>
                )}
              </div>
              <div className="divide-y divide-border">
                {txs.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">{formatDate(tx.transaction_date)}</span>
                      </div>
                      <p className="truncate text-sm">{tx.description}</p>
                    </div>
                    <CurrencyDisplay amount={tx.amount} type="expense" className="shrink-0" />
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}
