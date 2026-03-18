import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, CheckCheck } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'

interface Notification {
  id: string
  type: string
  title: string
  body: string | null
  拠点: string | null
  recipient_email: string | null
  recipient_role: string | null
  related_id: string | null
  read: boolean
  created_by: string
  created_at: string
}

export function NotificationListPage() {
  const navigate = useNavigate()
  const { employee } = useAuthStore()
  const { 選択拠点 } = useLocationStore()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employee || !選択拠点) return

    const fetchNotifications = async () => {
      // 自分のrole or email宛の通知 + 拠点フィルタ
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('拠点', 選択拠点)
        .order('created_at', { ascending: false })
        .limit(50)

      // フィルタ: recipientRole が自分の役職 or recipientEmail が自分のメール or 両方null(全員向け)
      const filtered = (data ?? []).filter((n: Notification) => {
        if (n.recipient_email && n.recipient_email === employee.メールアドレス) return true
        if (n.recipient_role && n.recipient_role === employee.役職) return true
        if (!n.recipient_email && !n.recipient_role) return true
        return false
      })

      setNotifications(filtered)
      setLoading(false)
    }

    fetchNotifications()
  }, [employee, 選択拠点])

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    )
  }

  const markAllAsRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ read: true }).in('id', unreadIds)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  const handleTap = (n: Notification) => {
    markAsRead(n.id)
    if (n.related_id) {
      navigate(`/transactions/${n.related_id}`)
    }
  }

  const formatTime = (iso: string) => {
    const d = new Date(iso)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60000)
    if (diffMin < 1) return 'たった今'
    if (diffMin < 60) return `${diffMin}分前`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}時間前`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay}日前`
    return d.toLocaleDateString('ja-JP')
  }

  const typeColor: Record<string, string> = {
    '高額入出金': 'bg-red-100 text-red-700',
    '通常入出金': 'bg-blue-100 text-blue-700',
    '修正依頼': 'bg-yellow-100 text-yellow-700',
    '修正完了': 'bg-green-100 text-green-700',
    '不足過剰アラート': 'bg-purple-100 text-purple-700',
    '残高不一致': 'bg-orange-100 text-orange-700',
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold">通知</h2>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="flex items-center gap-1 text-sm text-primary"
          >
            <CheckCheck className="w-4 h-4" />
            すべて既読
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-center text-muted py-8">読み込み中...</p>
      ) : notifications.length === 0 ? (
        <p className="text-center text-muted py-8">通知はありません</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <button
              key={n.id}
              onClick={() => handleTap(n)}
              className={`w-full text-left bg-card rounded-xl p-3 shadow-sm border-l-4 transition-colors ${
                n.read ? 'border-l-gray-200 opacity-70' : 'border-l-primary'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        typeColor[n.type] ?? 'bg-gray-100 text-gray-700'
                      }`}
                    >
                      {n.type}
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm font-medium truncate">{n.title}</p>
                  {n.body && (
                    <p className="text-xs text-muted mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 flex-shrink-0">
                  <span className="text-xs text-muted">{formatTime(n.created_at)}</span>
                  {!n.read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        markAsRead(n.id)
                      }}
                      className="text-xs text-primary"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
