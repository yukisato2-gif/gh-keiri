// @ts-nocheck
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/stores/authStore'
import { useLocationStore } from '@/stores/locationStore'
import { useDemoStore } from '@/stores/demoStore'
import type { Transaction, Category, CashCheck, Location, ApprovalStatus, Notification, AuditLog, Employee, Resident, EmployeeLocationAuthority, MonthlyClose, Billing, BillingItem, Payment, Settlement, ResidentBalance } from '@/types/database'
import { parseYearMonth, formatYearMonth } from '@/stores/demoStore'

const isSupabaseMode = () => {
  const session = useAuthStore.getState().session
  return !!supabase && !!session
}

// --- DB互換ヘルパー ---
// 既存DBの billing_month は TEXT型。アプリは number で扱う。
// 読み取り時: string→number、書き込み時: number→string に変換

/** Supabase から読み取った transaction の billing_month (TEXT) を number に変換 */
function normalizeTransaction(tx: Record<string, unknown>): Transaction {
  return {
    ...tx,
    billing_month: tx.billing_month != null ? Number(tx.billing_month) : null,
    billing_year: tx.billing_year != null ? Number(tx.billing_year) : null,
  } as Transaction
}

/** Supabase 書き込み用: billing_month number → TEXT, billing_year はそのまま */
function toSupabaseTxFields(fields: Record<string, unknown>): Record<string, unknown> {
  const result = { ...fields }
  if ('billing_month' in result && result.billing_month != null) {
    result.billing_month = String(result.billing_month)
  }
  return result
}

/** Billing に year_month TEXT を追加して Supabase 書き込み用に変換 */
function toSupabaseBilling(b: Record<string, unknown>): Record<string, unknown> {
  const result = { ...b }
  if (result.billing_year != null && result.billing_month != null) {
    result.year_month = `${result.billing_year}-${String(result.billing_month).padStart(2, '0')}`
  }
  // balance を計算して含める
  const total = (result.total_amount as number) ?? 0
  const carried = (result.carried_over_amount as number) ?? 0
  const paid = (result.paid_amount as number) ?? 0
  result.balance = total + carried - paid
  return result
}

/** MonthlyClose に year_month TEXT を追加 */
function toSupabaseMonthlyClose(mc: Record<string, unknown>): Record<string, unknown> {
  const result = { ...mc }
  if (result.close_year != null && result.close_month != null) {
    result.year_month = `${result.close_year}-${String(result.close_month).padStart(2, '0')}`
  }
  return result
}

/** Settlement に year_month TEXT を追加 */
function toSupabaseSettlement(s: Record<string, unknown>): Record<string, unknown> {
  const result = { ...s }
  if (result.settlement_year != null && result.settlement_month != null) {
    result.year_month = `${result.settlement_year}-${String(result.settlement_month).padStart(2, '0')}`
  }
  return result
}

export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const demoCategories = useDemoStore((s) => s.categories)

  useEffect(() => {
    if (!isSupabaseMode()) {
      setCategories(demoCategories)
      return
    }
    supabase!
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
      .then(({ data }) => {
        if (data) setCategories(data as Category[])
      })
  }, [demoCategories])

  return categories
}

