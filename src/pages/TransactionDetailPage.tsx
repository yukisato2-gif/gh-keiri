import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  useTransaction,
  useUpdateTransactionStatus,
  useDeleteTransaction,
  useCanApprove,
  useCurrentEmployee,
  useCategories,
} from '@/hooks/useAppData'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { CurrencyDisplay } from '@/components/shared/CurrencyDisplay'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { formatDate } from '@/lib/formatters'
import { getReceiptImageUrl } from '@/lib/storage'
import {
  TRANSACTION_TYPE_LABELS,
  INCOME_EXPENSE_LABELS,
  BILLING_STATUS_LABELS,
} from '@/lib/constants'
import { ArrowLeft, Send, Check, X, RotateCcw, Receipt, ZoomIn, Pencil, Trash2 } from 'lucide-react'

export function TransactionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { transaction, isLoading, refetch } = useTransaction(id)
  const updateStatus = useUpdateTransactionStatus()
  const deleteTransaction = useDeleteTransaction()
  const currentEmployee = useCurrentEmployee()
  const canApprove = useCanApprove(transaction?.location_id)
  const categories = useCategories()

  const [showRejectModal, setShowRejectModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState<'submit' | 'approve' | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null)
  const [showImageModal, setShowImageModal] = useState(false)

  useEffect(() => {
    if (transaction?.receipt_image_path) {
      getReceiptImageUrl(transaction.receipt_image_path).then(setReceiptUrl)
    } else {
      setReceiptUrl(null)
    }
  }, [transaction?.receipt_image_path])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!transaction) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <p className="text-center text-muted-foreground">取引が見つかりません</p>
      </div>
    )
  }

  const isRecorder = transaction.recorded_by === currentEmployee?.id
  const isNotRecorder = !isRecorder
  const categoryName = transaction.category?.name ?? categories.find((c) => c.id === transaction.category_id)?.name ?? ''

  const handleAction = async (action: 'submit' | 'approve' | 'reject' | 'revert_to_draft') => {
    if (action === 'reject') {
      setShowRejectModal(true)
      return
    }
    if (action === 'submit' || action === 'approve') {
      setShowConfirmModal(action)
      return
    }

    await executeAction(action)
  }

  const executeAction = async (action: 'submit' | 'approve' | 'reject' | 'revert_to_draft', reason?: string) => {
    setIsSubmitting(true)
    const { error } = await updateStatus(transaction.id, action, reason)
    if (error) {
      console.error(error)
    }
    setShowConfirmModal(null)
    await refetch()
    setIsSubmitting(false)
  }

  const handleDelete = async () => {
    setIsSubmitting(true)
    const { error } = await deleteTransaction(transaction.id)
    if (error) {
      console.error(error)
      setIsSubmitting(false)
      return
    }
    navigate('/transactions', { replace: true })
  }

  const handleReject = async () => {
    if (!rejectionReason.trim()) return
    setIsSubmitting(true)
    const { error } = await updateStatus(transaction.id, 'reject', rejectionReason.trim())
    if (error) {
      console.error(error)
    }
    setShowRejectModal(false)
    setRejectionReason('')
    await refetch()
    setIsSubmitting(false)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <h2 className="text-xl font-bold">入出金詳細</h2>
      </div>

      {/* Status + Date */}
      <div className="flex items-center gap-3">
        <StatusBadge status={transaction.approval_status} />
        <span className="text-sm text-muted-foreground">{formatDate(transaction.transaction_date)}</span>
      </div>

      {/* Rejection reason banner */}
      {transaction.approval_status === 'rejected' && transaction.rejection_reason && (
        <div className="rounded-lg border border-expense/30 bg-expense/10 p-3">
          <p className="text-sm font-medium text-expense">差戻し理由</p>
          <p className="mt-1 text-sm">{transaction.rejection_reason}</p>
        </div>
      )}

      {/* Detail Card */}
      <div className="rounded-lg border border-border bg-card divide-y divide-border">
        <DetailRow label="入出金区分" value={INCOME_EXPENSE_LABELS[transaction.income_expense]} />
        <DetailRow label="対応種別" value={TRANSACTION_TYPE_LABELS[transaction.transaction_type]} />
        <DetailRow label="カテゴリ" value={categoryName} />
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm text-muted-foreground">金額</span>
          <CurrencyDisplay amount={transaction.amount} type={transaction.income_expense} showSign />
        </div>
        <DetailRow label="摘要" value={transaction.description} />
        {transaction.transaction_type === 'cash_advance' && transaction.billing_status && (
          <DetailRow label="請求状態" value={BILLING_STATUS_LABELS[transaction.billing_status] ?? transaction.billing_status} />
        )}
        {transaction.billing_year != null && transaction.billing_month != null && (
          <DetailRow label="請求対象月" value={`${transaction.billing_year}年${transaction.billing_month}月`} />
        )}
        {transaction.is_over_limit && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">立替上限超過</span>
            <span className="rounded bg-expense/10 px-1.5 py-0.5 text-xs font-medium text-expense">上限超過承認済</span>
          </div>
        )}
        {transaction.billing_id && (
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted-foreground">請求書</span>
            <Link to={`/billing/${transaction.billing_id}`} className="text-sm font-medium text-primary hover:underline">
              請求書を表示
            </Link>
          </div>
        )}
        {transaction.notes && <DetailRow label="備考" value={transaction.notes} />}
        <DetailRow label="記録者" value={transaction.recorder?.name ?? currentEmployee?.name ?? '-'} />
        <DetailRow label="記録日時" value={formatDate(transaction.created_at)} />
        {transaction.approved_at && (
          <DetailRow label="承認日時" value={formatDate(transaction.approved_at)} />
        )}
      </div>

      {/* Receipt Image */}
      {transaction.receipt_image_path && (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center gap-2 mb-3">
            <Receipt className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">証憑（レシート）</span>
          </div>
          {receiptUrl ? (
            <button
              type="button"
              onClick={() => setShowImageModal(true)}
              className="relative group w-full"
            >
              <img
                src={receiptUrl}
                alt="レシート画像"
                className="w-full max-h-48 rounded-md border border-border object-contain bg-muted/30"
              />
              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/0 group-hover:bg-black/20 transition-colors">
                <ZoomIn className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ) : (
            <p className="text-sm text-muted-foreground">画像を読み込み中...</p>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        {(transaction.approval_status === 'draft' || transaction.approval_status === 'rejected') && isRecorder && (
          <Link
            to={`/transactions/${transaction.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            <Pencil className="h-4 w-4" />
            編集
          </Link>
        )}
        {transaction.approval_status === 'draft' && isRecorder && (
          <ActionButton
            onClick={() => handleAction('submit')}
            disabled={isSubmitting}
            icon={<Send className="h-4 w-4" />}
            label="承認申請"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          />
        )}
        {transaction.approval_status === 'pending' && canApprove && isNotRecorder && (
          <>
            <ActionButton
              onClick={() => handleAction('approve')}
              disabled={isSubmitting}
              icon={<Check className="h-4 w-4" />}
              label="承認"
              className="bg-income text-white hover:bg-income/90"
            />
            <ActionButton
              onClick={() => handleAction('reject')}
              disabled={isSubmitting}
              icon={<X className="h-4 w-4" />}
              label="差戻し"
              className="bg-expense text-white hover:bg-expense/90"
            />
          </>
        )}
        {transaction.approval_status === 'rejected' && isRecorder && (
          <ActionButton
            onClick={() => handleAction('revert_to_draft')}
            disabled={isSubmitting}
            icon={<RotateCcw className="h-4 w-4" />}
            label="修正して再申請"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          />
        )}
        {transaction.approval_status === 'draft' && isRecorder && (
          <ActionButton
            onClick={() => setShowDeleteModal(true)}
            disabled={isSubmitting}
            icon={<Trash2 className="h-4 w-4" />}
            label="削除"
            className="border border-expense text-expense hover:bg-expense/10"
          />
        )}
      </div>

      {/* Confirm Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-bold">
              {showConfirmModal === 'submit' ? '承認申請の確認' : '承認の確認'}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {showConfirmModal === 'submit'
                ? 'この取引の承認申請を提出しますか？'
                : 'この取引を承認しますか？'}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowConfirmModal(null)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={() => executeAction(showConfirmModal)}
                disabled={isSubmitting}
                className={`rounded-md px-4 py-2 text-sm text-white disabled:opacity-50 ${
                  showConfirmModal === 'approve' ? 'bg-income hover:bg-income/90' : 'bg-primary hover:bg-primary/90'
                }`}
              >
                {showConfirmModal === 'submit' ? '申請する' : '承認する'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-bold">差戻し理由</h3>
            <textarea
              className="mt-3 w-full rounded-md border border-input bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              rows={4}
              placeholder="差戻し理由を入力してください..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => { setShowRejectModal(false); setRejectionReason('') }}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionReason.trim() || isSubmitting}
                className="rounded-md bg-expense px-4 py-2 text-sm text-white hover:bg-expense/90 disabled:opacity-50"
              >
                差戻し確定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-lg bg-card p-6 shadow-lg">
            <h3 className="text-lg font-bold text-expense">取引の削除</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              この取引を削除しますか？この操作は取り消せません。
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="rounded-md border border-input px-4 py-2 text-sm hover:bg-muted"
              >
                キャンセル
              </button>
              <button
                onClick={handleDelete}
                disabled={isSubmitting}
                className="rounded-md bg-expense px-4 py-2 text-sm text-white hover:bg-expense/90 disabled:opacity-50"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Fullscreen Modal */}
      {showImageModal && receiptUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setShowImageModal(false)}
        >
          <button
            onClick={() => setShowImageModal(false)}
            className="absolute top-4 right-4 rounded-full bg-black/60 p-2 text-white hover:bg-black/80"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={receiptUrl}
            alt="レシート画像"
            className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
            onClick={(e) => e.stopPropagation()}
          />
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

function ActionButton({
  onClick,
  disabled,
  icon,
  label,
  className,
}: {
  onClick: () => void
  disabled: boolean
  icon: React.ReactNode
  label: string
  className: string
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 ${className}`}
    >
      {icon}
      {label}
    </button>
  )
}
