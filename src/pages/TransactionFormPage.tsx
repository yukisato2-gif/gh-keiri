import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Camera } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { ABSTRACT_MASTER, get対応種別 } from '@/lib/constants'
import { toYearMonth, generateId } from '@/lib/utils'
import { notify高額入出金, notify通常入出金 } from '@/lib/notifications'
import { HIGH_VALUE_THRESHOLD } from '@/lib/constants'
import type { Transaction, User } from '@/types/database'

export function TransactionFormPage() {
  const navigate = useNavigate()
  const { id } = useParams()
  const isEdit = !!id
  const { user } = useAuthStore()
  const { 選択拠点 } = useLocationStore()

  const [users, setUsers] = useState<User[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    日付: new Date().toISOString().split('T')[0]!,
    摘要カテゴリ: '',
    金額: '',
    利用者: '',
    摘要: '',
    使用金額: '',
    入金おつり: '',
    不明金: '',
    不明金の理由: '',
  })
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)

  // 対応種別は摘要カテゴリから自動決定
  const 対応種別 = get対応種別(form.摘要カテゴリ) ?? ''

  // 利用者一覧を取得
  useEffect(() => {
    if (!選択拠点) return
    supabase
      .from('users')
      .select('*')
      .eq('拠点', 選択拠点)
      .then(({ data }) => setUsers((data ?? []) as User[]))
  }, [選択拠点])

  // 編集モード: 既存データを読み込み
  useEffect(() => {
    if (!id) return
    supabase
      .from('transactions')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (!data) return
        const t = data as Transaction
        setForm({
          日付: t.日付,
          摘要カテゴリ: t.摘要カテゴリ,
          金額: String(t.金額),
          利用者: t.利用者 ?? '',
          摘要: t.摘要 ?? '',
          使用金額: t.使用金額 ? String(t.使用金額) : '',
          入金おつり: t.入金おつり ? String(t.入金おつり) : '',
          不明金: t.不明金 ? String(t.不明金) : '',
          不明金の理由: t.不明金の理由 ?? '',
        })
        if (t.証憑) setImagePreview(t.証憑)
      })
  }, [id])

  // 摘要カテゴリに応じて表示するフィールドを制御
  const showUserField = ['立替金', '利用者預り金'].includes(対応種別)
  const showAmountBreakdown = 対応種別 === '立替金'
  const show不明金Fields = 対応種別 === '不明金'

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!選択拠点 || !user?.email) return
    setSaving(true)

    try {
      let 証憑url = imagePreview

      // 画像アップロード
      if (imageFile) {
        const fileName = `${generateId()}-${imageFile.name}`
        const { data: upload } = await supabase.storage
          .from('receipts')
          .upload(fileName, imageFile)
        if (upload) {
          const { data: { publicUrl } } = supabase.storage
            .from('receipts')
            .getPublicUrl(upload.path)
          証憑url = publicUrl
        }
      }

      const now = new Date().toISOString()
      const record = {
        拠点: 選択拠点,
        日付: form.日付,
        年月: toYearMonth(form.日付),
        対応種別,
        摘要カテゴリ: form.摘要カテゴリ,
        金額: Number(form.金額) || 0,
        利用者: form.利用者 || null,
        摘要: form.摘要 || null,
        証憑: 証憑url || null,
        使用金額: form.使用金額 ? Number(form.使用金額) : null,
        入金おつり: form.入金おつり ? Number(form.入金おつり) : null,
        不明金: form.不明金 ? Number(form.不明金) : null,
        不明金の理由: form.不明金の理由 || null,
        更新日時: now,
        更新者: user.email,
      }

      if (isEdit) {
        await supabase.from('transactions').update(record).eq('id', id)
      } else {
        const newId = generateId()
        await supabase.from('transactions').insert({
          id: newId,
          ...record,
          締めステータス: '未',
          修正依頼フラグ: false,
          作成日時: now,
          作成者: user.email,
        })

        // AppSheet Bot再現: 入出金通知
        const amount = Number(form.金額) || 0
        if (amount >= HIGH_VALUE_THRESHOLD) {
          notify高額入出金(選択拠点, amount, form.摘要カテゴリ, user.email, newId)
        } else {
          notify通常入出金(選択拠点, amount, form.摘要カテゴリ, user.email, newId)
        }
      }

      navigate('/transactions')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">
        {isEdit ? '入出金記録 編集' : '入出金記録'}
      </h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 日付 */}
        <FormField label="日付">
          <input
            type="date"
            value={form.日付}
            onChange={(e) => setForm({ ...form, 日付: e.target.value })}
            className="form-input"
            required
          />
        </FormField>

        {/* 摘要カテゴリ */}
        <FormField label="摘要カテゴリ">
          <select
            value={form.摘要カテゴリ}
            onChange={(e) => setForm({ ...form, 摘要カテゴリ: e.target.value })}
            className="form-input"
            required
          >
            <option value="">選択してください</option>
            {ABSTRACT_MASTER.map((a) => (
              <option key={a.摘要カテゴリ} value={a.摘要カテゴリ}>
                {a.摘要カテゴリ}
              </option>
            ))}
          </select>
        </FormField>

        {/* 対応種別 (自動表示) */}
        {対応種別 && (
          <FormField label="対応種別">
            <div className="form-input bg-gray-50 text-muted">{対応種別}</div>
          </FormField>
        )}

        {/* 金額 */}
        <FormField label="金額">
          <input
            type="number"
            value={form.金額}
            onChange={(e) => setForm({ ...form, 金額: e.target.value })}
            className="form-input"
            placeholder="0"
            min="0"
            required
          />
        </FormField>

        {/* 利用者 (立替金/利用者預り金の場合のみ) */}
        {showUserField && (
          <FormField label="利用者">
            <select
              value={form.利用者}
              onChange={(e) => setForm({ ...form, 利用者: e.target.value })}
              className="form-input"
            >
              <option value="">選択してください</option>
              {users.map((u) => (
                <option key={u.利用者id} value={u.利用者id}>
                  {u.利用者}
                </option>
              ))}
            </select>
          </FormField>
        )}

        {/* 使用金額 / おつり内訳 (立替金の場合) */}
        {showAmountBreakdown && (
          <>
            <FormField label="使用金額">
              <input
                type="number"
                value={form.使用金額}
                onChange={(e) => setForm({ ...form, 使用金額: e.target.value })}
                className="form-input"
                placeholder="0"
                min="0"
              />
            </FormField>
            <FormField label="入金（おつり）">
              <input
                type="number"
                value={form.入金おつり}
                onChange={(e) => setForm({ ...form, 入金おつり: e.target.value })}
                className="form-input"
                placeholder="0"
                min="0"
              />
            </FormField>
          </>
        )}

        {/* 不明金フィールド */}
        {show不明金Fields && (
          <FormField label="不明金の理由">
            <textarea
              value={form.不明金の理由}
              onChange={(e) => setForm({ ...form, 不明金の理由: e.target.value })}
              className="form-input"
              rows={2}
            />
          </FormField>
        )}

        {/* 摘要 */}
        <FormField label="摘要">
          <textarea
            value={form.摘要}
            onChange={(e) => setForm({ ...form, 摘要: e.target.value })}
            className="form-input"
            rows={2}
            placeholder="備考・メモ"
          />
        </FormField>

        {/* 証憑 (写真) */}
        <FormField label="証憑">
          <label className="flex items-center gap-2 cursor-pointer form-input">
            <Camera className="w-5 h-5 text-muted" />
            <span className="text-muted text-sm">
              {imageFile ? imageFile.name : '写真を撮影/選択'}
            </span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleImageChange}
              className="hidden"
            />
          </label>
          {imagePreview && (
            <img
              src={imagePreview}
              alt="証憑プレビュー"
              className="mt-2 w-full max-h-48 object-contain rounded-lg border border-border"
            />
          )}
        </FormField>

        {/* 送信 */}
        <button
          type="submit"
          disabled={saving}
          className="w-full bg-primary text-white rounded-lg px-4 py-3 font-medium hover:bg-primary-dark transition-colors disabled:opacity-50"
        >
          {saving ? '保存中...' : isEdit ? '更新' : '記録する'}
        </button>
      </form>
    </div>
  )
}

function FormField({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
      </label>
      {children}
    </div>
  )
}
