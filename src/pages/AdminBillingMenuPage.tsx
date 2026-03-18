import { useEffect, useState } from 'react'
import { Download, FileText } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, is本社管理者 } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency } from '@/lib/utils'
import { generate月次請求PDF } from '@/lib/pdfReport'

// AppSheet: 本社管理者 - 請求メニュー ダッシュボードビュー再現
// 本社管理者 - 集計&請求明細PDF + 本社管理者 - 利用者請求 のインラインビュー
export function AdminBillingMenuPage() {
  const { employee } = useAuthStore()

  if (!is本社管理者(employee)) {
    return (
      <div className="p-4 text-center text-muted">
        本社管理者のみアクセス可能です
      </div>
    )
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">本社管理者 - 請求メニュー</h2>
      <InlineBillingAggregation />
      <InlineBillingList />
    </div>
  )
}

// 集計&請求明細PDF インラインビュー
interface BillingRecord {
  請求id: string
  利用者: string
  拠点: string
  対象年月: number
  合計金額: number
  作成日時: string
  更新日時: string
}

function InlineBillingAggregation() {
  const now = new Date()
  const defaultYM = now.getFullYear() * 100 + (now.getMonth() + 1)
  const [targetYM, setTargetYM] = useState(defaultYM.toString())
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ 処理件数: number; 新規作成: number; 更新件数: number } | null>(null)

  const handleRun = async () => {
    const ym = parseInt(targetYM)
    if (isNaN(ym) || ym < 202000 || ym > 209912) return
    setRunning(true)
    setResult(null)

    const { data, error } = await supabase.rpc('run_monthly_billing', {
      target_yyyymm: ym,
    })

    if (error) {
      alert(`エラー: ${error.message}`)
    } else if (data && data.length > 0) {
      setResult(data[0])
    }
    setRunning(false)
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">集計&請求明細PDF</h3>
      <p className="text-xs text-muted mb-3">
        対象年月の立替金を利用者ごとに集計してmonthly_billingに反映します。
      </p>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <label className="block text-xs text-muted mb-1">対象年月 (YYYYMM)</label>
          <input
            type="number"
            value={targetYM}
            onChange={(e) => setTargetYM(e.target.value)}
            className="form-input"
            placeholder="202603"
          />
        </div>
        <button
          onClick={handleRun}
          disabled={running}
          className="bg-primary text-white rounded-lg px-4 py-2.5 font-medium text-sm disabled:opacity-50"
        >
          {running ? '実行中...' : '集計実行'}
        </button>
      </div>

      {result && (
        <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
          <p className="text-sm font-medium text-green-700">集計完了</p>
          <div className="text-xs text-green-600 mt-1 space-y-0.5">
            <p>処理件数: {result.処理件数}件</p>
            <p>新規作成: {result.新規作成}件</p>
            <p>更新: {result.更新件数}件</p>
          </div>
        </div>
      )}
    </div>
  )
}

// 利用者請求一覧 インラインビュー
function InlineBillingList() {
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(true)

  const fetchRecords = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('monthly_billing')
      .select('*')
      .order('対象年月', { ascending: false })
      .limit(100)
    setRecords((data ?? []) as BillingRecord[])
    setLoading(false)
  }

  useEffect(() => {
    fetchRecords()
  }, [])

  const formatYM = (ym: number) => {
    const y = Math.floor(ym / 100)
    const m = ym % 100
    return `${y}年${m}月`
  }

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">利用者請求</h3>
        <div className="flex gap-2">
          {records.length > 0 && (
            <>
              <button
                onClick={() => {
                  const header = '請求ID,利用者,拠点,対象年月,合計金額,作成日時,更新日時'
                  const rows = records.map((r) =>
                    [r.請求id, r.利用者, r.拠点, r.対象年月, r.合計金額, r.作成日時, r.更新日時]
                      .map((v) => `"${v ?? ''}"`)
                      .join(','),
                  )
                  const csv = '\uFEFF' + [header, ...rows].join('\n')
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = `利用者請求_${records[0]?.対象年月 ?? ''}.csv`
                  a.click()
                  URL.revokeObjectURL(url)
                }}
                className="flex items-center gap-1 text-xs text-primary"
              >
                <Download className="w-3 h-3" />
                CSV
              </button>
              <button
                onClick={() => {
                  const loc = useLocationStore.getState()
                  const locName = loc.myLocations.find((l) => l.拠点id === loc.選択拠点)?.拠点 ?? '全拠点'
                  const ym = records[0]?.対象年月
                  const ymStr = ym ? formatYM(ym) : ''
                  generate月次請求PDF(records, {
                    拠点名: locName,
                    対象年月: ymStr,
                    作成日: new Date().toLocaleDateString('ja-JP'),
                  })
                }}
                className="flex items-center gap-1 text-xs text-primary"
              >
                <FileText className="w-3 h-3" />
                PDF
              </button>
            </>
          )}
          <button onClick={() => fetchRecords()} className="text-xs text-primary">
            更新
          </button>
        </div>
      </div>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : records.length === 0 ? (
        <p className="text-center text-muted py-4">データがありません</p>
      ) : (
        <div className="space-y-2">
          {records.map((r) => (
            <div key={r.請求id} className="border border-border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{r.利用者}</span>
                <span className="font-bold text-sm">{formatCurrency(r.合計金額)}</span>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                <span>{formatYM(r.対象年月)}</span>
                <span>拠点: {r.拠点}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
