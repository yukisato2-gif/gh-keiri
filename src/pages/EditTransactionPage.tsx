import { useState, useMemo, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTransaction, useEditTransaction, useCategories, useCurrentEmployee, useResidents, useCurrentLocation, useMonthlyClose, useResidentBalances, useAddAuditLog } from '@/hooks/useAppData'
import { TRANSACTION_TYPE_LABELS, HIGH_VALUE_THRESHOLD } from '@/lib/constants'
import { formatCurrency, toISODate } from '@/lib/formatters'
import { uploadReceiptImage, getReceiptImageUrl } from '@/lib/storage'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import type { TransactionType, IncomeExpenseType } from '@/types/database'
import { extractReceiptData, type OCRResult } from '@/lib/ocr'
import { ArrowLeft, AlertTriangle, Camera, X, Loader2, ScanLine } from 'lucide-react'

export function EditTransactionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { transaction, isLoading } = useTransaction(id)
  const editTransaction = useEditTransaction()
  const categories = useCategories()
  const employee = useCurrentEmployee()
  const { locationId: currentLocationId } = useCurrentLocation()
  const { residents } = useResidents(currentLocationId)
  const residentBalances = useResidentBalances(currentLocationId)
  const addAuditLog = useAddAuditLog()

  const [date, setDate] = useState('')
  const [residentId, setResidentId] = useState('')
  const [incomeExpense, setIncomeExpense] = useState<IncomeExpenseType>('expense')
  const [transactionType, setTransactionType] = useState<TransactionType>('cash_advance')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [receiptFile, setReceiptFile] = useState<File | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null)
  const [existingReceiptPath, setExistingReceiptPath] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [modificationReason, setModificationReason] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // OCR state
  const [isOcrProcessing, setIsOcrProcessing] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)
  const [ocrSuggestion, setOcrSuggestion] = useState<OCRResult | null>(null)

  const billingMonth = date ? date.substring(0, 7) : ''
  const monthlyClose = useMonthlyClose(currentLocationId, billingMonth)
  const isClosedMonth = monthlyClose?.status === 'closed' || monthlyClose?.status === 'modified'
  const isResidentRequired = transactionType === 'cash_advance'

  // Initialize form from transaction data
  useEffect(() => {
    if (transaction && !initialized) {
      setDate(transaction.transaction_date)
      setIncomeExpense(transaction.income_expense)
      setTransactionType(transaction.transaction_type)
      setCategoryId(transaction.category_id)
      setDescription(transaction.description)
      setAmount(String(transaction.amount))
      setNotes(transaction.notes ?? '')
      setExistingReceiptPath(transaction.receipt_image_path)
      setResidentId(transaction.resident_id ?? '')

      if (transaction.receipt_image_path) {
        getReceiptImageUrl(transaction.receipt_image_path).then((url) => {
          if (url) setReceiptPreview(url)
        })
      }

      setInitialized(true)
    }
  }, [transaction, initialized])

  const filteredCategories = useMemo(
    () => categories.filter((c) => c.income_expense === incomeExpense),
    [categories, incomeExpense]
  )

  const amountNum = parseInt(amount, 10) || 0
  const isHighValue = amountNum >= HIGH_VALUE_THRESHOLD

  // 立替上限超過チェック
  const selectedResident = residents.find((r) => r.id === residentId)
  const residentBalance = residentBalances.find((rb) => rb.resident_id === residentId)
  const isOverLimit = (() => {
    if (!isResidentRequired || !residentId || !selectedResident?.advance_limit) return false
    const currentBalance = residentBalance?.total_balance ?? 0
    // 編集時は元の金額を差し引いて再計算
    const originalAmount = transaction?.amount ?? 0
    return (currentBalance - originalAmount + amountNum) > selectedResident.advance_limit
  })()
  const canApproveOverLimit = employee?.role === 'supervisor' || employee?.role === 'section_chief' || employee?.role === 'hq_admin'

  const isDateValid = (() => {
    if (!date) return false
    const todayStr = toISODate(new Date())
    const ninetyDaysAgo = new Date()
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90)
    return date <= todayStr && date >= toISODate(ninetyDaysAgo)
  })()

  const canSubmit = date && isDateValid && categoryId && description.trim() && amountNum > 0
    && (!isResidentRequired || residentId)
    && (!isClosedMonth || modificationReason.trim())
    && (!isOverLimit || canApproveOverLimit)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    setUploadError(null)
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('ファイルサイズが5MBを超えています')
      return
    }
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  const removeReceipt = () => {
    setReceiptFile(null)
    if (receiptPreview && !existingReceiptPath) URL.revokeObjectURL(receiptPreview)
    setReceiptPreview(null)
    setExistingReceiptPath(null)
    setUploadError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleOcr = async () => {
    if (!receiptFile || isOcrProcessing) return
    setIsOcrProcessing(true)
    setOcrError(null)
    setOcrSuggestion(null)
    try {
      const result = await extractReceiptData(receiptFile)
      if (result.amount > 0) setAmount(String(result.amount))
      if (result.date || result.description) setOcrSuggestion(result)
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : '読み取りに失敗しました')
    } finally {
      setIsOcrProcessing(false)
    }
  }

  const applyOcrDate = () => {
    if (ocrSuggestion?.date) setDate(ocrSuggestion.date)
    setOcrSuggestion((s) => s ? { ...s, date: undefined } : null)
  }

  const applyOcrDescription = () => {
    if (ocrSuggestion?.description) {
      const prefix = ocrSuggestion.storeName ? `${ocrSuggestion.storeName} ` : ''
      setDescription(prefix + ocrSuggestion.description)
    }
    setOcrSuggestion((s) => s ? { ...s, description: undefined, storeName: undefined } : null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit || isSubmitting || !transaction) return

    setIsSubmitting(true)
    setUploadError(null)

    let receiptPath = existingReceiptPath
    if (receiptFile) {
      const { path, error: uploadErr } = await uploadReceiptImage(receiptFile, employee.id)
      if (uploadErr) {
        setUploadError(uploadErr)
        setIsSubmitting(false)
        return
      }
      receiptPath = path
    } else if (!receiptPreview) {
      receiptPath = null
    }

    const notesWithReason = isClosedMonth && modificationReason.trim()
      ? `${notes.trim() ? notes.trim() + '\n' : ''}[締め後修正] ${modificationReason.trim()}`
      : notes.trim() || null

    const { error } = await editTransaction(transaction.id, {
      transaction_date: date,
      transaction_type: transactionType,
      income_expense: incomeExpense,
      category_id: categoryId,
      resident_id: residentId || null,
      description: description.trim(),
      amount: amountNum,
      receipt_image_path: receiptPath,
      notes: notesWithReason,
      billing_year: transactionType === 'cash_advance' && date ? parseInt(date.substring(0, 4), 10) : null,
      billing_month: transactionType === 'cash_advance' && date ? parseInt(date.substring(5, 7), 10) : null,
      is_over_limit: isOverLimit,
      over_limit_approved_by: isOverLimit ? employee.id : null,
      over_limit_approved_at: isOverLimit ? new Date().toISOString() : null,
    })

    if (error) {
      console.error('Failed to update transaction:', error)
      setIsSubmitting(false)
      return
    }

    // 上限超過の監査ログ
    if (isOverLimit) {
      await addAuditLog({
        table_name: 'transactions',
        record_id: transaction.id,
        action: 'UPDATE',
        old_data: { amount: transaction.amount },
        new_data: {
          action_type: 'over_limit_approved',
          resident_id: residentId,
          amount: amountNum,
          advance_limit: selectedResident?.advance_limit,
          current_balance: residentBalance?.total_balance,
          approved_by: employee.id,
        },
        changed_by: employee.id,
      })
    }

    // 締め後修正の監査ログ
    if (isClosedMonth && modificationReason.trim()) {
      await addAuditLog({
        table_name: 'transactions',
        record_id: transaction.id,
        action: 'UPDATE',
        old_data: { amount: transaction.amount, description: transaction.description },
        new_data: {
          action_type: 'post_close_modification',
          month: billingMonth,
          reason: modificationReason.trim(),
        },
        changed_by: employee.id,
      })
    }

    navigate(`/transactions/${transaction.id}`)
  }

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

  const canEdit = (transaction.approval_status === 'draft' || transaction.approval_status === 'rejected') &&
    transaction.recorded_by === employee?.id

  if (!canEdit) {
    return (
      <div className="space-y-4">
        <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> 戻る
        </button>
        <p className="text-center text-muted-foreground">この取引は編集できません</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="rounded-md p-1.5 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="text-xl font-bold">入出金記録の編集</h2>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-card p-4 lg:p-6">
        {/* 入出金区分 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">入出金区分</label>
          <div className="flex gap-2">
            {(['income', 'expense'] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => { setIncomeExpense(type); setCategoryId('') }}
                className={`flex-1 rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
                  incomeExpense === type
                    ? type === 'income'
                      ? 'border-income bg-income/10 text-income'
                      : 'border-expense bg-expense/10 text-expense'
                    : 'border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                {type === 'income' ? '入金' : '出金'}
              </button>
            ))}
          </div>
        </div>

        {/* 日付 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">日付</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            max={toISODate(new Date())}
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
              !isDateValid ? 'border-expense' : 'border-input'
            }`}
          />
          {!isDateValid && (
            <p className="mt-1 text-xs text-expense">未来の日付、または90日以上前の日付は入力できません</p>
          )}
        </div>

        {/* 対応種別 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">対応種別</label>
          <select
            value={transactionType}
            onChange={(e) => setTransactionType(e.target.value as TransactionType)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {Object.entries(TRANSACTION_TYPE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </div>

        {/* カテゴリ */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">摘要カテゴリ</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">選択してください</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>

        {/* 締め済み月警告 */}
        {isClosedMonth && (
          <div className="flex items-center gap-1.5 rounded-md bg-warning/10 border border-warning/30 p-3">
            <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
            <div>
              <p className="text-sm font-medium text-warning">SV締め済みの月です</p>
              <p className="text-xs text-warning/80">編集には修正理由の入力が必要です。修正は監査ログに記録されます。</p>
            </div>
          </div>
        )}

        {/* 利用者 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">
            利用者{isResidentRequired ? '（必須）' : '（任意）'}
          </label>
          <select
            value={residentId}
            onChange={(e) => setResidentId(e.target.value)}
            className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring ${
              isResidentRequired && !residentId ? 'border-expense' : 'border-input'
            }`}
          >
            <option value="">指定なし</option>
            {residents.filter((r) => r.is_active || r.id === residentId).map((r) => (
              <option key={r.id} value={r.id}>{r.name}{!r.is_active ? '（無効）' : ''}</option>
            ))}
          </select>
          {isResidentRequired && !residentId && (
            <p className="mt-1 text-xs text-expense">立替金の場合、利用者の選択は必須です</p>
          )}
        </div>

        {/* 金額 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">金額</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">¥</span>
            <input
              type="number"
              inputMode="numeric"
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full rounded-md border border-input pl-7 pr-3 py-2 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          {isHighValue && (
            <div className="mt-1.5 flex items-center gap-1.5 rounded-md bg-warning/10 p-2">
              <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
              <p className="text-xs text-warning">
                高額取引 ({formatCurrency(HIGH_VALUE_THRESHOLD)}以上) です。担当SV・本社管理者に通知されます。
              </p>
            </div>
          )}
        </div>

        {/* 立替上限超過警告 */}
        {isOverLimit && (
          <div className="flex items-center gap-1.5 rounded-md bg-expense/10 border border-expense/30 p-3">
            <AlertTriangle className="h-4 w-4 text-expense shrink-0" />
            <div>
              <p className="text-sm font-medium text-expense">立替上限を超過しています</p>
              <p className="text-xs text-expense/80">
                上限額: {formatCurrency(selectedResident?.advance_limit ?? 0)} / 現在残高: {formatCurrency((residentBalance?.total_balance ?? 0) - (transaction?.amount ?? 0))} + 今回: {formatCurrency(amountNum)}
              </p>
              {canApproveOverLimit ? (
                <p className="text-xs text-warning mt-1">SV以上の権限で承認登録されます。監査ログに記録されます。</p>
              ) : (
                <p className="text-xs text-expense mt-1">ホーム長は上限超過時の登録ができません。SVに承認を依頼してください。</p>
              )}
            </div>
          </div>
        )}

        {/* 摘要 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">摘要・内容</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="例: 利用者A 食料品購入"
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* 証憑 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">証憑（レシート）</label>
          {receiptPreview ? (
            <div className="relative">
              <img
                src={receiptPreview}
                alt="レシートプレビュー"
                className="w-full max-h-64 rounded-md border border-border object-contain bg-muted/30"
              />
              <button
                type="button"
                onClick={removeReceipt}
                className="absolute top-2 right-2 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-md border-2 border-dashed border-border px-4 py-6 text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors">
              <Camera className="h-5 w-5" />
              <span>撮影またはファイルを選択</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          )}
          {receiptFile && (
            <button
              type="button"
              onClick={handleOcr}
              disabled={isOcrProcessing}
              className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isOcrProcessing ? (
                <><Loader2 className="h-4 w-4 animate-spin" />読み取り中...</>
              ) : (
                <><ScanLine className="h-4 w-4" />金額を読み取る</>
              )}
            </button>
          )}
          {ocrError && (
            <p className="mt-1 text-xs text-expense">{ocrError}</p>
          )}
          {ocrSuggestion && (ocrSuggestion.date || ocrSuggestion.description) && (
            <div className="mt-2 rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
              <p className="text-xs font-medium text-primary">読み取り結果</p>
              {ocrSuggestion.date && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">日付: {ocrSuggestion.date}</span>
                  <button type="button" onClick={applyOcrDate} className="rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10">適用</button>
                </div>
              )}
              {ocrSuggestion.description && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground truncate mr-2">
                    摘要: {ocrSuggestion.storeName ? `${ocrSuggestion.storeName} ` : ''}{ocrSuggestion.description}
                  </span>
                  <button type="button" onClick={applyOcrDescription} className="rounded px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/10 shrink-0">適用</button>
                </div>
              )}
            </div>
          )}
          {uploadError && (
            <p className="mt-1 text-xs text-expense">{uploadError}</p>
          )}
        </div>

        {/* 備考 */}
        <div>
          <label className="mb-1.5 block text-sm font-medium">備考</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="補足事項があれば入力"
            className="w-full rounded-md border border-input px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
          />
        </div>

        {/* 締め後修正理由 */}
        {isClosedMonth && (
          <div>
            <label className="mb-1.5 block text-sm font-medium text-warning">修正理由（必須）</label>
            <textarea
              value={modificationReason}
              onChange={(e) => setModificationReason(e.target.value)}
              rows={2}
              placeholder="SV締め済みの月のデータを編集する理由を入力してください"
              className={`w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none ${
                !modificationReason.trim() ? 'border-warning' : 'border-input'
              }`}
            />
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isSubmitting ? '保存中...' : '変更を保存'}
          </button>
        </div>
      </form>
    </div>
  )
}
