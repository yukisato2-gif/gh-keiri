import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Area, Location, Employee, EmployeeLocationAuthority, Category, Transaction, CashCheck, Notification, AuditLog, Resident, MonthlyClose, Billing, BillingItem, Payment, Settlement } from '@/types/database'
import { DENOMINATIONS } from '@/lib/constants'

const DEMO_AREAS: Area[] = [
  { id: 'area-1', name: 'GH多摩エリアA', code: 'AR01', created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'area-2', name: 'GH東京23区エリア', code: 'AR04', created_at: '2025-04-01', updated_at: '2025-04-01' },
]

const DEMO_LOCATIONS: Location[] = [
  { id: 'loc-1', name: '狭山ホーム', code: 'GH001', area_id: 'area-1', address: '埼玉県狭山市', phone: null, is_active: true, bank_code: null, bank_name: null, bank_name_kana: null, branch_code: null, bank_branch: null, branch_name_kana: null, account_type: null, account_number: null, account_holder: null, account_holder_kana: null, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'loc-2', name: '朝霞ホーム', code: 'GH002', area_id: 'area-1', address: '埼玉県朝霞市', phone: null, is_active: true, bank_code: null, bank_name: null, bank_name_kana: null, branch_code: null, bank_branch: null, branch_name_kana: null, account_type: null, account_number: null, account_holder: null, account_holder_kana: null, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'loc-3', name: '中野山王ホーム', code: 'GH017', area_id: 'area-2', address: '東京都中野区', phone: null, is_active: true, bank_code: null, bank_name: null, bank_name_kana: null, branch_code: null, bank_branch: null, branch_name_kana: null, account_type: null, account_number: null, account_holder: null, account_holder_kana: null, created_at: '2025-04-01', updated_at: '2025-04-01' },
]

const DEMO_EMPLOYEES: Employee[] = [
  {
    id: 'emp-1', auth_user_id: null, employee_code: 'E001', name: 'デモユーザー',
    email: 'demo@example.com', role: 'home_manager', primary_location_id: 'loc-1',
    is_active: true, created_at: '2025-04-01', updated_at: '2025-04-01',
  },
  {
    id: 'emp-2', auth_user_id: null, employee_code: 'E002', name: '管理太郎',
    email: 'admin@example.com', role: 'hq_admin', primary_location_id: null,
    is_active: true, created_at: '2025-04-01', updated_at: '2025-04-01',
  },
  {
    id: 'emp-3', auth_user_id: null, employee_code: 'E003', name: '主任花子',
    email: 'supervisor@example.com', role: 'supervisor', primary_location_id: 'loc-1',
    is_active: true, created_at: '2025-04-01', updated_at: '2025-04-01',
  },
]

const DEMO_RESIDENTS: Resident[] = [
  { id: 'res-1', location_id: 'loc-1', name: '利用者A', is_active: true, advance_limit: 50000, billing_name: null, billing_address: null, billing_postal_code: null, billing_contact: null, billing_notes: null, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'res-2', location_id: 'loc-1', name: '利用者B', is_active: true, advance_limit: 30000, billing_name: null, billing_address: null, billing_postal_code: null, billing_contact: null, billing_notes: null, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'res-3', location_id: 'loc-1', name: '利用者C', is_active: true, advance_limit: null, billing_name: null, billing_address: null, billing_postal_code: null, billing_contact: null, billing_notes: null, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'res-4', location_id: 'loc-2', name: '利用者D', is_active: true, advance_limit: 40000, billing_name: null, billing_address: null, billing_postal_code: null, billing_contact: null, billing_notes: null, created_at: '2025-04-01', updated_at: '2025-04-01' },
]

const DEMO_AUTHORITIES: EmployeeLocationAuthority[] = [
  { id: 'auth-1', employee_id: 'emp-1', location_id: 'loc-1', can_read: true, can_write: true, can_approve: false, granted_by: null, created_at: '2025-04-01' },
  { id: 'auth-2', employee_id: 'emp-3', location_id: 'loc-1', can_read: true, can_write: true, can_approve: true, granted_by: null, created_at: '2025-04-01' },
  { id: 'auth-3', employee_id: 'emp-3', location_id: 'loc-2', can_read: true, can_write: false, can_approve: false, granted_by: null, created_at: '2025-04-01' },
]

