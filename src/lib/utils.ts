import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format } from 'date-fns'
import { ja } from 'date-fns/locale'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// 日付を YYYYMM 形式の数値に変換
export function toYearMonth(date: Date | string): number {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.getFullYear() * 100 + (d.getMonth() + 1)
}

// 金額を日本円表示にフォーマット
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ja-JP', {
    style: 'currency',
    currency: 'JPY',
  }).format(amount)
}

// 日付をフォーマット
export function formatDate(date: string | Date, fmt: string = 'yyyy/MM/dd'): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, fmt, { locale: ja })
}

// UUID生成
export function generateId(): string {
  return crypto.randomUUID()
}