export function useTransactions(locationId: string | undefined) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoTransactions = useDemoStore((s) => s.transactions)

  const fetchTransactions = useCallback(async () => {
    if (!locationId) {
      setTransactions([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      setTransactions(demoTransactions.filter((tx) => tx.location_id === locationId))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('transactions')
      .select('*')
      .eq('location_id', locationId)
      .order('transaction_date', { ascending: false })
      .limit(200)

    setTransactions(((data as Record<string, unknown>[]) ?? []).map(normalizeTransaction))
    setIsLoading(false)
  }, [locationId, demoTransactions])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  return { transactions, isLoading, refetch: fetchTransactions }
}

export function useCashChecks(locationId: string | undefined) {
  const [cashChecks, setCashChecks] = useState<CashCheck[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoCashChecks = useDemoStore((s) => s.cashChecks)

  const fetchCashChecks = useCallback(async () => {
    if (!locationId) {
      setCashChecks([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      setCashChecks(demoCashChecks.filter((c) => c.location_id === locationId))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('cash_checks')
      .select('*')
      .eq('location_id', locationId)
      .order('check_date', { ascending: false })
      .limit(50)

    setCashChecks((data as CashCheck[]) ?? [])
    setIsLoading(false)
  }, [locationId, demoCashChecks])

  useEffect(() => {
    fetchCashChecks()
  }, [fetchCashChecks])

  return { cashChecks, isLoading, refetch: fetchCashChecks }
}

export function useAddTransaction() {
  const demoAdd = useDemoStore((s) => s.addTransaction)

  return async (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseMode()) {
      demoAdd(tx)
      return { error: null }
    }

    const { error } = await supabase!
      .from('transactions')
      .insert(toSupabaseTxFields(tx as unknown as Record<string, unknown>))

    return { error }
  }
}

export function useEditTransaction() {
  const demoUpdate = useDemoStore((s) => s.updateTransaction)

  return async (id: string, updates: Partial<Omit<Transaction, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!isSupabaseMode()) {
      demoUpdate(id, updates)
      return { error: null }
    }

    const { error } = await supabase!
      .from('transactions')
      .update(toSupabaseTxFields(updates as unknown as Record<string, unknown>))
      .eq('id', id)

    return { error }
  }
}

export function useDeleteTransaction() {
  const demoDelete = useDemoStore((s) => s.deleteTransaction)

  return async (id: string) => {
    if (!isSupabaseMode()) {
      demoDelete(id)
      return { error: null }
    }

    const { error } = await supabase!
      .from('transactions')
      .delete()
      .eq('id', id)

    return { error }
  }
}

export function useAddCashCheck() {
  const demoAdd = useDemoStore((s) => s.addCashCheck)

  return async (check: Record<string, unknown>) => {
    if (!isSupabaseMode()) {
      demoAdd(check as Parameters<typeof demoAdd>[0])
      return { error: null }
    }

    const { error } = await supabase!
      .from('cash_checks')
      .insert(check)

    return { error }
  }
}

export function useCurrentLocation(): { locationId: string; locations: Location[] } {
  const { selectedLocation } = useLocationStore()
  const { authorizedLocations } = useLocationStore()
  const demoLocations = useDemoStore((s) => s.locations)

  const locations = authorizedLocations.length > 0 ? authorizedLocations : demoLocations
  const locationId = selectedLocation?.id ?? locations[0]?.id ?? ''

  return { locationId, locations }
}

export function useCurrentEmployee() {
  const { employee } = useAuthStore()
  const demoEmployee = useDemoStore((s) => s.employee)
  return employee ?? demoEmployee
}

export function useTransaction(id: string | undefined) {
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const demoTransactions = useDemoStore((s) => s.transactions)
  const categories = useCategories()

  const fetchTransaction = useCallback(async () => {
    if (!id) {
      setTransaction(null)
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      const tx = demoTransactions.find((t) => t.id === id) ?? null
      if (tx) {
        const category = categories.find((c) => c.id === tx.category_id)
        setTransaction({ ...tx, category })
      } else {
        setTransaction(null)
      }
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('transactions')
      .select('*, category:categories(*), recorder:employees!recorded_by(*)')
      .eq('id', id)
      .single()

    setTransaction(data ? normalizeTransaction(data as Record<string, unknown>) : null)
    setIsLoading(false)
  }, [id, demoTransactions, categories])

  useEffect(() => {
    fetchTransaction()
  }, [fetchTransaction])

  return { transaction, isLoading, refetch: fetchTransaction }
}

export function useUpdateTransactionStatus() {
  const demoUpdate = useDemoStore((s) => s.updateTransaction)
  const currentEmployee = useCurrentEmployee()

  return async (
    id: string,
    action: 'submit' | 'approve' | 'reject' | 'revert_to_draft',
    rejectionReason?: string
  ) => {
    const updates: Partial<Transaction> = {}

    switch (action) {
      case 'submit':
        updates.approval_status = 'pending' as ApprovalStatus
        updates.rejection_reason = null
        break
      case 'approve':
        updates.approval_status = 'approved' as ApprovalStatus
        updates.approved_by = currentEmployee.id
        updates.approved_at = new Date().toISOString()
        updates.rejection_reason = null
        break
      case 'reject':
        updates.approval_status = 'rejected' as ApprovalStatus
        updates.rejection_reason = rejectionReason ?? null
        break
      case 'revert_to_draft':
        updates.approval_status = 'draft' as ApprovalStatus
        updates.rejection_reason = null
        break
    }

    if (!isSupabaseMode()) {
      demoUpdate(id, updates)
      return { error: null }
    }

    const { error } = await supabase!
      .from('transactions')
      .update(updates)
      .eq('id', id)

    return { error }
  }
}

export function useCanApprove(locationId: string | undefined) {
  const currentEmployee = useCurrentEmployee()
  const [canApprove, setCanApprove] = useState(false)

  useEffect(() => {
    if (!locationId || !currentEmployee) {
      setCanApprove(false)
      return
    }

    const role = currentEmployee.role
    if (role === 'hq_admin' || role === 'section_chief') {
      setCanApprove(true)
      return
    }

    if (role === 'supervisor') {
      if (!isSupabaseMode()) {
        setCanApprove(true)
        return
      }
      supabase!
        .from('employee_location_authority')
        .select('can_approve')
        .eq('employee_id', currentEmployee.id)
        .eq('location_id', locationId)
        .eq('can_approve', true)
        .then(({ data }) => {
          setCanApprove((data?.length ?? 0) > 0)
        })
      return
    }

    setCanApprove(false)
  }, [locationId, currentEmployee])

  return canApprove
}

export function usePendingCount(locationId: string | undefined) {
  const [count, setCount] = useState(0)
  const demoTransactions = useDemoStore((s) => s.transactions)

  useEffect(() => {
    if (!locationId) {
      setCount(0)
      return
    }

    if (!isSupabaseMode()) {
      setCount(demoTransactions.filter((tx) => tx.location_id === locationId && tx.approval_status === 'pending').length)
      return
    }

    supabase!
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('location_id', locationId)
      .eq('approval_status', 'pending')
      .then(({ count: c }) => {
        setCount(c ?? 0)
      })
  }, [locationId, demoTransactions])

  return count
}

export function useNotifications() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoNotifications = useDemoStore((s) => s.notifications)

  const fetchNotifications = useCallback(async () => {
    if (!isSupabaseMode()) {
      setNotifications(demoNotifications)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)

    setNotifications((data as Notification[]) ?? [])
    setIsLoading(false)
  }, [demoNotifications])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!isSupabaseMode()) return

    const channel = supabase!
      .channel('notifications-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications' },
        (payload) => {
          const newNotif = payload.new as Notification
          setNotifications((prev) => [newNotif, ...prev])
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications' },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
        }
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [])

  return { notifications, isLoading, refetch: fetchNotifications }
}

export function useUnreadNotificationCount() {
  const [count, setCount] = useState(0)
  const demoNotifications = useDemoStore((s) => s.notifications)

  const fetchCount = useCallback(async () => {
    if (!isSupabaseMode()) {
      setCount(demoNotifications.filter((n) => !n.is_read).length)
      return
    }

    const { count: c } = await supabase!
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)

    setCount(c ?? 0)
  }, [demoNotifications])

  useEffect(() => {
    fetchCount()
  }, [fetchCount])

  // Realtime subscription for count updates
  useEffect(() => {
    if (!isSupabaseMode()) return

    const channel = supabase!
      .channel('notification-count-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        () => {
          // Refetch count on any notification change
          fetchCount()
        }
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
    }
  }, [fetchCount])

  return count
}

