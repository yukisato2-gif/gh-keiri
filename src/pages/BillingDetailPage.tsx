import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, FileCheck, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isSV, is本社管理者 } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Billing, BillingItem, Transaction, 請求書ステータス } from '@/types/database'
import { 請求書ステータスLabels } from '@/types/database'

const statusColorMap: Record<請求書ステータス, string> = {
  draft: 'bg-gray-100 text-gray-700',
  issued: 'bg-blue-100 text-blue-700',
  sent: 'bg-indigo-100 text-indigo-700',
  partial: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
  overpaid: 'bg-emerald-100 text-emerald-700',
  overdue: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-200 text-gray-500',
}

interface BillingItemWithTransaction extends BillingItem {
  transaction?: Transaction
}

export function BillingDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { employee, user } = useAuthStore()

  const [billing, setBilling] = useState<Billing | null>(null)
  const [items, setItems] = useState<BillingItemWithTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  const canManage = isSV(employee) || is本社管理者(employee)

  useEffect(() => {
    if (!id) return
    setLoading(true)

    const loadBilling = async () => {
      // Fetch billing record
      const { data: billingData } = await supabase
        .from('billings')
        .select('*')
        .eq('id', id)
        .single()

      setBilling(billingData as Billing | null)

      // Fetch billing items with transaction details
      const { data: itemsData } = await supabase
        .from('billing_items')
        .select('*')
        .eq('billing_id', id)
        .order('created_at')

      const billingItems = (itemsData ?? []) as BillingItem[]

      // Load associated transactions
      if (billingItems.length > 0) {
        const txIds = billingItems.map((item) => item.transaction_id)
        const { data: txData } = await supabase
          .from('transactions')
          .select('*')
          .in('id', txIds)

        const txMap = new Map<string, Transaction>()
        for (const tx of (txData ?? []) as Transaction[]) {
          txMap.set(tx.id, tx)
        }

        const enriched: BillingItemWithTransaction[] = billingItems.map((item) => ({
          ...item,
          transaction: txMap.get(item.transaction_id),
        }))

        setItems(enriched)
      } else {
        setItems([])
      }

      setLoading(false)
    }

    loadBilling()
  }, [id])

  const updateStatus = async (newStatus: 請求書ステータス) => {
    if (!billing || !user?.email) return
    setProcessing(true)

    await supabase
      .from('billings')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', billing.id)

    setBilling({ ...billing, status: newStatus })
    setProcessing(false)
  }

  const handleCancel = async () => {
    if (!billing || !user?.email) return
    setProcessing(true)
    setShowCancelConfirm(false)

    // Update billing status to cancelled
    await supabase
      .from('billings')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('id', billing.id)

    // Revert transaction billing_status to unbilled
    const txIds = items.map((item) => item.transaction_id)
    if (txIds.length > 0) {
      await supabase
        .from('transactions')
        .update({
          billing_status: 'unbilled',
          billing_id: null,
          更新日時: new Date().toISOString(),
          更新者: user.email,
        })
        .in('id', txIds)
    }

    setBilling({ ...billing, status: 'cancelled' })
    setProcessing(false)
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted">読み込み中...</div>
      </div>
    )
  }

  if (!billing) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-muted">
          請求書が見つかりません
        </div>
      </div>
    )
  }

  const balanceAmount = billing.total_amount + billing.carried_over_amount - billing.paid_amount

  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => navigate('/billing')}
          className="bg-gray-100 rounded-lg p-2"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h2 className="text-lg font-bold">請求書詳細</h2>
          <p className="text-xs text-gray-500 font-mono">{billing.billing_number}</p>
        </div>
      </div>

      {/* Billing info card */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-medium text-lg">{billing.利用者 ?? '-'}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusColorMap[billing.status] ?? 'bg-gray-100 text-gray-700'
            }`}
          >
            {請求書ステータスLabels[billing.status] ?? billing.status}
          </span>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">請求日</span>
            <span>{formatDate(billing.billing_date)}</span>
          </div>
          {billing.due_date && (
            <div className="flex justify-between">
              <span className="text-gray-500">支払期限</span>
              <span>{formatDate(billing.due_date)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">対象月</span>
            <span>{billing.billing_year}年{billing.billing_month}月</span>
          </div>
        </div>

        {/* Amount breakdown */}
        <div className="mt-4 pt-4 border-t space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">請求金額</span>
            <span className="font-medium">{formatCurrency(billing.total_amount)}</span>
          </div>
          {billing.carried_over_amount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">繰越金額</span>
              <span>{formatCurrency(billing.carried_over_amount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">入金済額</span>
            <span className="text-green-600">{formatCurrency(billing.paid_amount)}</span>
          </div>
          <div className="flex justify-between pt-2 border-t">
            <span className="font-medium">残高</span>
            <span className={`text-lg font-bold ${balanceAmount > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {formatCurrency(balanceAmount)}
            </span>
          </div>
        </div>

        {billing.notes && (
          <div className="mt-4 pt-4 border-t">
            <p className="text-xs text-gray-500 mb-1">備考</p>
            <p className="text-sm">{billing.notes}</p>
          </div>
        )}
      </div>

      {/* Status progression buttons */}
      {canManage && billing.status !== 'cancelled' && billing.status !== 'paid' && (
        <div className="space-y-2 mb-4">
          {billing.status === 'draft' && (
            <button
              onClick={() => updateStatus('issued')}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
            >
              <FileCheck className="w-5 h-5" />
              {processing ? '処理中...' : '発行'}
            </button>
          )}

          {billing.status === 'issued' && (
            <button
              onClick={() => updateStatus('sent')}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
            >
              <Send className="w-5 h-5" />
              {processing ? '処理中...' : '送付済みにする'}
            </button>
          )}

          {billing.status !== 'paid' && billing.paid_amount === 0 && (
            <button
              onClick={() => setShowCancelConfirm(true)}
              disabled={processing}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-red-600 rounded-lg px-4 py-3 font-medium disabled:opacity-50"
            >
              <XCircle className="w-5 h-5" />
              取消
            </button>
          )}
        </div>
      )}

      {/* TODO: Phase 2 - payment recording, PDF export */}
      {/* TODO: Phase 2 - 入金記録機能、PDF出力機能を追加予定 */}

      {/* Billing items (transaction details) */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-bold mb-3">明細一覧</h3>

        {items.length === 0 ? (
          <p className="text-sm text-muted py-4 text-center">明細データがありません</p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <div
                key={item.id}
                className="border-b last:border-0 pb-2 last:pb-0"
              >
                <div className="flex items-center justify-between">
                  <div>
                    {item.transaction ? (
                      <>
                        <p className="text-sm">{item.transaction.摘要カテゴリ}</p>
                        <p className="text-xs text-gray-500">
                          {formatDate(item.transaction.日付)}
                          {item.transaction.摘要 && ` - ${item.transaction.摘要}`}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">取引ID: {item.transaction_id}</p>
                    )}
                  </div>
                  <span className="font-medium text-sm">{formatCurrency(item.amount)}</span>
                </div>
              </div>
            ))}

            <div className="pt-2 border-t flex justify-between font-bold text-sm">
              <span>合計</span>
              <span>{formatCurrency(items.reduce((sum, i) => sum + i.amount, 0))}</span>
            </div>
          </div>
        )}
      </div>

      {/* Cancel confirmation dialog */}
      {showCancelConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3">請求書の取消</h3>
            <p className="text-sm text-gray-600 mb-4">
              この請求書を取消しますか？関連する取引の請求ステータスは「未請求」に戻ります。
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-4 py-2"
              >
                キャンセル
              </button>
              <button
                onClick={handleCancel}
                disabled={processing}
                className="flex-1 bg-red-600 text-white rounded-lg px-4 py-2 disabled:opacity-50"
              >
                {processing ? '処理中...' : '取消する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
