import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Edit, Camera, ImagePlus } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, is本社管理者, isSV, isホーム長 } from '@/stores/authStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import { notify修正依頼, notify修正完了 } from '@/lib/notifications'
import type { Transaction } from '@/types/database'

export function TransactionDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user, employee } = useAuthStore()
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [showCorrectionInput, setShowCorrectionInput] = useState(false)
  const [correctionContent, setCorrectionContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [show証憑修正, setShow証憑修正] = useState(false)
  const [証憑File, set証憑File] = useState<File | null>(null)
  const [証憑Preview, set証憑Preview] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setTransaction(data as Transaction | null)
        setLoading(false)
      })
  }, [id])

  if (loading) return <div className="p-4 text-center text-muted">読み込み中...</div>
  if (!transaction) return <div className="p-4 text-center text-muted">レコードが見つかりません</div>

  const t = transaction
  const canEdit = t.締めステータス === '未'
  const canSV締め = (isSV(employee) || is本社管理者(employee)) && t.締めステータス === '未'
  const can修正依頼 = (isSV(employee) || is本社管理者(employee)) && t.締めステータス === '済'
  const can修正依頼取消 = (isSV(employee) || is本社管理者(employee)) && t.修正依頼フラグ
  const can修正完了 = (isホーム長(employee) || is本社管理者(employee)) && t.修正依頼フラグ
  // AppSheet: 証憑修正 - 修正依頼中 かつ 本社管理者/SV/ホーム長 のみ
  const can証憑修正 = t.修正依頼フラグ && (is本社管理者(employee) || isSV(employee) || isホーム長(employee))

  // SV締め アクション
  const handleSV締め = async () => {
    const now = new Date().toISOString()
    await supabase
      .from('transactions')
      .update({
        締めステータス: '済',
        更新日時: now,
        更新者: user?.email,
      })
      .eq('id', t.id)
    navigate('/sv-closing')
  }

  // 修正依頼 アクション (AppSheet: [_INPUT] で修正依頼内容を入力)
  const handle修正依頼 = async () => {
    if (!correctionContent.trim()) return
    const now = new Date().toISOString()
    await supabase
      .from('transactions')
      .update({
        修正依頼フラグ: true,
        修正依頼内容: correctionContent,
        修正依頼者: user?.email,
        修正依頼日時: now,
        締めステータス: '未',
        更新日時: now,
        更新者: user?.email,
      })
      .eq('id', t.id)

    // Bot 3: 修正依頼通知
    await notify修正依頼(t.拠点, correctionContent, user!.email ?? '', t.id)

    navigate('/corrections')
  }

  // 修正依頼取消 アクション
  const handle修正依頼取消 = async () => {
    const now = new Date().toISOString()
    await supabase
      .from('transactions')
      .update({
        修正依頼フラグ: false,
        修正依頼内容: null,
        修正依頼者: null,
        修正依頼日時: null,
        更新日時: now,
        更新者: user?.email,
      })
      .eq('id', t.id)
    navigate(-1)
  }

  // 修正完了 アクション
  const handle修正完了 = async () => {
    const now = new Date().toISOString()
    await supabase
      .from('transactions')
      .update({
        修正依頼フラグ: false,
        更新日時: now,
        更新者: user?.email,
      })
      .eq('id', t.id)

    // Bot 5: 修正完了通知
    if (t.修正依頼者) {
      await notify修正完了(t.拠点, t.修正依頼者 ?? '', user!.email ?? '', t.id)
    }

    navigate('/corrections')
  }

  // 証憑修正 アクション (AppSheet: 証憑のみ編集フォーム)
  const handle証憑修正 = async () => {
    if (!証憑File) return
    const now = new Date().toISOString()
    const fileName = `${t.id}-${証憑File.name}`
    const { data: upload } = await supabase.storage
      .from('receipts')
      .upload(fileName, 証憑File)
    if (!upload) return

    const { data: { publicUrl } } = supabase.storage
      .from('receipts')
      .getPublicUrl(upload.path)

    await supabase
      .from('transactions')
      .update({ 証憑: publicUrl, 更新日時: now, 更新者: user?.email })
      .eq('id', t.id)

    setTransaction({ ...t, 証憑: publicUrl })
    setShow証憑修正(false)
    set証憑File(null)
    set証憑Preview(null)
  }

  return (
    <div className="p-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold">入出金詳細</h2>
      </div>

      {/* 修正依頼バナー */}
      {t.修正依頼フラグ && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4">
          <p className="text-sm font-bold text-red-700">修正依頼中</p>
          <p className="text-sm text-red-600 mt-1">{t.修正依頼内容}</p>
          <p className="text-xs text-red-400 mt-1">
            依頼者: {t.修正依頼者} / {t.修正依頼日時 && formatDate(t.修正依頼日時, 'yyyy/MM/dd HH:mm')}
          </p>
        </div>
      )}

      {/* 詳細 */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-3">
        <DetailRow label="日付" value={formatDate(t.日付)} />
        <DetailRow label="対応種別" value={t.対応種別} />
        <DetailRow label="摘要カテゴリ" value={t.摘要カテゴリ} />
        <DetailRow
          label="金額"
          value={`${is入金(t.対応種別) ? '+' : '-'}${formatCurrency(t.金額)}`}
          className={is入金(t.対応種別) ? 'text-success' : 'text-danger'}
        />
        {t.利用者 && <DetailRow label="利用者" value={t.利用者} />}
        {t.摘要 && <DetailRow label="摘要" value={t.摘要} />}
        {t.使用金額 != null && (
          <DetailRow label="使用金額" value={formatCurrency(t.使用金額)} />
        )}
        {t.入金おつり != null && (
          <DetailRow label="入金（おつり）" value={formatCurrency(t.入金おつり)} />
        )}
        {t.不明金 != null && (
          <DetailRow label="不明金" value={formatCurrency(t.不明金)} />
        )}
        {t.不明金の理由 && <DetailRow label="不明金の理由" value={t.不明金の理由} />}
        <DetailRow label="締めステータス" value={t.締めステータス} />
        <DetailRow label="作成者" value={t.作成者} />
        <DetailRow
          label="作成日時"
          value={formatDate(t.作成日時, 'yyyy/MM/dd HH:mm')}
        />

        {/* 証憑画像 */}
        {t.証憑 && (
          <div>
            <p className="text-xs text-muted mb-1">証憑</p>
            <img
              src={t.証憑}
              alt="証憑"
              className="w-full max-h-64 object-contain rounded-lg border border-border"
            />
          </div>
        )}
      </div>

      {/* アクションボタン (AppSheet Actions 再現) */}
      <div className="mt-4 space-y-2">
        {canEdit && (
          <button
            onClick={() => navigate(`/transactions/${t.id}/edit`)}
            className="w-full flex items-center justify-center gap-2 bg-primary text-white rounded-lg px-4 py-3 font-medium"
          >
            <Edit className="w-4 h-4" />
            編集
          </button>
        )}

        {canSV締め && (
          <button
            onClick={handleSV締め}
            className="w-full bg-green-600 text-white rounded-lg px-4 py-3 font-medium"
          >
            SV締め
          </button>
        )}

        {can修正依頼 && !showCorrectionInput && (
          <button
            onClick={() => setShowCorrectionInput(true)}
            className="w-full bg-warning text-white rounded-lg px-4 py-3 font-medium"
          >
            修正依頼
          </button>
        )}

        {showCorrectionInput && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-2">
            <textarea
              value={correctionContent}
              onChange={(e) => setCorrectionContent(e.target.value)}
              className="form-input"
              placeholder="修正依頼内容を入力してください"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                onClick={handle修正依頼}
                className="flex-1 bg-warning text-white rounded-lg px-4 py-2 font-medium text-sm"
              >
                送信
              </button>
              <button
                onClick={() => setShowCorrectionInput(false)}
                className="flex-1 bg-gray-200 rounded-lg px-4 py-2 text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}

        {can修正依頼取消 && (
          <button
            onClick={handle修正依頼取消}
            className="w-full bg-gray-500 text-white rounded-lg px-4 py-3 font-medium"
          >
            修正依頼取消
          </button>
        )}

        {can修正完了 && (
          <button
            onClick={handle修正完了}
            className="w-full bg-success text-white rounded-lg px-4 py-3 font-medium"
          >
            修正完了
          </button>
        )}

        {can証憑修正 && !show証憑修正 && (
          <button
            onClick={() => setShow証憑修正(true)}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white rounded-lg px-4 py-3 font-medium"
          >
            <ImagePlus className="w-4 h-4" />
            証憑修正
          </button>
        )}

        {show証憑修正 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
            <p className="text-sm font-medium text-blue-700">証憑を差し替え</p>
            <label className="flex items-center gap-2 cursor-pointer form-input bg-white">
              <Camera className="w-5 h-5 text-muted" />
              <span className="text-muted text-sm">
                {証憑File ? 証憑File.name : '写真を撮影/選択'}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  set証憑File(file)
                  set証憑Preview(URL.createObjectURL(file))
                }}
                className="hidden"
              />
            </label>
            {証憑Preview && (
              <img
                src={証憑Preview}
                alt="新しい証憑"
                className="w-full max-h-48 object-contain rounded-lg border border-border"
              />
            )}
            <div className="flex gap-2">
              <button
                onClick={handle証憑修正}
                disabled={!証憑File}
                className="flex-1 bg-blue-600 text-white rounded-lg px-4 py-2 font-medium text-sm disabled:opacity-50"
              >
                更新
              </button>
              <button
                onClick={() => {
                  setShow証憑修正(false)
                  set証憑File(null)
                  set証憑Preview(null)
                }}
                className="flex-1 bg-gray-200 rounded-lg px-4 py-2 text-sm"
              >
                キャンセル
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  className,
}: {
  label: string
  value: string
  className?: string
}) {
  return (
    <div className="flex justify-between items-center py-1 border-b border-gray-50">
      <span className="text-sm text-muted">{label}</span>
      <span className={`text-sm font-medium ${className ?? ''}`}>{value}</span>
    </div>
  )
}
