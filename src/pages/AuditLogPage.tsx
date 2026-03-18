import { useNavigate } from 'react-router-dom'
import { useCurrentEmployee, useAuditLogs } from '@/hooks/useAppData'
import { LoadingSpinner } from '@/components/shared/LoadingSpinner'
import { APPROVAL_STATUS_LABELS } from '@/lib/constants'
import { ShieldAlert, FileText, Plus, Pencil, Trash2 } from 'lucide-react'
import type { AuditLog } from '@/types/database'

const ACTION_CONFIG: Record<string, { icon: typeof Plus; label: string; color: string }> = {
  INSERT: { icon: Plus, label: '作成', color: 'text-income' },
  UPDATE: { icon: Pencil, label: '更新', color: 'text-primary' },
  DELETE: { icon: Trash2, label: '削除', color: 'text-expense' },
}

function formatDateTime(dateStr: string) {
  return new Date(dateStr).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function describeChange(log: AuditLog): string {
  if (log.action === 'INSERT') {
    const desc = log.new_data?.description ?? ''
    const amount = log.new_data?.amount
    return `${desc}${amount ? ` ¥${Number(amount).toLocaleString()}` : ''}`
  }

  if (log.action === 'DELETE') {
    const desc = log.old_data?.description ?? ''
    return `${desc} を削除`
  }

  // UPDATE: show what changed
  const changes: string[] = []
  const oldD = log.old_data ?? {}
  const newD = log.new_data ?? {}

  if (oldD.approval_status !== newD.approval_status) {
    const from = APPROVAL_STATUS_LABELS[oldD.approval_status as string] ?? oldD.approval_status
    const to = APPROVAL_STATUS_LABELS[newD.approval_status as string] ?? newD.approval_status
    changes.push(`${from} → ${to}`)
  }
  if (oldD.amount !== newD.amount) {
    changes.push(`金額: ¥${Number(oldD.amount).toLocaleString()} → ¥${Number(newD.amount).toLocaleString()}`)
  }
  if (oldD.description !== newD.description) {
    changes.push(`摘要変更`)
  }

  return changes.length > 0 ? changes.join('、') : '内容を更新'
}

export function AuditLogPage() {
  const navigate = useNavigate()
  const currentEmployee = useCurrentEmployee()
  const { logs, isLoading } = useAuditLogs()

  const canView = currentEmployee?.role === 'hq_admin' || currentEmployee?.role === 'section_chief' || currentEmployee?.role === 'supervisor'

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <ShieldAlert className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">監査ログの閲覧権限がありません</p>
        <button onClick={() => navigate(-1)} className="text-sm text-primary hover:underline">戻る</button>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold">監査ログ</h2>

      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h3 className="font-medium">変更履歴（{logs.length}件）</h3>
        </div>

        {logs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            監査ログはありません
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const config = ACTION_CONFIG[log.action] ?? ACTION_CONFIG.UPDATE
              const ActionIcon = config.icon
              return (
                <div key={log.id} className="flex items-start gap-3 px-4 py-3">
                  <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted`}>
                    <ActionIcon className={`h-4 w-4 ${config.color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${config.color} bg-muted`}>
                        {config.label}
                      </span>
                      <span className="text-xs text-muted-foreground">{formatDateTime(log.created_at)}</span>
                    </div>
                    <p className="mt-0.5 text-sm">{describeChange(log)}</p>
                    {log.changer && (
                      <p className="text-xs text-muted-foreground">by {log.changer.name}</p>
                    )}
                  </div>
                  {log.record_id && (
                    <button
                      onClick={() => navigate(`/transactions/${log.record_id}`)}
                      className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:bg-muted"
                      title="取引詳細"
                    >
                      <FileText className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
