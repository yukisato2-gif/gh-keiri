import { useEffect, useState } from 'react'
import { Lock, Unlock, AlertTriangle, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, isSV, is本社管理者 } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatDate } from '@/lib/utils'
import type { MonthlyClose, Transaction } from '@/types/database'
import { SV締めステータスLabels } from '@/types/database'

export function MonthlyClosePage() {
  const { employee, user } = useAuthStore()
  const { 選択拠点 } = useLocationStore()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [monthlyClose, setMonthlyClose] = useState<MonthlyClose | null>(null)
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [showReopenDialog, setShowReopenDialog] = useState(false)

  const canManage = isSV(employee) || is本社管理者(employee)

  // Load monthly close status and pending transaction count
  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)

    const loadData = async () => {
      // Fetch monthly close record
      const { data: closeData } = await supabase
        .from('monthly_closes')
        .select('*')
        .eq('拠点', 選択拠点)
        .eq('close_year', year)
        .eq('close_month', month)
        .maybeSingle()

      setMonthlyClose(closeData as MonthlyClose | null)

      // Count pending transactions for this month
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('拠点', 選択拠点)
        .eq('締めステータス', '未')
        .gte('日付', `${year}-${String(month).padStart(2, '0')}-01`)
        .lt('日付', month === 12
          ? `${year + 1}-01-01`
          : `${year}-${String(month + 1).padStart(2, '0')}-01`
        )

      setPendingCount(count ?? 0)
      setLoading(false)
    }

    loadData()
  }, [選択拠点, year, month])

  // Execute monthly close
  const handleClose = async () => {
    if (!選択拠点 || !user?.email) return
    setProcessing(true)

    const now = new Date().toISOString()

    if (monthlyClose) {
      // Update existing record
      await supabase
        .from('monthly_closes')
        .update({
          status: 'closed',
          closed_by: user.email,
          closed_at: now,
          updated_at: now,
        })
        .eq('id', monthlyClose.id)
    } else {
      // Create new record
      await supabase
        .from('monthly_closes')
        .insert({
          拠点: 選択拠点,
          close_year: year,
          close_month: month,
          status: 'closed',
          closed_by: user.email,
          closed_at: now,
          modification_count: 0,
        })
    }

    // Reload
    const { data } = await supabase
      .from('monthly_closes')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('close_year', year)
      .eq('close_month', month)
      .maybeSingle()

    setMonthlyClose(data as MonthlyClose | null)
    setProcessing(false)
  }

  // Re-close after modification
  const handleReclose = async () => {
    if (!monthlyClose || !user?.email) return
    setProcessing(true)

    await supabase
      .from('monthly_closes')
      .update({
        status: 'closed',
        closed_by: user.email,
        closed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', monthlyClose.id)

    const { data } = await supabase
      .from('monthly_closes')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('close_year', year)
      .eq('close_month', month)
      .maybeSingle()

    setMonthlyClose(data as MonthlyClose | null)
    setProcessing(false)
  }

  // Reopen a closed month (sets to 'open' with reason)
  const handleReopen = async () => {
    if (!monthlyClose || !user?.email || !reopenReason.trim()) return
    setProcessing(true)

    await supabase
      .from('monthly_closes')
      .update({
        status: 'modified',
        modification_count: (monthlyClose.modification_count ?? 0) + 1,
        last_modified_by: user.email,
        last_modified_at: new Date().toISOString(),
        last_modified_reason: reopenReason.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', monthlyClose.id)

    const { data } = await supabase
      .from('monthly_closes')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('close_year', year)
      .eq('close_month', month)
      .maybeSingle()

    setMonthlyClose(data as MonthlyClose | null)
    setShowReopenDialog(false)
    setReopenReason('')
    setProcessing(false)
  }

  const status = monthlyClose?.status ?? 'open'
  const statusLabel = SV締めステータスLabels[status] ?? status

  // Month navigation
  const goMonth = (delta: number) => {
    let m = month + delta
    let y = year
    if (m > 12) { m = 1; y++ }
    if (m < 1) { m = 12; y-- }
    setYear(y)
    setMonth(m)
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">SV締め管理</h2>

      {/* Month selector */}
      <div className="flex items-center justify-center gap-4 mb-6">
        <button
          onClick={() => goMonth(-1)}
          className="bg-gray-100 text-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          &lt; 前月
        </button>
        <span className="text-lg font-bold">
          {year}年{month}月
        </span>
        <button
          onClick={() => goMonth(1)}
          className="bg-gray-100 text-gray-700 rounded-lg px-3 py-2 text-sm"
        >
          翌月 &gt;
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-muted">読み込み中...</div>
      ) : (
        <>
          {/* Status card */}
          <div className="bg-white rounded-xl shadow-sm p-4 mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-gray-500">締めステータス</span>
              <span
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  status === 'closed'
                    ? 'bg-green-100 text-green-700'
                    : status === 'modified'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                {statusLabel}
              </span>
            </div>

            {monthlyClose?.closed_by && (
              <div className="text-sm text-gray-600 space-y-1">
                <p>締め実行者: {monthlyClose.closed_by}</p>
                {monthlyClose.closed_at && (
                  <p>締め実行日時: {formatDate(monthlyClose.closed_at, 'yyyy/MM/dd HH:mm')}</p>
                )}
              </div>
            )}

            {status === 'modified' && monthlyClose && (
              <div className="mt-3 p-3 bg-yellow-50 rounded-lg text-sm space-y-1">
                <div className="flex items-center gap-1 text-yellow-700 font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  締め後修正あり
                </div>
                <p className="text-gray-600">修正回数: {monthlyClose.modification_count}回</p>
                {monthlyClose.last_modified_by && (
                  <p className="text-gray-600">最終修正者: {monthlyClose.last_modified_by}</p>
                )}
                {monthlyClose.last_modified_reason && (
                  <p className="text-gray-600">修正理由: {monthlyClose.last_modified_reason}</p>
                )}
              </div>
            )}
          </div>

          {/* Pending transactions warning */}
          {pendingCount > 0 && status === 'open' && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 text-orange-700">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-medium">未締め取引: {pendingCount}件</span>
              </div>
              <p className="text-sm text-orange-600 mt-1">
                締め実行前に全取引の確認をお勧めします
              </p>
            </div>
          )}

          {/* Action buttons */}
          {canManage && (
            <div className="space-y-3">
              {status === 'open' && (
                <button
                  onClick={handleClose}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 bg-green-600 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
                >
                  <Lock className="w-5 h-5" />
                  {processing ? '処理中...' : '締め実行'}
                </button>
              )}

              {status === 'closed' && (
                <button
                  onClick={() => setShowReopenDialog(true)}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 bg-yellow-500 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
                >
                  <Unlock className="w-5 h-5" />
                  締め解除（修正）
                </button>
              )}

              {status === 'modified' && (
                <button
                  onClick={handleReclose}
                  disabled={processing}
                  className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
                >
                  <RefreshCw className="w-5 h-5" />
                  {processing ? '処理中...' : '再締め'}
                </button>
              )}
            </div>
          )}

          {!canManage && (
            <div className="text-center py-4 text-sm text-muted">
              締め操作はSV以上の権限が必要です
            </div>
          )}

          {/* Reopen dialog */}
          {showReopenDialog && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <h3 className="text-lg font-bold mb-4">締め解除</h3>
                <p className="text-sm text-gray-600 mb-3">
                  締め解除の理由を入力してください
                </p>
                <textarea
                  value={reopenReason}
                  onChange={(e) => setReopenReason(e.target.value)}
                  className="w-full border rounded-lg p-3 text-sm mb-4"
                  rows={3}
                  placeholder="修正理由..."
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowReopenDialog(false)
                      setReopenReason('')
                    }}
                    className="flex-1 bg-gray-100 text-gray-700 rounded-lg px-4 py-2"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleReopen}
                    disabled={!reopenReason.trim() || processing}
                    className="flex-1 bg-yellow-500 text-white rounded-lg px-4 py-2 disabled:opacity-50"
                  >
                    {processing ? '処理中...' : '解除する'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