const DEMO_CATEGORIES: Category[] = [
  { id: 'cat-1', name: '食費', code: 'C001', transaction_type: 'cash_advance', income_expense: 'expense', is_active: true, sort_order: 1, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-2', name: '日用品', code: 'C002', transaction_type: 'cash_advance', income_expense: 'expense', is_active: true, sort_order: 2, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-3', name: '医療費', code: 'C003', transaction_type: 'cash_advance', income_expense: 'expense', is_active: true, sort_order: 3, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-4', name: '交通費', code: 'C004', transaction_type: 'cash_advance', income_expense: 'expense', is_active: true, sort_order: 4, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-5', name: '娯楽費', code: 'C005', transaction_type: 'cash_advance', income_expense: 'expense', is_active: true, sort_order: 5, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-6', name: '本社入金', code: 'C010', transaction_type: 'hq_deposit', income_expense: 'income', is_active: true, sort_order: 10, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-7', name: '資金移動（入）', code: 'C011', transaction_type: 'fund_transfer', income_expense: 'income', is_active: true, sort_order: 11, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-8', name: '資金移動（出）', code: 'C012', transaction_type: 'fund_transfer', income_expense: 'expense', is_active: true, sort_order: 12, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-9', name: '手数料', code: 'C020', transaction_type: 'fee', income_expense: 'expense', is_active: true, sort_order: 20, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-10', name: '不足金', code: 'C030', transaction_type: 'shortage_entry', income_expense: 'expense', is_active: true, sort_order: 30, created_at: '2025-04-01', updated_at: '2025-04-01' },
  { id: 'cat-11', name: '過剰金', code: 'C031', transaction_type: 'surplus_entry', income_expense: 'income', is_active: true, sort_order: 31, created_at: '2025-04-01', updated_at: '2025-04-01' },
]

const now = new Date()
const thisYear = now.getFullYear()
const thisMonth = now.getMonth() + 1
const thisYm = `${thisYear}-${String(thisMonth).padStart(2, '0')}`

const DEMO_TRANSACTIONS: Transaction[] = [
  { id: 'tx-1', location_id: 'loc-1', transaction_date: `${thisYm}-01`, transaction_type: 'hq_deposit', income_expense: 'income', category_id: 'cat-6', resident_id: null, description: '月初入金', amount: 200000, receipt_image_path: null, notes: null, recorded_by: 'emp-1', approval_status: 'approved', approved_by: null, approved_at: null, rejection_reason: null, billing_status: 'unbilled', billing_id: null, billing_year: null, billing_month: null, is_over_limit: false, over_limit_approved_by: null, over_limit_approved_at: null, created_at: `${thisYm}-01`, updated_at: `${thisYm}-01` },
  { id: 'tx-2', location_id: 'loc-1', transaction_date: `${thisYm}-03`, transaction_type: 'cash_advance', income_expense: 'expense', category_id: 'cat-1', resident_id: 'res-1', description: '利用者A 食料品購入', amount: 3500, receipt_image_path: null, notes: null, recorded_by: 'emp-1', approval_status: 'approved', approved_by: null, approved_at: null, rejection_reason: null, billing_status: 'unbilled', billing_id: null, billing_year: thisYear, billing_month: thisMonth, is_over_limit: false, over_limit_approved_by: null, over_limit_approved_at: null, created_at: `${thisYm}-03`, updated_at: `${thisYm}-03` },
  { id: 'tx-3', location_id: 'loc-1', transaction_date: `${thisYm}-04`, transaction_type: 'cash_advance', income_expense: 'expense', category_id: 'cat-2', resident_id: 'res-2', description: '利用者B シャンプー等', amount: 1200, receipt_image_path: null, notes: null, recorded_by: 'emp-1', approval_status: 'approved', approved_by: null, approved_at: null, rejection_reason: null, billing_status: 'unbilled', billing_id: null, billing_year: thisYear, billing_month: thisMonth, is_over_limit: false, over_limit_approved_by: null, over_limit_approved_at: null, created_at: `${thisYm}-04`, updated_at: `${thisYm}-04` },
  { id: 'tx-4', location_id: 'loc-1', transaction_date: `${thisYm}-05`, transaction_type: 'cash_advance', income_expense: 'expense', category_id: 'cat-3', resident_id: 'res-3', description: '利用者C 通院費', amount: 5800, receipt_image_path: null, notes: null, recorded_by: 'emp-1', approval_status: 'pending', approved_by: null, approved_at: null, rejection_reason: null, billing_status: 'unbilled', billing_id: null, billing_year: thisYear, billing_month: thisMonth, is_over_limit: false, over_limit_approved_by: null, over_limit_approved_at: null, created_at: `${thisYm}-05`, updated_at: `${thisYm}-05` },
  { id: 'tx-5', location_id: 'loc-1', transaction_date: `${thisYm}-06`, transaction_type: 'cash_advance', income_expense: 'expense', category_id: 'cat-5', resident_id: 'res-1', description: '利用者A 映画鑑賞', amount: 1800, receipt_image_path: null, notes: null, recorded_by: 'emp-1', approval_status: 'draft', approved_by: null, approved_at: null, rejection_reason: null, billing_status: 'unbilled', billing_id: null, billing_year: thisYear, billing_month: thisMonth, is_over_limit: false, over_limit_approved_by: null, over_limit_approved_at: null, created_at: `${thisYm}-06`, updated_at: `${thisYm}-06` },
]

const DEMO_CASH_CHECKS: CashCheck[] = [
  {
    id: 'chk-1', location_id: 'loc-1', check_date: `${thisYm}-01`,
    yen_10000: 15, yen_5000: 4, yen_2000: 0, yen_1000: 20, yen_500: 10,
    yen_100: 30, yen_50: 10, yen_10: 20, yen_5: 10, yen_1: 50,
    total_amount: 200000, expected_balance: 200000, difference: 0,
    checked_by: 'emp-1', notes: null, created_at: `${thisYm}-01`, updated_at: `${thisYm}-01`,
  },
  {
    id: 'chk-2', location_id: 'loc-1', check_date: `${thisYm}-07`,
    yen_10000: 18, yen_5000: 1, yen_2000: 0, yen_1000: 1, yen_500: 1,
    yen_100: 3, yen_50: 2, yen_10: 5, yen_5: 5, yen_1: 25,
    total_amount: 187000, expected_balance: 187700, difference: -700,
    checked_by: 'emp-1', notes: '差額あり、原因調査中', created_at: `${thisYm}-07`, updated_at: `${thisYm}-07`,
  },
]

const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 'notif-1', recipient_id: 'emp-1', type: 'approved', transaction_id: 'tx-2', title: '承認完了', message: '利用者A 食料品購入 が承認されました', is_read: false, created_at: `${thisYm}-04T10:00:00Z` },
  { id: 'notif-2', recipient_id: 'emp-1', type: 'approved', transaction_id: 'tx-3', title: '承認完了', message: '利用者B シャンプー等 が承認されました', is_read: true, created_at: `${thisYm}-05T09:00:00Z` },
]

