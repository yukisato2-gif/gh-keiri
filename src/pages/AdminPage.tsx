import { useEffect, useState } from 'react'
import { Users, Shield, MapPin, Building2, Receipt, FileText, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore, is本社管理者 } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency } from '@/lib/utils'
import { generate月次請求PDF } from '@/lib/pdfReport'
import type { Employee, Authority, Location, Area } from '@/types/database'

type Tab = 'employees' | 'authority' | 'locations' | 'areas' | 'billing'

export function AdminPage() {
  const { employee } = useAuthStore()
  const [tab, setTab] = useState<Tab>('employees')

  if (!is本社管理者(employee)) {
    return (
      <div className="p-4 text-center text-muted">
        本社管理者のみアクセス可能です
      </div>
    )
  }

  const tabs: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'employees', label: '従業員', icon: Users },
    { id: 'authority', label: '権限', icon: Shield },
    { id: 'locations', label: '拠点', icon: MapPin },
    { id: 'areas', label: 'エリア', icon: Building2 },
    { id: 'billing', label: '月次請求', icon: Receipt },
  ]

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold mb-4">管理設定</h2>

      {/* タブ */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-4">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === id
                ? 'bg-white shadow-sm text-primary'
                : 'text-muted'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {tab === 'employees' && <EmployeeList />}
      {tab === 'authority' && <AuthorityList />}
      {tab === 'locations' && <LocationList />}
      {tab === 'areas' && <AreaList />}
      {tab === 'billing' && <MonthlyBillingPanel />}
    </div>
  )
}

function EmployeeList() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('employees')
      .select('*')
      .order('従業員名')
      .then(({ data }) => {
        setEmployees((data ?? []) as Employee[])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-center py-4 text-muted">読み込み中...</div>

  return (
    <div className="space-y-2">
      {employees.map((e) => (
        <div key={e.従業員id} className="bg-card rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="font-medium">{e.従業員名}</span>
            <span className="text-xs bg-blue-100 text-blue-700 rounded px-2 py-0.5">
              {e.役職}
            </span>
          </div>
          <p className="text-sm text-muted mt-1">{e.メールアドレス}</p>
        </div>
      ))}
    </div>
  )
}

function AuthorityList() {
  const [authorities, setAuthorities] = useState<Authority[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('authority')
      .select('*')
      .order('従業員')
      .then(({ data }) => {
        setAuthorities((data ?? []) as Authority[])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-center py-4 text-muted">読み込み中...</div>

  return (
    <div className="space-y-2">
      {authorities.map((a) => (
        <div key={a.権限id} className="bg-card rounded-xl p-4 shadow-sm">
          <p className="font-medium">{a.従業員}</p>
          <p className="text-sm text-muted">拠点: {a.拠点}</p>
        </div>
      ))}
    </div>
  )
}

function LocationList() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('locations')
      .select('*')
      .order('拠点id')
      .then(({ data }) => {
        setLocations((data ?? []) as Location[])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-center py-4 text-muted">読み込み中...</div>

  return (
    <div className="space-y-2">
      {locations.map((l) => (
        <div key={l.拠点id} className="bg-card rounded-xl p-4 shadow-sm">
          <p className="font-medium">{l.拠点}</p>
          <p className="text-sm text-muted">エリア: {l.エリア}</p>
        </div>
      ))}
    </div>
  )
}

function AreaList() {
  const [areas, setAreas] = useState<Area[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('areas')
      .select('*')
      .order('エリアid')
      .then(({ data }) => {
        setAreas((data ?? []) as Area[])
        setLoading(false)
      })
  }, [])

  if (loading) return <div className="text-center py-4 text-muted">読み込み中...</div>

  return (
    <div className="space-y-2">
      {areas.map((a) => (
        <div key={a.エリアid} className="bg-card rounded-xl p-4 shadow-sm">
          <p className="font-medium">{a.エリア}</p>
        </div>
      ))}
    </div>
  )
}

// === 月次利用者請求集計 パネル ===
interface BillingRecord {
  請求id: string
  利用者: string
  拠点: string
  対象年月: number
  合計金額: number
  作成日時: string
  更新日時: string
}

function MonthlyBillingPanel() {
  const now = new Date()
  const defaultYM = now.getFullYear() * 100 + (now.getMonth() + 1)
  const [targetYM, setTargetYM] = useState(defaultYM.toString())
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<{ 処理件数: number; 新規作成: number; 更新件数: number } | null>(null)
  const [records, setRecords] = useState<BillingRecord[]>([])
  const [loading, setLoading] = useState(false)

  const fetchRecords = async (ym?: number) => {
    setLoading(true)
    const query = supabase
      .from('monthly_billing')
      .select('*')
      .order('対象年月', { ascending: false })

    if (ym) {
      query.eq('対象年月', ym)
    }

    const { data } = await query.limit(100)
    setRecords((data ?? []) as BillingRecord[])
    setLoading(false)
  }

  useEffect(() => {
    fetchRecords()
  }, [])

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
      fetchRecords(ym)
    }
    setRunning(false)
  }

  const formatYM = (ym: number) => {
    const y = Math.floor(ym / 100)
    const m = ym % 100
    return `${y}年${m}月`
  }

  return (
    <div className="space-y-4">
      {/* 手動実行パネル */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <h3 className="font-bold text-sm mb-3">月次利用者請求集計（手動実行）</h3>
        <p className="text-xs text-muted mb-3">
          AppSheet Bot「月次利用者請求集計（自動）」の手動実行版です。
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

      {/* 請求データ一覧 */}
      <div className="bg-card rounded-xl p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-sm">月次請求データ</h3>
          <div className="flex gap-2">
            {records.length > 0 && (
              <>
                <button
                  onClick={() => {
                    // CSV出力（利用者請求） AppSheet Action再現
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
            <button
              onClick={() => fetchRecords()}
              className="text-xs text-primary"
            >
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
    </div>
  )
}
