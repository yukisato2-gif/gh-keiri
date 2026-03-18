import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

interface CalendarProps {
  transactionDates: Set<string>
  selectedDate: string | null
  onDateSelect: (date: string) => void
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

export function Calendar({ transactionDates, selectedDate, onDateSelect }: CalendarProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstDayOfWeek = new Date(year, month, 1).getDay()

  const monthLabel = `${year}年${month + 1}月`

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1)
      setMonth(11)
    } else {
      setMonth((m) => m - 1)
    }
  }

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1)
      setMonth(0)
    } else {
      setMonth((m) => m + 1)
    }
  }

  const days = useMemo(() => {
    const result: (number | null)[] = []
    for (let i = 0; i < firstDayOfWeek; i++) {
      result.push(null)
    }
    for (let d = 1; d <= daysInMonth; d++) {
      result.push(d)
    }
    return result
  }, [daysInMonth, firstDayOfWeek])

  const getDateStr = (day: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={prevMonth} className="rounded-md p-1.5 hover:bg-muted">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-medium">{monthLabel}</span>
        <button type="button" onClick={nextMonth} className="rounded-md p-1.5 hover:bg-muted">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="mb-1 grid grid-cols-7">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            className={`py-1 text-center text-xs font-medium ${
              i === 0 ? 'text-expense' : i === 6 ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Date Grid */}
      <div className="grid grid-cols-7">
        {days.map((day, i) => {
          if (day === null) {
            return <div key={`empty-${i}`} />
          }
          const dateStr = getDateStr(day)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDate
          const hasTransactions = transactionDates.has(dateStr)
          const dayOfWeek = new Date(year, month, day).getDay()

          return (
            <button
              key={day}
              type="button"
              onClick={() => onDateSelect(dateStr)}
              className={`relative flex flex-col items-center justify-center rounded-md py-1.5 text-xs transition-colors ${
                isSelected
                  ? 'bg-primary font-bold text-primary-foreground'
                  : isToday
                    ? 'bg-primary/10 font-bold'
                    : 'hover:bg-muted'
              } ${!isSelected && dayOfWeek === 0 ? 'text-expense' : ''} ${
                !isSelected && dayOfWeek === 6 ? 'text-primary' : ''
              }`}
            >
              {day}
              {hasTransactions && (
                <span
                  className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                    isSelected ? 'bg-primary-foreground' : 'bg-primary'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