const DEMO_AUDIT_LOGS: AuditLog[] = [
  { id: 'audit-1', table_name: 'transactions', record_id: 'tx-1', action: 'INSERT', old_data: null, new_data: { description: '月初入金', amount: 200000, approval_status: 'draft' }, changed_by: 'emp-1', created_at: `${thisYm}-01T08:00:00Z` },
  { id: 'audit-2', table_name: 'transactions', record_id: 'tx-1', action: 'UPDATE', old_data: { approval_status: 'draft' }, new_data: { approval_status: 'pending' }, changed_by: 'emp-1', created_at: `${thisYm}-01T08:30:00Z` },
  { id: 'audit-3', table_name: 'transactions', record_id: 'tx-1', action: 'UPDATE', old_data: { approval_status: 'pending' }, new_data: { approval_status: 'approved' }, changed_by: 'emp-1', created_at: `${thisYm}-01T09:00:00Z` },
  { id: 'audit-4', table_name: 'transactions', record_id: 'tx-2', action: 'INSERT', old_data: null, new_data: { description: '利用者A 食料品購入', amount: 3500, approval_status: 'draft' }, changed_by: 'emp-1', created_at: `${thisYm}-03T10:00:00Z` },
]

// ヘルパー: year_month 文字列からINT×2へ変換
export function parseYearMonth(ym: string): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number)
  return { year: y, month: m }
}

// ヘルパー: INT×2から year_month 文字列へ変換
export function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

