export type UserRole = 'hq_admin' | 'section_chief' | 'supervisor' | 'home_manager'
export type TransactionType = 'cash_advance' | 'hq_deposit' | 'fund_transfer' | 'fee' | 'shortage_entry' | 'surplus_entry'
export type IncomeExpenseType = 'income' | 'expense'
export type ApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'corrected'

export interface Area {
  id: string
  name: string
  code: string
  created_at: string
  updated_at: string
}

export interface Location {
  id: string
  name: string
  code: string
  area_id: string
  address: string | null
  phone: string | null
  is_active: boolean
  // 口座情報（全銀フォーマット対応）
  bank_code: string | null
  bank_name: string | null
  bank_name_kana: string | null
  branch_code: string | null
  bank_branch: string | null
  branch_name_kana: string | null
  account_type: string | null
  account_number: string | null
  account_holder: string | null
  account_holder_kana: string | null
  created_at: string
  updated_at: string
  area?: Area
}

export interface Employee {
  id: string
  auth_user_id: string | null
  employee_code: string
  name: string
  email: string
  role: UserRole
  primary_location_id: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  primary_location?: Location
}

export interface EmployeeLocationAuthority {
  id: string
  employee_id: string
  location_id: string
  can_read: boolean
  can_write: boolean
  can_approve: boolean
  granted_by: string | null
  created_at: string
}

export interface Resident {
  id: string
  location_id: string
  name: string
  is_active: boolean
  advance_limit: number | null       // 立替上限額（NULL=上限なし）
  billing_name: string | null
  billing_address: string | null
  billing_postal_code: string | null
  billing_contact: string | null
  billing_notes: string | null
  created_at: string
  updated_at: string
  location?: Location
}

export interface Category {
  id: string
  name: string
  code: string
  transaction_type: TransactionType  // ※ categories.transaction_type（科目マスタの分類用）
  income_expense: IncomeExpenseType
  is_active: boolean
  sort_order: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  location_id: string
  transaction_date: string
  transaction_type: TransactionType  // ※ transactions.type に相当（DBカラム名は type）
  income_expense: IncomeExpenseType
  category_id: string
  resident_id: string | null
  description: string
  amount: number
  receipt_image_path: string | null
  notes: string | null
  recorded_by: string
  approval_status: ApprovalStatus
  approved_by: string | null
  approved_at: string | null
  rejection_reason: string | null
  // 請求管理
  billing_status: BillingStatus
  billing_id: string | null
  billing_year: number | null        // 請求対象年（例: 2026）— INT×2方式
  billing_month: number | null       // 請求対象月（例: 3）— INT×2方式
  // 立替上限超過
  is_over_limit: boolean             // 立替上限超過フラグ
  over_limit_approved_by: string | null
  over_limit_approved_at: string | null
  created_at: string
  updated_at: string
  category?: Category
  recorder?: Employee
  location?: Location
  resident?: Resident
}

export type NotificationType = 'approval_request' | 'approved' | 'rejected'

export interface Notification {
  id: string
  recipient_id: string
  type: NotificationType
  transaction_id: string | null
  title: string
  message: string
  is_read: boolean
  created_at: string
}

export type AuditAction = 'INSERT' | 'UPDATE' | 'DELETE'

export interface AuditLog {
  id: string
  table_name: string
  record_id: string
  action: AuditAction
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_by: string | null
  created_at: string
  changer?: Employee
}

export interface CashCheck {
  id: string
  location_id: string
  check_date: string
  yen_10000: number
  yen_5000: number
  yen_2000: number
  yen_1000: number
  yen_500: number
  yen_100: number
  yen_50: number
  yen_10: number
  yen_5: number
  yen_1: number
  total_amount: number
  expected_balance: number | null
  difference: number
  checked_by: string
  notes: string | null
  created_at: string
  updated_at: string
  checker?: Employee
  location?: Location
}

// === 経理拡張 型定義 ===

export type BillingStatus = 'unbilled' | 'billed' | 'paid' | 'partial' | 'carried_over'
export type InvoiceStatus = 'draft' | 'issued' | 'sent' | 'partial' | 'paid' | 'overpaid' | 'overdue' | 'cancelled'
export type MonthlyCloseStatus = 'open' | 'closed' | 'modified'
export type SettlementStatus = 'pending' | 'requested' | 'transferred' | 'confirmed'
export type PaymentMethod = 'transfer' | 'cash' | 'other'
export type PaymentKind = 'receipt' | 'refund'

