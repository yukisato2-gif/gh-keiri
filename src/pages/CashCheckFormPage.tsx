import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, AlertTriangle, CheckCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, generateId, toYearMonth } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import { notify残高不一致, notify不足過剰アラート } from '@/lib/notifications'
import type { Transaction } from '@/types/database'

export function CashCheckFormPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { 選択拠点 } = useLocationStore()
  const [saving, setSaving] = useState(false)
  const [日付, set日付] = useState(new Date().toISOString().split('T')[0]!)
  const [counts, setCounts] = useState({
    一万円札: 0,
    五千円札: 0,
    二千円札: 0,
    千円札: 0,
    五百円玉: 0,
    百円硬貨: 0,
    五十円玉: 0,
    十円硬貨: 0,
    五円硬貨: 0,
    一円硬貨: 0,
  })
  const [メモ, setメモ] = useState('')
  const [記録時残高, set記録時残高] = useState(0)

  // 計算合計金額 (Virtual Column 再現)
  const 計算合計金額 =
    counts.一万円札 * 10000 +
    counts.五千円札 * 5000 +
    counts.二千円札 * 2000 +
    counts.千円札 * 1000 +
    counts.五百円玉 * 500 +
    counts.百円硬貨 * 100 +
    counts.五十円玉 * 50 +
    counts.十円硬貨 * 10 +
    counts.五円硬貨 * 5 +
    counts.一円硬貨 * 1

  const 記録時差額 = 計算合計金額 - 記録時残高
  const 差額不足 = 記録時差額 < 0 ? Math.abs(記録時差額) : 0
  const 差額過剰 = 記録時差額 > 0 ? 記録時差額 : 0
  const 残高一致 = 記録時差額 === 0

  // 記録時残高を計算 (Transactions合計から算出)
  useEffect(() => {
    if (!選択拠点) return
    supabase
      .from('transactions')
      .select('金額, 対応種別')
      .eq('拠点', 選択拠点)
      .then(({ data }) => {
        const txs = (data ?? []) as unknown as Pick<Transaction, '金額' | '対応種別'>[]
        let balance = 0
        for (const t of txs) {
          if (is入金(t.対応種別)) {
            balance += t.金額
          } else {
            balance -= t.金額
          }
        }
        set記録時残高(balance)
      })
  }, [選択拠点])

  const setCount = (key: keyof typeof counts, value: number) => {
    setCounts((prev) => ({ ...prev, [key]: Math.max(0, value) }))
  }

  const handleSubmit = async () => {
    if (!選択拠点 || !user?.email) return
    setSaving(true)
    const now = new Date().toISOString()

    await supabase.from('checks').insert({
      check_id: generateId(),
      拠点: 選択拠点,
      日付,
      ...counts,
      メモ特記事項: メモ || null,
      差額登録済フラグ: false,
      作成日時: now,
      作成者: user.email,
      更新日時: now,
      更新者: user.email,
    })

    // Bot 6: 残高不一致の場合に通知
    if (!残高一致) {
      await notify残高不一致(選択拠点, 記録時差額, user.email)
    }

    navigate('/cash-check')
    setSaving(false)
  }

  // 差額登録アクション (AppSheet: 過剰金額登録 / 不足金額登録)
  const handle差額登録 = async (type: '過剰' | '不足') => {
    if (!選択拠点 || !user?.email) return
    setSaving(true)
    const now = new Date().toISOString()

    // 1. Check レコードを保存
    const checkId = generateId()
    await supabase.from('checks').insert({
      check_id: checkId,
      拠点: 選択拠点,
      日付,
      ...counts,
      メモ特記事項: メモ || null,
      差額登録済フラグ: true,
      作成日時: now,
      作成者: user.email,
      更新日時: now,
      更新者: user.email,
    })

    // 2. Transactions に差額レコードを自動作成 (AppSheet Action 再現)
    await supabase.from('transactions').insert({
      id: generateId(),
      拠点: 選択拠点,
      日付,
      年月: toYearMonth(日付),
      対応種別: type === '過剰' ? '入金' : '出金',
      摘要カテゴリ: type === '過剰' ? '過剰金額登録' : '不足金額登録',
      金額: type === '過剰' ? 差額過剰 : 差額不足,
      利用者: null,
      摘要: null,
      証憑: null,
      締めステータス: '未',
      修正依頼フラグ: false,
      使用金額: null,
      入金おつり: null,
      不明金: null,
      不明金の理由: null,
      作成日時: now,
      作成者: user.email,
      更新日時: now,
      更新者: user.email,
    })

    // Bot 4: 不足/過剰金額登録アラート
    const 金額 = type === '過剰' ? 差額過剰 : 差額不足
    await notify不足過剰アラート(選択拠点, type, 金額, user.email)

    navigate('/cash-check')
    setSaving(false)
  }

  const denominations: { key: keyof typeof counts; label: string; unit: number }[] = [
    { key: '一万円札', label: '一万円札', unit: 10000 },
    { key: '五千円札', label: '五千円札', unit: 5000 },
    { key: '二千円札', label: '二千円札', unit: 2000 },
    { key: '千円札', label: '千円札', unit: 1000 },
    { key: '五百円玉', label: '五百円玉', unit: 500 },
    { key: '百円硬貨', label: '百円硬貨', unit: 100 },
    { key: '五十円玉', label: '五十円玉', unit: 50 },
    { key: '十円硬貨', label: '十円硬貨', unit: 10 },
    { key: '五円硬貨', label: '五円硬貨', unit: 5 },
    { key: '一円硬貨', label: '一円硬貨', unit: 1 },
  ]

  return (
    <div className="p-4">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={() => navigate('/cash-check')}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-bold">残高チェック</h2>
      </div>

      {/* 日付 */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">日付</label>
        <input
          type="date"
          value={日付}
          onChange={(e) => set日付(e.target.value)}
          className="form-input"
        />
      </div>

      {/* 紙幣・硬貨枚数入力 */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-3 mb-4">
        <h3 className="font-bold text-sm">紙幣・硬貨の枚数</h3>
        {denominations.map(({ key, label, unit }) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm">{label}</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={counts[key]}
                onChange={(e) => setCount(key, parseInt(e.target.value) || 0)}
                className="w-20 text-right form-input py-1 px-2"
                min="0"
              />
              <span className="text-xs text-muted w-20 text-right">
                {formatCurrency(counts[key] * unit)}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* 計算結果 (Virtual Column 再現) */}
      <div className="bg-card rounded-xl shadow-sm p-4 space-y-2 mb-4">
        <div className="flex justify-between">
          <span className="text-sm">計算合計金額</span>
          <span className="font-bold">{formatCurrency(計算合計金額)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm">記録時残高</span>
          <span className="font-bold">{formatCurrency(記録時残高)}</span>
        </div>
        <div className="flex justify-between border-t pt-2">
          <span className="text-sm font-bold">差額</span>
          <span className={`font-bold ${残高一致 ? 'text-success' : 'text-danger'}`}>
            {formatCurrency(記録時差額)}
          </span>
        </div>

        {残高一致 ? (
          <div className="flex items-center gap-2 text-success text-sm mt-2">
            <CheckCircle className="w-4 h-4" />
            残高一致
          </div>
        ) : (
          <div className="flex items-center gap-2 text-danger text-sm mt-2">
            <AlertTriangle className="w-4 h-4" />
            {差額過剰 > 0 ? `過剰: ${formatCurrency(差額過剰)}` : `不足: ${formatCurrency(差額不足)}`}
          </div>
        )}
      </div>

      {/* メモ */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          メモ/特記事項
        </label>
        <textarea
          value={メモ}
          onChange={(e) => setメモ(e.target.value)}
          className="form-input"
          rows={2}
        />
      </div>

      {/* アクションボタン */}
      <div className="space-y-2">
        {残高一致 ? (
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="w-full bg-primary text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        ) : (
          <>
            {差額過剰 > 0 && (
              <button
                onClick={() => handle差額登録('過剰')}
                disabled={saving}
                className="w-full bg-purple-600 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
              >
                過剰金額登録 ({formatCurrency(差額過剰)})
              </button>
            )}
            {差額不足 > 0 && (
              <button
                onClick={() => handle差額登録('不足')}
                disabled={saving}
                className="w-full bg-orange-600 text-white rounded-lg px-4 py-3 font-medium disabled:opacity-50"
              >
                不足金額登録 ({formatCurrency(差額不足)})
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="w-full bg-gray-200 rounded-lg px-4 py-3 font-medium text-sm disabled:opacity-50"
            >
              差額登録せずに保存
            </button>
          </>
        )}
      </div>
    </div>
  )
}
