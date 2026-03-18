import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useLocationStore } from '@/stores/locationStore'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Transaction, User } from '@/types/database'

// AppSheet: ホーム長メニュー ダッシュボードビュー再現
// SV-修正依頼一覧 + ホーム長-差額調整一覧 + ホーム長-利用者 のインラインビュー
export function HomeMenuPage() {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-bold">ホーム長メニュー</h2>
      <InlineCorrectionList />
      <InlineDifferenceList />
      <InlineUserList />
    </div>
  )
}

// 修正依頼一覧 インラインビュー
function InlineCorrectionList() {
  const navigate = useNavigate()
  const { 選択拠点 } = useLocationStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('拠点', 選択拠点)
      .eq('修正依頼フラグ', true)
      .order('修正依頼日時', { ascending: false })
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">修正依頼一覧</h3>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : transactions.length === 0 ? (
        <p className="text-center text-muted py-4">修正依頼中の記録はありません</p>
      ) : (
        <div className="space-y-2">
          {transactions.map((t) => (
            <button
              key={t.id}
              onClick={() => navigate(`/transactions/${t.id}`)}
              className="w-full text-left border-l-4 border-warning rounded-lg p-3 border border-border"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted">{formatDate(t.日付)}</span>
                <span className="font-bold text-sm">{formatCurrency(t.金額)}</span>
              </div>
              <p className="text-sm mt-1">{t.摘要カテゴリ}</p>
              <p className="text-xs text-muted mt-1 truncate">{t.修正依頼内容}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// 利用者一覧 インラインビュー
function InlineUserList() {
  const { 選択拠点 } = useLocationStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('users')
      .select('*')
      .eq('拠点', 選択拠点)
      .order('利用者')
      .then(({ data }) => {
        setUsers((data ?? []) as User[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">利用者一覧</h3>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : users.length === 0 ? (
        <p className="text-center text-muted py-4">利用者がいません</p>
      ) : (
        <div className="space-y-1">
          {users.map((u) => (
            <div key={u.利用者id} className="flex items-center justify-between border border-border rounded-lg p-2">
              <span className="text-sm font-medium">{u.利用者}</span>
              <span className="text-xs text-muted">{u.拠点}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// 差額調整一覧 インラインビュー
function InlineDifferenceList() {
  const { 選択拠点 } = useLocationStore()
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!選択拠点) return
    setLoading(true)
    supabase
      .from('transactions')
      .select('*')
      .eq('拠点', 選択拠点)
      .in('対応種別', ['入金', '出金'])
      .order('日付', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setTransactions((data ?? []) as Transaction[])
        setLoading(false)
      })
  }, [選択拠点])

  return (
    <div className="bg-card rounded-xl shadow-sm p-4">
      <h3 className="font-bold text-sm mb-3">差額調整一覧</h3>

      {loading ? (
        <p className="text-center text-muted py-4">読み込み中...</p>
      ) : transactions.length === 0 ? (
        <p className="text-center text-muted py-4">差額調整記録がありません</p>
      ) : (
        <div className="space-y-1">
          {transactions.map((t) => (
            <div key={t.id} className="flex items-center justify-between border border-border rounded-lg p-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted">{formatDate(t.日付)}</span>
                <span className={`text-xs rounded px-1 py-0.5 ${
                  t.対応種別 === '入金' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'
                }`}>
                  {t.対応種別}
                </span>
              </div>
              <span className="font-bold text-sm">{formatCurrency(t.金額)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

