import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/formatters'

interface CurrencyDisplayProps {
  amount: number
  type?: 'income' | 'expense' | 'neutral'
  className?: string
  showSign?: boolean
}

export function CurrencyDisplay({ amount, type = 'neutral', className, showSign = false }: CurrencyDisplayProps) {
  const colorClass = type === 'income' ? 'text-income' : type === 'expense' ? 'text-expense' : ''
  const sign = showSign && type === 'income' ? '+' : showSign && type === 'expense' ? '-' : ''

  return (
    <span className={cn('tabular-nums font-medium', colorClass, className)}>
      {sign}{formatCurrency(amount)}
    </span>
  )
}
