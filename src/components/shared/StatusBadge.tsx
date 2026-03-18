import { cn } from '@/lib/utils'
import { APPROVAL_STATUS_LABELS } from '@/lib/constants'
import type { ApprovalStatus } from '@/types/database'

const statusStyles: Record<ApprovalStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  pending: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  corrected: 'bg-blue-100 text-blue-800',
}

interface StatusBadgeProps {
  status: ApprovalStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', statusStyles[status], className)}>
      {APPROVAL_STATUS_LABELS[status]}
    </span>
  )
}