export function useMarkNotificationRead() {
  const demoMark = useDemoStore((s) => s.markNotificationRead)

  return async (id: string) => {
    if (!isSupabaseMode()) {
      demoMark(id)
      return { error: null }
    }

    const { error } = await supabase!
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id)

    return { error }
  }
}

export function useMarkAllNotificationsRead() {
  const demoMarkAll = useDemoStore((s) => s.markAllNotificationsRead)

  return async () => {
    if (!isSupabaseMode()) {
      demoMarkAll()
      return { error: null }
    }

    const { error } = await supabase!
      .from('notifications')
      .update({ is_read: true })
      .eq('is_read', false)

    return { error }
  }
}

export function useAuditLogs(recordId?: string) {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoLogs = useDemoStore((s) => s.auditLogs)

  const fetchLogs = useCallback(async () => {
    if (!isSupabaseMode()) {
      const filtered = recordId
        ? demoLogs.filter((l) => l.record_id === recordId)
        : demoLogs
      setLogs(filtered)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    let query = supabase!
      .from('audit_logs')
      .select('*, changer:employees!changed_by(*)')
      .order('created_at', { ascending: false })
      .limit(100)

    if (recordId) {
      query = query.eq('record_id', recordId)
    }

    const { data } = await query
    setLogs((data as AuditLog[]) ?? [])
    setIsLoading(false)
  }, [recordId, demoLogs])

  useEffect(() => {
    fetchLogs()
  }, [fetchLogs])

  return { logs, isLoading, refetch: fetchLogs }
}

export function useResidents(locationId: string | undefined) {
  const [residents, setResidents] = useState<Resident[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoResidents = useDemoStore((s) => s.residents)

  const fetchResidents = useCallback(async () => {
    if (!locationId) {
      setResidents([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      setResidents(demoResidents.filter((r) => r.location_id === locationId))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('residents')
      .select('*')
      .eq('location_id', locationId)
      .order('name')

    setResidents((data as Resident[]) ?? [])
    setIsLoading(false)
  }, [locationId, demoResidents])

  useEffect(() => {
    fetchResidents()
  }, [fetchResidents])

  return { residents, isLoading, refetch: fetchResidents }
}

export function useAddResident() {
  const demoAdd = useDemoStore((s) => s.addResident)

  return async (resident: Omit<Resident, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseMode()) {
      demoAdd(resident)
      return { error: null }
    }

    const { error } = await supabase!
      .from('residents')
      .insert(resident)

    return { error }
  }
}

export function useEditResident() {
  const demoUpdate = useDemoStore((s) => s.updateResident)

  return async (id: string, updates: Partial<Omit<Resident, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!isSupabaseMode()) {
      demoUpdate(id, updates)
      return { error: null }
    }

    const { error } = await supabase!
      .from('residents')
      .update(updates)
      .eq('id', id)

    return { error }
  }
}

export function useEmployees() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoEmployees = useDemoStore((s) => s.employees)

  const fetchEmployees = useCallback(async () => {
    if (!isSupabaseMode()) {
      setEmployees(demoEmployees)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('employees')
      .select('*, primary_location:locations!primary_location_id(*)')
      .order('employee_code')

    setEmployees((data as Employee[]) ?? [])
    setIsLoading(false)
  }, [demoEmployees])

  useEffect(() => {
    fetchEmployees()
  }, [fetchEmployees])

  return { employees, isLoading, refetch: fetchEmployees }
}

export function useEditEmployee() {
  const demoUpdate = useDemoStore((s) => s.updateEmployee)

  return async (id: string, updates: Partial<Omit<Employee, 'id' | 'created_at' | 'updated_at'>>) => {
    if (!isSupabaseMode()) {
      demoUpdate(id, updates)
      return { error: null }
    }

    const { error } = await supabase!
      .from('employees')
      .update(updates)
      .eq('id', id)

    return { error }
  }
}

export function useLocationAuthorities(employeeId: string | undefined) {
  const [authorities, setAuthorities] = useState<EmployeeLocationAuthority[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoAuthorities = useDemoStore((s) => s.authorities)

  const fetchAuthorities = useCallback(async () => {
    if (!employeeId) {
      setAuthorities([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      setAuthorities(demoAuthorities.filter((a) => a.employee_id === employeeId))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('employee_location_authority')
      .select('*')
      .eq('employee_id', employeeId)

    setAuthorities((data as EmployeeLocationAuthority[]) ?? [])
    setIsLoading(false)
  }, [employeeId, demoAuthorities])

  useEffect(() => {
    fetchAuthorities()
  }, [fetchAuthorities])

  return { authorities, isLoading, refetch: fetchAuthorities }
}

// --- Monthly Close hooks ---
export function useMonthlyCloses(locationId: string | undefined) {
  const [monthlyCloses, setMonthlyCloses] = useState<MonthlyClose[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoCloses = useDemoStore((s) => s.monthlyCloses)

  const fetchCloses = useCallback(async () => {
    if (!locationId) {
      setMonthlyCloses([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      setMonthlyCloses(demoCloses.filter((m) => m.location_id === locationId))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('monthly_closes')
      .select('*, closer:employees!closed_by(*)')
      .eq('location_id', locationId)
      .order('close_year', { ascending: false })
      .order('close_month', { ascending: false })
      .limit(24)

    setMonthlyCloses((data as MonthlyClose[]) ?? [])
    setIsLoading(false)
  }, [locationId, demoCloses])

  useEffect(() => {
    fetchCloses()
  }, [fetchCloses])

  return { monthlyCloses, isLoading, refetch: fetchCloses }
}

/** yearMonth: "YYYY-MM" 形式の文字列を受け取り、close_year/close_month で検索 */
export function useMonthlyClose(locationId: string | undefined, yearMonth: string | undefined) {
  const [monthlyClose, setMonthlyClose] = useState<MonthlyClose | null>(null)
  const demoCloses = useDemoStore((s) => s.monthlyCloses)

  useEffect(() => {
    if (!locationId || !yearMonth) {
      setMonthlyClose(null)
      return
    }

    const { year, month } = parseYearMonth(yearMonth)

    if (!isSupabaseMode()) {
      setMonthlyClose(demoCloses.find((m) => m.location_id === locationId && m.close_year === year && m.close_month === month) ?? null)
      return
    }

    supabase!
      .from('monthly_closes')
      .select('*')
      .eq('location_id', locationId)
      .eq('close_year', year)
      .eq('close_month', month)
      .maybeSingle()
      .then(({ data }) => {
        setMonthlyClose((data as MonthlyClose) ?? null)
      })
  }, [locationId, yearMonth, demoCloses])

  return monthlyClose
}

export function useUpsertMonthlyClose() {
  const demoUpsert = useDemoStore((s) => s.upsertMonthlyClose)

  return async (mc: Omit<MonthlyClose, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseMode()) {
      demoUpsert(mc)
      return { error: null }
    }

    const { error } = await supabase!
      .from('monthly_closes')
      .upsert(toSupabaseMonthlyClose(mc as unknown as Record<string, unknown>), { onConflict: 'location_id,close_year,close_month' })

    return { error }
  }
}

// --- Billing hooks ---
/** yearMonth: "YYYY-MM" 形式 → billing_year/billing_month で検索 */
export function useBillings(locationId: string | undefined, yearMonth?: string) {
  const [billings, setBillings] = useState<Billing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoBillings = useDemoStore((s) => s.billings)
  const demoResidents = useDemoStore((s) => s.residents)

  const fetchBillings = useCallback(async () => {
    if (!locationId) {
      setBillings([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      let filtered = demoBillings.filter((b) => b.location_id === locationId)
      if (yearMonth) {
        const { year, month } = parseYearMonth(yearMonth)
        filtered = filtered.filter((b) => b.billing_year === year && b.billing_month === month)
      }
      // Attach resident
      filtered = filtered.map((b) => ({ ...b, resident: demoResidents.find((r) => r.id === b.resident_id) }))
      setBillings(filtered)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    let query = supabase!
      .from('billings')
      .select('*, resident:residents(*)')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })

    if (yearMonth) {
      const { year, month } = parseYearMonth(yearMonth)
      query = query.eq('billing_year', year).eq('billing_month', month)
    }

    const { data } = await query
    setBillings((data as Billing[]) ?? [])
    setIsLoading(false)
  }, [locationId, yearMonth, demoBillings, demoResidents])

  useEffect(() => {
    fetchBillings()
  }, [fetchBillings])

  return { billings, isLoading, refetch: fetchBillings }
}

export function useBilling(id: string | undefined) {
  const [billing, setBilling] = useState<Billing | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const demoBillings = useDemoStore((s) => s.billings)
  const demoBillingItems = useDemoStore((s) => s.billingItems)
  const demoTransactions = useDemoStore((s) => s.transactions)

  const fetchBilling = useCallback(async () => {
    if (!id) {
      setBilling(null)
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      const b = demoBillings.find((b) => b.id === id)
      if (b) {
        const items = demoBillingItems
          .filter((bi) => bi.billing_id === id)
          .map((bi) => ({ ...bi, transaction: demoTransactions.find((t) => t.id === bi.transaction_id) }))
        setBilling({ ...b, items })
      } else {
        setBilling(null)
      }
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('billings')
      .select('*, resident:residents(*), items:billing_items(*, transaction:transactions(*))')
      .eq('id', id)
      .single()

    setBilling((data as Billing) ?? null)
    setIsLoading(false)
  }, [id, demoBillings, demoBillingItems, demoTransactions])

  useEffect(() => {
    fetchBilling()
  }, [fetchBilling])

  return { billing, isLoading, refetch: fetchBilling }
}

export function useAddBilling() {
  const demoAdd = useDemoStore((s) => s.addBilling)

  return async (billing: Omit<Billing, 'id' | 'created_at' | 'updated_at' | 'balance'>, items: { transaction_id: string; amount: number }[]) => {
    if (!isSupabaseMode()) {
      demoAdd(billing, items)
      return { error: null }
    }

    // Insert billing (with year_month TEXT and calculated balance)
    const { data: billingData, error: billingError } = await supabase!
      .from('billings')
      .insert(toSupabaseBilling(billing as unknown as Record<string, unknown>))
      .select()
      .single()

    if (billingError || !billingData) return { error: billingError }

    const billingId = (billingData as Billing).id

    // Insert billing items
    const billingItems = items.map((item) => ({
      billing_id: billingId,
      transaction_id: item.transaction_id,
      amount: item.amount,
    }))

    const { error: itemsError } = await supabase!
      .from('billing_items')
      .insert(billingItems)

    if (itemsError) return { error: itemsError }

    // Update transactions billing_status
    const txIds = items.map((i) => i.transaction_id)
    for (const txId of txIds) {
      await supabase!
        .from('transactions')
        .update({ billing_status: 'billed', billing_id: billingId, billing_year: billing.billing_year, billing_month: String(billing.billing_month) })
        .eq('id', txId)
    }

    return { error: null }
  }
}

export function useUpdateBilling() {
  const demoUpdate = useDemoStore((s) => s.updateBilling)

  return async (id: string, updates: Partial<Billing>) => {
    if (!isSupabaseMode()) {
      demoUpdate(id, updates)
      return { error: null }
    }

    // balance を再計算して含める
    const updatesWithBalance = { ...updates } as Record<string, unknown>
    if ('total_amount' in updatesWithBalance || 'carried_over_amount' in updatesWithBalance || 'paid_amount' in updatesWithBalance) {
      const total = (updatesWithBalance.total_amount as number) ?? 0
      const carried = (updatesWithBalance.carried_over_amount as number) ?? 0
      const paid = (updatesWithBalance.paid_amount as number) ?? 0
      updatesWithBalance.balance = total + carried - paid
    }
    const { error } = await supabase!
      .from('billings')
      .update(updatesWithBalance)
      .eq('id', id)

    return { error }
  }
}

// --- Advance payments (unbilled cash_advance transactions) ---
export function useAdvancePayments(locationId: string | undefined, yearMonth?: string) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoTransactions = useDemoStore((s) => s.transactions)

  const fetchTransactions = useCallback(async () => {
    if (!locationId) {
      setTransactions([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      let filtered = demoTransactions.filter(
        (tx) => tx.location_id === locationId && tx.transaction_type === 'cash_advance' && tx.approval_status === 'approved'
      )
      if (yearMonth) {
        filtered = filtered.filter((tx) => tx.transaction_date.startsWith(yearMonth))
      }
      setTransactions(filtered)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    let query = supabase!
      .from('transactions')
      .select('*, category:categories(*), resident:residents(*)')
      .eq('location_id', locationId)
      .eq('transaction_type', 'cash_advance')
      .eq('approval_status', 'approved')
      .order('transaction_date', { ascending: false })

    if (yearMonth) {
      query = query.gte('transaction_date', `${yearMonth}-01`).lt('transaction_date', `${yearMonth}-32`)
    }

    const { data } = await query
    setTransactions(((data as Record<string, unknown>[]) ?? []).map(normalizeTransaction))
    setIsLoading(false)
  }, [locationId, yearMonth, demoTransactions])

  useEffect(() => {
    fetchTransactions()
  }, [fetchTransactions])

  return { transactions, isLoading, refetch: fetchTransactions }
}

export function useEditLocation() {
  const demoUpdate = useDemoStore((s) => s.updateLocation)

  return async (id: string, updates: Partial<Location>) => {
    if (!isSupabaseMode()) {
      demoUpdate(id, updates)
      return { error: null }
    }

    const { error } = await supabase!
      .from('locations')
      .update(updates)
      .eq('id', id)

    return { error }
  }
}

export function useUpdateLocationAuthority() {
  const demoUpsert = useDemoStore((s) => s.upsertAuthority)
  const demoDelete = useDemoStore((s) => s.deleteAuthority)

  const upsert = async (auth: Omit<EmployeeLocationAuthority, 'id' | 'created_at'>) => {
    if (!isSupabaseMode()) {
      demoUpsert(auth)
      return { error: null }
    }

    const { error } = await supabase!
      .from('employee_location_authority')
      .upsert(auth, { onConflict: 'employee_id,location_id' })

    return { error }
  }

  const remove = async (id: string) => {
    if (!isSupabaseMode()) {
      demoDelete(id)
      return { error: null }
    }

    const { error } = await supabase!
      .from('employee_location_authority')
      .delete()
      .eq('id', id)

    return { error }
  }

  return { upsert, remove }
}

// --- Payment hooks ---
export function usePayments(billingId: string | undefined) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoPayments = useDemoStore((s) => s.payments)

  const fetchPayments = useCallback(async () => {
    if (!billingId) {
      setPayments([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      setPayments(demoPayments.filter((p) => p.billing_id === billingId))
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('payments')
      .select('*, recorder:employees!recorded_by(*)')
      .eq('billing_id', billingId)
      .order('payment_date', { ascending: false })

    setPayments((data as Payment[]) ?? [])
    setIsLoading(false)
  }, [billingId, demoPayments])

  useEffect(() => {
    fetchPayments()
  }, [fetchPayments])

  return { payments, isLoading, refetch: fetchPayments }
}

export function useAddPayment() {
  const demoAdd = useDemoStore((s) => s.addPayment)

  return async (payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseMode()) {
      demoAdd(payment)
      return { error: null }
    }

    // Insert payment
    const { error: paymentError } = await supabase!
      .from('payments')
      .insert(payment)

    if (paymentError) return { error: paymentError }

    // Update billing paid_amount and status
    const { data: billingData } = await supabase!
      .from('billings')
      .select('total_amount, paid_amount')
      .eq('id', payment.billing_id)
      .single()

    if (billingData) {
      const bd = billingData as { total_amount: number; paid_amount: number; carried_over_amount?: number }
      const delta = payment.payment_kind === 'refund' ? -payment.amount : payment.amount
      const newPaidAmount = bd.paid_amount + delta
      const carriedOver = bd.carried_over_amount ?? 0
      const newBalance = bd.total_amount + carriedOver - newPaidAmount
      const newStatus = newBalance === 0 ? 'paid' : newBalance < 0 ? 'overpaid' : (newPaidAmount > 0 ? 'partial' : undefined)

      const billingUpdates: Record<string, unknown> = { paid_amount: newPaidAmount, balance: newBalance }
      if (newStatus) billingUpdates.status = newStatus

      await supabase!
        .from('billings')
        .update(billingUpdates)
        .eq('id', payment.billing_id)

      // Update related transactions billing_status
      const txStatus = newBalance <= 0 ? 'paid' : 'partial'
      const { data: items } = await supabase!
        .from('billing_items')
        .select('transaction_id')
        .eq('billing_id', payment.billing_id)

      if (items) {
        for (const item of items) {
          await supabase!
            .from('transactions')
            .update({ billing_status: txStatus })
            .eq('id', (item as { transaction_id: string }).transaction_id)
        }
      }
    }

    return { error: null }
  }
}

// --- Carryover hooks ---
export function useCarryOverTransactions() {
  const demoTransactions = useDemoStore((s) => s.transactions)
  const demoUpdate = useDemoStore((s) => s.updateTransaction)

  return async (locationId: string, yearMonth: string) => {
    // Calculate next month
    const [y, m] = yearMonth.split('-').map(Number)
    const nextDate = new Date(y, m, 1) // m is already 1-based, so new Date(y, m, 1) = next month
    const nextMonth = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`

    if (!isSupabaseMode()) {
      // Demo mode: update matching transactions
      const targets = demoTransactions.filter(
        (tx) =>
          tx.location_id === locationId &&
          tx.transaction_date.startsWith(yearMonth) &&
          tx.income_expense === 'expense' &&
          tx.billing_status === 'unbilled'
      )
      const { year: ny, month: nm } = parseYearMonth(nextMonth)
      for (const tx of targets) {
        demoUpdate(tx.id, { billing_status: 'carried_over', billing_year: ny, billing_month: nm })
      }
      return { count: targets.length, error: null }
    }

    // Supabase mode: batch update unbilled expense transactions for this location+month
    const { year: ny, month: nm } = parseYearMonth(nextMonth)
    const { data, error } = await supabase!
      .from('transactions')
      .update({ billing_status: 'carried_over', billing_year: ny, billing_month: String(nm) })
      .eq('location_id', locationId)
      .gte('transaction_date', `${yearMonth}-01`)
      .lte('transaction_date', `${yearMonth}-31`)
      .eq('income_expense', 'expense')
      .eq('billing_status', 'unbilled')
      .select('id')

    return { count: data?.length ?? 0, error }
  }
}

// --- Settlement hooks ---
export function useSettlements(yearMonth?: string) {
  const [settlements, setSettlements] = useState<Settlement[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoSettlements = useDemoStore((s) => s.settlements)

  const fetchSettlements = useCallback(async () => {
    if (!isSupabaseMode()) {
      let filtered = demoSettlements
      if (yearMonth) {
        const { year, month } = parseYearMonth(yearMonth)
        filtered = filtered.filter((s) => s.settlement_year === year && s.settlement_month === month)
      }
      setSettlements(filtered)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    let query = supabase!
      .from('settlements')
      .select('*, location:locations(*)')
      .order('settlement_year', { ascending: false })
      .order('settlement_month', { ascending: false })

    if (yearMonth) {
      const { year, month } = parseYearMonth(yearMonth)
      query = query.eq('settlement_year', year).eq('settlement_month', month)
    }

    const { data } = await query
    setSettlements((data as Settlement[]) ?? [])
    setIsLoading(false)
  }, [yearMonth, demoSettlements])

  useEffect(() => {
    fetchSettlements()
  }, [fetchSettlements])

  return { settlements, isLoading, refetch: fetchSettlements }
}

export function useSettlement(locationId: string | undefined, yearMonth: string | undefined) {
  const [settlement, setSettlement] = useState<Settlement | null>(null)
  const demoSettlements = useDemoStore((s) => s.settlements)

  useEffect(() => {
    if (!locationId || !yearMonth) {
      setSettlement(null)
      return
    }

    const { year, month } = parseYearMonth(yearMonth)

    if (!isSupabaseMode()) {
      setSettlement(demoSettlements.find((s) => s.location_id === locationId && s.settlement_year === year && s.settlement_month === month) ?? null)
      return
    }

    supabase!
      .from('settlements')
      .select('*, location:locations(*)')
      .eq('location_id', locationId)
      .eq('settlement_year', year)
      .eq('settlement_month', month)
      .maybeSingle()
      .then(({ data }) => {
        setSettlement((data as Settlement) ?? null)
      })
  }, [locationId, yearMonth, demoSettlements])

  return settlement
}

export function useUpsertSettlement() {
  const demoUpsert = useDemoStore((s) => s.upsertSettlement)

  return async (settlement: Omit<Settlement, 'id' | 'created_at' | 'updated_at'>) => {
    if (!isSupabaseMode()) {
      demoUpsert(settlement)
      return { error: null }
    }

    const { error } = await supabase!
      .from('settlements')
      .upsert(toSupabaseSettlement(settlement as unknown as Record<string, unknown>), { onConflict: 'location_id,settlement_year,settlement_month' })

    return { error }
  }
}

export function useUpdateSettlement() {
  const demoUpdate = useDemoStore((s) => s.updateSettlement)

  return async (id: string, updates: Partial<Settlement>) => {
    if (!isSupabaseMode()) {
      demoUpdate(id, updates)
      return { error: null }
    }

    const { error } = await supabase!
      .from('settlements')
      .update(updates)
      .eq('id', id)

    return { error }
  }
}

// --- Outstanding billings (unpaid/partial) ---
export function useOutstandingBillings(locationId: string | undefined) {
  const [billings, setBillings] = useState<Billing[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const demoBillings = useDemoStore((s) => s.billings)

  const fetchBillings = useCallback(async () => {
    if (!locationId) {
      setBillings([])
      setIsLoading(false)
      return
    }

    if (!isSupabaseMode()) {
      setBillings(
        demoBillings.filter(
          (b) => b.location_id === locationId && ['issued', 'sent', 'partial', 'overdue'].includes(b.status)
        )
      )
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    const { data } = await supabase!
      .from('billings')
      .select('*, resident:residents(*)')
      .eq('location_id', locationId)
      .in('status', ['issued', 'sent', 'partial', 'overdue'])
      .order('billing_date', { ascending: true })

    setBillings((data as Billing[]) ?? [])
    setIsLoading(false)
  }, [locationId, demoBillings])

  useEffect(() => {
    fetchBillings()
  }, [fetchBillings])

  return { billings, isLoading, refetch: fetchBillings }
}

// --- 利用者残高計算 ---
export function useResidentBalances(locationId: string | undefined) {
  const [balances, setBalances] = useState<ResidentBalance[]>([])
  const demoTransactions = useDemoStore((s) => s.transactions)
  const demoBillings = useDemoStore((s) => s.billings)
  const demoResidents = useDemoStore((s) => s.residents)

  useEffect(() => {
    if (!locationId) {
      setBalances([])
      return
    }

    if (!isSupabaseMode()) {
      const residents = demoResidents.filter((r) => r.location_id === locationId && r.is_active)
      const result: ResidentBalance[] = residents.map((r) => {
        const unbilledAmount = demoTransactions
          .filter((tx) => tx.resident_id === r.id && tx.transaction_type === 'cash_advance' && tx.billing_status === 'unbilled' && tx.approval_status === 'approved')
          .reduce((sum, tx) => sum + tx.amount, 0)

        const unpaidAmount = demoBillings
          .filter((b) => b.resident_id === r.id && !['paid', 'cancelled'].includes(b.status))
          .reduce((sum, b) => sum + b.balance, 0)

        const totalBalance = unbilledAmount + unpaidAmount
        const isOverLimit = r.advance_limit != null && totalBalance > r.advance_limit

        return {
          resident_id: r.id,
          resident_name: r.name,
          advance_limit: r.advance_limit,
          unbilled_amount: unbilledAmount,
          unpaid_amount: unpaidAmount,
          total_balance: totalBalance,
          is_over_limit: isOverLimit,
        }
      })

      setBalances(result)
      return
    }

    // Supabase mode: query residents, unbilled transactions, and unpaid billings
    ;(async () => {
    const { data: residents } = await supabase!
      .from('residents')
      .select('id, name, advance_limit')
      .eq('location_id', locationId)
      .eq('is_active', true)

    if (!residents || residents.length === 0) {
      setBalances([])
      return
    }

    const residentIds = residents.map((r: { id: string }) => r.id)

    // Get unbilled approved advance transactions
    const { data: unbilledTxs } = await supabase!
      .from('transactions')
      .select('resident_id, amount')
      .in('resident_id', residentIds)
      .eq('transaction_type', 'cash_advance')
      .eq('billing_status', 'unbilled')
      .eq('approval_status', 'approved')

    // Get unpaid billings (not paid, not cancelled)
    const { data: unpaidBills } = await supabase!
      .from('billings')
      .select('resident_id, balance')
      .in('resident_id', residentIds)
      .not('status', 'in', '("paid","cancelled")')

    const result: ResidentBalance[] = residents.map((r: { id: string; name: string; advance_limit: number | null }) => {
      const unbilledAmount = (unbilledTxs ?? [])
        .filter((tx: { resident_id: string }) => tx.resident_id === r.id)
        .reduce((sum: number, tx: { amount: number }) => sum + tx.amount, 0)

      const unpaidAmount = (unpaidBills ?? [])
        .filter((b: { resident_id: string | null }) => b.resident_id === r.id)
        .reduce((sum: number, b: { balance: number }) => sum + b.balance, 0)

      const totalBalance = unbilledAmount + unpaidAmount
      const isOverLimit = r.advance_limit != null && totalBalance > r.advance_limit

      return {
        resident_id: r.id,
        resident_name: r.name,
        advance_limit: r.advance_limit,
        unbilled_amount: unbilledAmount,
        unpaid_amount: unpaidAmount,
        total_balance: totalBalance,
        is_over_limit: isOverLimit,
      }
    })

    setBalances(result)
    })()
  }, [locationId, demoTransactions, demoBillings, demoResidents])

  return balances
}

// --- 監査ログ記録 ---
export function useAddAuditLog() {
  const demoAdd = useDemoStore((s) => s.addAuditLog)

  return async (log: Omit<AuditLog, 'id' | 'created_at'>) => {
    if (!isSupabaseMode()) {
      demoAdd(log)
      return { error: null }
    }

    const { error } = await supabase!
      .from('audit_logs')
      .insert(log)

    return { error }
  }
}