interface DemoState {
  areas: Area[]
  locations: Location[]
  employee: Employee
  employees: Employee[]
  residents: Resident[]
  authorities: EmployeeLocationAuthority[]
  categories: Category[]
  transactions: Transaction[]
  cashChecks: CashCheck[]
  notifications: Notification[]
  auditLogs: AuditLog[]
  monthlyCloses: MonthlyClose[]
  billings: Billing[]
  billingItems: BillingItem[]
  payments: Payment[]
  settlements: Settlement[]
  addTransaction: (tx: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>) => void
  updateTransaction: (id: string, updates: Partial<Transaction>) => void
  deleteTransaction: (id: string) => void
  addCashCheck: (check: Omit<CashCheck, 'id' | 'created_at' | 'updated_at' | 'total_amount' | 'difference'>) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: () => void
  addResident: (resident: Omit<Resident, 'id' | 'created_at' | 'updated_at'>) => void
  updateResident: (id: string, updates: Partial<Resident>) => void
  updateEmployee: (id: string, updates: Partial<Employee>) => void
  upsertAuthority: (auth: Omit<EmployeeLocationAuthority, 'id' | 'created_at'>) => void
  deleteAuthority: (id: string) => void
  updateLocation: (id: string, updates: Partial<Location>) => void
  upsertMonthlyClose: (mc: Omit<MonthlyClose, 'id' | 'created_at' | 'updated_at'>) => void
  addBilling: (billing: Omit<Billing, 'id' | 'created_at' | 'updated_at' | 'balance'>, items: { transaction_id: string; amount: number }[]) => void
  updateBilling: (id: string, updates: Partial<Billing>) => void
  addPayment: (payment: Omit<Payment, 'id' | 'created_at' | 'updated_at'>) => void
  addAuditLog: (log: Omit<AuditLog, 'id' | 'created_at'>) => void
  upsertSettlement: (settlement: Omit<Settlement, 'id' | 'created_at' | 'updated_at'>) => void
  updateSettlement: (id: string, updates: Partial<Settlement>) => void
}