export interface MonthlyClose {
  id: string
  location_id: string
  close_year: number                  // INT×2方式
  close_month: number                 // INT×2方式
  status: MonthlyCloseStatus
  closed_by: string | null
  closed_at: string | null
  modification_count: number
  last_modified_at: string | null
  last_modified_by: string | null
  last_modified_reason: string | null
  created_at: string
  updated_at: string
  closer?: Employee
}

export interface Billing {
  id: string
  billing_number: string              // INV-YYYYMM-XXXX
  location_id: string
  resident_id: string | null          // NULL可（共通費対応）
  billing_year: number                // INT×2方式
  billing_month: number               // INT×2方式
  billing_date: string
  due_date: string | null
  total_amount: number
  carried_over_amount: number         // 前月繰越額
  paid_amount: number
  balance: number                     // 請求残高（= total_amount + carried_over_amount - paid_amount）
  status: InvoiceStatus
  notes: string | null
  created_by: string
  created_at: string
  updated_at: string
  resident?: Resident
  location?: Location
  items?: BillingItem[]
  payments?: Payment[]
}

export interface BillingItem {
  id: string
  billing_id: string
  transaction_id: string              // UNIQUE制約（重複請求防止）
  amount: number                      // 通常はtransaction.amountと同額。分割・部分・調整請求時に異なる値
  created_at: string
  transaction?: Transaction
}

export interface Payment {
  id: string
  billing_id: string
  payment_date: string
  amount: number                      // 常に正数（返金も正数で記録）
  payment_kind: PaymentKind           // 'receipt'=入金, 'refund'=返金
  payment_method: PaymentMethod
  notes: string | null
  recorded_by: string
  created_at: string
  updated_at: string
  recorder?: Employee
  billing?: Billing
}

export interface Settlement {
  id: string
  location_id: string
  settlement_year: number             // INT×2方式
  settlement_month: number            // INT×2方式
  total_advance_amount: number
  total_payment_received: number
  replenishment_amount: number
  status: SettlementStatus
  transfer_date: string | null
  transfer_amount: number | null
  transferred_by: string | null
  confirmed_by: string | null
  confirmed_at: string | null
  notes: string | null
  created_at: string
  updated_at: string
  location?: Location
}

// 利用者残高（集計結果）
export interface ResidentBalance {
  resident_id: string
  resident_name: string
  advance_limit: number | null
  unbilled_amount: number             // 未請求立替額
  unpaid_amount: number               // 未入金請求残高
  total_balance: number               // 総残高（unbilled + unpaid）
  is_over_limit: boolean
}

// Supabase generated types placeholder
export interface Database {
  public: {
    Tables: {
      areas: { Row: Area; Insert: Omit<Area, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Area, 'id'>> }
      locations: { Row: Location; Insert: Omit<Location, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Location, 'id'>> }
      employees: { Row: Employee; Insert: Omit<Employee, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Employee, 'id'>> }
      employee_location_authority: { Row: EmployeeLocationAuthority; Insert: Omit<EmployeeLocationAuthority, 'id' | 'created_at'>; Update: Partial<Omit<EmployeeLocationAuthority, 'id'>> }
      categories: { Row: Category; Insert: Omit<Category, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Category, 'id'>> }
      residents: { Row: Resident; Insert: Omit<Resident, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Resident, 'id'>> }
      transactions: { Row: Transaction; Insert: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Transaction, 'id'>> }
      cash_checks: { Row: CashCheck; Insert: Omit<CashCheck, 'id' | 'created_at' | 'updated_at' | 'total_amount' | 'difference'>; Update: Partial<Omit<CashCheck, 'id' | 'total_amount' | 'difference'>> }
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Omit<Notification, 'id'>> }
      audit_logs: { Row: AuditLog; Insert: Omit<AuditLog, 'id' | 'created_at'>; Update: never }
      monthly_closes: { Row: MonthlyClose; Insert: Omit<MonthlyClose, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<MonthlyClose, 'id'>> }
      billings: { Row: Billing; Insert: Omit<Billing, 'id' | 'created_at' | 'updated_at' | 'balance'>; Update: Partial<Omit<Billing, 'id' | 'balance'>> }
      billing_items: { Row: BillingItem; Insert: Omit<BillingItem, 'id' | 'created_at'>; Update: never }
      payments: { Row: Payment; Insert: Omit<Payment, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Payment, 'id'>> }
      settlements: { Row: Settlement; Insert: Omit<Settlement, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Omit<Settlement, 'id'>> }
    }
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
      transaction_type: TransactionType
      income_expense_type: IncomeExpenseType
      approval_status: ApprovalStatus
    }
  }
}