export const useDemoStore = create<DemoState>()(
  persist(
    (set) => ({
      areas: DEMO_AREAS,
      locations: DEMO_LOCATIONS,
      employee: DEMO_EMPLOYEES[0],
      employees: DEMO_EMPLOYEES,
      residents: DEMO_RESIDENTS,
      authorities: DEMO_AUTHORITIES,
      categories: DEMO_CATEGORIES,
      transactions: DEMO_TRANSACTIONS,
      cashChecks: DEMO_CASH_CHECKS,
      notifications: DEMO_NOTIFICATIONS,
      auditLogs: DEMO_AUDIT_LOGS,
      monthlyCloses: [],
      billings: [],
      billingItems: [],
      payments: [],
      settlements: [],
      addTransaction: (tx) =>
        set((state) => ({
          transactions: [
            { ...tx, id: `tx-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ...state.transactions,
          ],
        })),
      updateTransaction: (id, updates) =>
        set((state) => ({
          transactions: state.transactions.map((tx) =>
            tx.id === id ? { ...tx, ...updates, updated_at: new Date().toISOString() } : tx
          ),
        })),
      deleteTransaction: (id) =>
        set((state) => ({
          transactions: state.transactions.filter((tx) => tx.id !== id),
        })),
      addCashCheck: (check) =>
        set((state) => {
          const total = DENOMINATIONS.reduce((sum, d) => sum + (check[d.key as keyof typeof check] as number) * d.value, 0)
          return {
            cashChecks: [
              { ...check, id: `chk-${Date.now()}`, total_amount: total, difference: total - (check.expected_balance ?? 0), created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
              ...state.cashChecks,
            ],
          }
        }),
      markNotificationRead: (id) =>
        set((state) => ({
          notifications: state.notifications.map((n) =>
            n.id === id ? { ...n, is_read: true } : n
          ),
        })),
      markAllNotificationsRead: () =>
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, is_read: true })),
        })),
      addResident: (resident) =>
        set((state) => ({
          residents: [
            { ...resident, id: `res-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ...state.residents,
          ],
        })),
      updateResident: (id, updates) =>
        set((state) => ({
          residents: state.residents.map((r) =>
            r.id === id ? { ...r, ...updates, updated_at: new Date().toISOString() } : r
          ),
        })),
      updateEmployee: (id, updates) =>
        set((state) => ({
          employees: state.employees.map((e) =>
            e.id === id ? { ...e, ...updates, updated_at: new Date().toISOString() } : e
          ),
          employee: state.employee.id === id ? { ...state.employee, ...updates, updated_at: new Date().toISOString() } : state.employee,
        })),
      upsertAuthority: (auth) =>
        set((state) => {
          const existing = state.authorities.find(
            (a) => a.employee_id === auth.employee_id && a.location_id === auth.location_id
          )
          if (existing) {
            return {
              authorities: state.authorities.map((a) =>
                a.id === existing.id ? { ...a, ...auth } : a
              ),
            }
          }
          return {
            authorities: [
              ...state.authorities,
              { ...auth, id: `auth-${Date.now()}`, created_at: new Date().toISOString() },
            ],
          }
        }),
      deleteAuthority: (id) =>
        set((state) => ({
          authorities: state.authorities.filter((a) => a.id !== id),
        })),
      updateLocation: (id, updates) =>
        set((state) => ({
          locations: state.locations.map((l) =>
            l.id === id ? { ...l, ...updates, updated_at: new Date().toISOString() } : l
          ),
        })),
      upsertMonthlyClose: (mc) =>
        set((state) => {
          const existing = state.monthlyCloses.find(
            (m) => m.location_id === mc.location_id && m.close_year === mc.close_year && m.close_month === mc.close_month
          )
          if (existing) {
            return {
              monthlyCloses: state.monthlyCloses.map((m) =>
                m.id === existing.id ? { ...m, ...mc, updated_at: new Date().toISOString() } : m
              ),
            }
          }
          return {
            monthlyCloses: [
              ...state.monthlyCloses,
              { ...mc, id: `mc-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ],
          }
        }),
      addBilling: (billing, items) =>
        set((state) => {
          const billingId = `bill-${Date.now()}`
          const balance = billing.total_amount + billing.carried_over_amount - billing.paid_amount
          const newBilling = { ...billing, id: billingId, balance, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          const newItems: BillingItem[] = items.map((item, i) => ({
            id: `bi-${Date.now()}-${i}`,
            billing_id: billingId,
            transaction_id: item.transaction_id,
            amount: item.amount,
            created_at: new Date().toISOString(),
          }))
          // Update transaction billing_status
          const txIds = new Set(items.map((i) => i.transaction_id))
          return {
            billings: [...state.billings, newBilling],
            billingItems: [...state.billingItems, ...newItems],
            transactions: state.transactions.map((tx) =>
              txIds.has(tx.id) ? { ...tx, billing_status: 'billed' as const, billing_id: billingId, billing_year: billing.billing_year, billing_month: billing.billing_month } : tx
            ),
          }
        }),
      updateBilling: (id, updates) =>
        set((state) => ({
          billings: state.billings.map((b) => {
            if (b.id !== id) return b
            const updated = { ...b, ...updates, updated_at: new Date().toISOString() }
            // Recalculate balance
            updated.balance = updated.total_amount + updated.carried_over_amount - updated.paid_amount
            return updated
          }),
        })),
      addPayment: (payment) =>
        set((state) => {
          const paymentId = `pay-${Date.now()}`
          const newPayment = { ...payment, id: paymentId, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
          // Update billing paid_amount based on payment_kind
          const billing = state.billings.find((b) => b.id === payment.billing_id)
          const delta = payment.payment_kind === 'refund' ? -payment.amount : payment.amount
          const newPaidAmount = (billing?.paid_amount ?? 0) + delta
          const newBalance = billing ? (billing.total_amount + billing.carried_over_amount - newPaidAmount) : 0
          let newStatus = billing?.status
          if (billing) {
            if (newBalance === 0) newStatus = 'paid'
            else if (newBalance > 0 && newPaidAmount > 0) newStatus = 'partial'
            else if (newBalance < 0) newStatus = 'overpaid'
          }
          return {
            payments: [...state.payments, newPayment],
            billings: state.billings.map((b) =>
              b.id === payment.billing_id
                ? { ...b, paid_amount: newPaidAmount, balance: newBalance, status: newStatus ?? b.status, updated_at: new Date().toISOString() }
                : b
            ),
          }
        }),
      addAuditLog: (log) =>
        set((state) => ({
          auditLogs: [
            { ...log, id: `audit-${Date.now()}`, created_at: new Date().toISOString() },
            ...state.auditLogs,
          ],
        })),
      upsertSettlement: (settlement) =>
        set((state) => {
          const existing = state.settlements.find(
            (s) => s.location_id === settlement.location_id && s.settlement_year === settlement.settlement_year && s.settlement_month === settlement.settlement_month
          )
          if (existing) {
            return {
              settlements: state.settlements.map((s) =>
                s.id === existing.id ? { ...s, ...settlement, updated_at: new Date().toISOString() } : s
              ),
            }
          }
          return {
            settlements: [
              ...state.settlements,
              { ...settlement, id: `stl-${Date.now()}`, created_at: new Date().toISOString(), updated_at: new Date().toISOString() },
            ],
          }
        }),
      updateSettlement: (id, updates) =>
        set((state) => ({
          settlements: state.settlements.map((s) =>
            s.id === id ? { ...s, ...updates, updated_at: new Date().toISOString() } : s
          ),
        })),
    }),
    { name: 'gh-keiri-demo', version: 2 }
  )
)
