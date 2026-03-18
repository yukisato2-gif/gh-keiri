// === AppSheet忠実再現: 型定義 ===

// 対応種別 - AppSheetの8値を忠実に再現
export const 対応種別Values = [
  '立替金',
  '本社入金',
  '入金',
  '出金',
  '手数料',
  '資金移動',
] as const
export type 対応種別 = (typeof 対応種別Values)[number]

// 締めステータス - AppSheetは "未"/"済" の2値のみ
export const 締めステータスValues = ['未', '済'] as const
export type 締めステータス = (typeof 締めステータスValues)[number]

// 役職
export const 役職Values = ['本社管理者', 'SV', 'ホーム長'] as const
export type 役職 = (typeof 役職Values)[number]

// === テーブル型定義 ===

// === 経理拡張: 請求ステータス ===
export const 請求ステータスValues = ['unbilled', 'billed', 'paid', 'partial', 'carried_over'] as const
export type 請求ステータス = (typeof 請求ステータスValues)[number]

export const 請求ステータスLabels: Record<請求ステータス, string> = {
  unbilled: '未請求',
  billed: '請求済',
  paid: '入金済',
  partial: '一部入金',
  carried_over: '繰越',
}

// === 経理拡張: 請求書ステータス ===
export const 請求書ステータスValues = ['draft', 'issued', 'sent', 'partial', 'paid', 'overpaid', 'overdue', 'cancelled'] as const
export type 請求書ステータス = (typeof 請求書ステータスValues)[number]

export const 請求書ステータスLabels: Record<請求書ステータス, string> = {
  draft: '下書き',
  issued: '発行済',
  sent: '送付済',
  partial: '一部入金',
  paid: '入金済',
  overpaid: '過入金',
  overdue: '延滞',
  cancelled: '取消',
}

// === 経理拡張: SV締めステータス ===
export const SV締めステータスValues = ['open', 'closed', 'modified'] as const
export type SV締めステータス = (typeof SV締めステータスValues)[number]

export const SV締めステータスLabels: Record<SV締めステータス, string> = {
  open: '未締め',
  closed: 'SV締め済',
  modified: '締め後修正あり',
}

export interface Transaction {
  id: string
  拠点: string
  日付: string
  年月: number // YYYYMM形式
  対応種別: 対応種別
  摘要カテゴリ: string
  金額: number
  利用者: string | null
  摘要: string | null
  証憑: string | null
  締めステータス: 締めステータス
  作成日時: string
  作成者: string
  更新日時: string
  更新者: string
  修正依頼フラグ: boolean
  修正依頼内容: string | null
  修正依頼者: string | null
  修正依頼日時: string | null
  使用金額: number | null
  入金おつり: number | null
  不明金: number | null
  不明金の理由: string | null
  // === 経理拡張フィールド ===
  billing_status: 請求ステータス | null
  billing_id: string | null
  billing_year: number | null
  billing_month: number | null
  is_over_limit: boolean
  over_limit_approved_by: string | null
  over_limit_approved_at: string | null
}

export interface Check {
  check_id: string
  拠点: string
  日付: string
  一万円札: number
  五千円札: number
  二千円札: number
  千円札: number
  五百円玉: number
  百円硬貨: number
  五十円玉: number
  十円硬貨: number
  五円硬貨: number
  一円硬貨: number
  メモ特記事項: string | null
  作成日時: string
  作成者: string
  更新日時: string
  更新者: string
  差額登録済フラグ: boolean
}

export interface AbstractMaster {
  摘要カテゴリ: string
  対応種別: 対応種別
}

export interface Location {
  拠点id: string
  拠点: string
  エリア: string
  エリア名?: string // JOINで取得
}

export interface Area {
  エリアid: string
  エリア: string
}

export interface User {
  利用者id: string
  利用者: string
  拠点: string
  // === 経理拡張フィールド ===
  advance_limit: number | null       // 立替上限額（NULL=上限なし）
  billing_name: string | null        // 請求先名
  billing_address: string | null     // 請求先住所
}

export interface Employee {
  従業員id: string
  従業員名: string
  メールアドレス: string
  役職: 役職
  担当拠点: string | null
  作成日時: string
  更新日時: string
}

export interface Authority {
  権限id: string
  従業員: string // メールアドレス
  拠点: string
  作成日時: string
  作成者: string
  更新日時: string
  更新者: string
}

export interface MOU {
  覚書id: string
  利用者: string
  拠点: string
  作成日時: string
  作成者: string
  更新日時: string
  更新者: string
}

export interface MonthlyBilling {
  請求id: string
  利用者: string
  拠点: string
  対象年月: number
  合計金額: number
  作成日時: string
  更新日時: string
}

export interface AggregationResult {
  拠点コード: string
  拠点名: string
  対象月: number
  対応種別: string
  取引件数: number
  合計金額: number
}

// === 経理拡張: 新規テーブル型定義 ===

export interface MonthlyClose {
  id: string
  拠点: string
  close_year: number
  close_month: number
  status: SV締めステータス
  closed_by: string | null        // メールアドレス
  closed_at: string | null
  modification_count: number
  last_modified_at: string | null
  last_modified_by: string | null
  last_modified_reason: string | null
  created_at: string
  updated_at: string
}

export interface Billing {
  id: string
  billing_number: string          // INV-YYYYMM-XXXX
  拠点: string
  利用者: string | null
  billing_year: number
  billing_month: number
  billing_date: string
  due_date: string | null
  total_amount: number
  carried_over_amount: number
  paid_amount: number
  balance: number                 // DB生成列: total_amount + carried_over_amount - paid_amount
  status: 請求書ステータス
  notes: string | null
  created_by: string              // メールアドレス
  created_at: string
  updated_at: string
}

export interface BillingItem {
  id: string
  billing_id: string
  transaction_id: string          // UNIQUE制約
  amount: number
  created_at: string
}

// 利用者残高（集計結果）
export interface ResidentBalance {
  利用者id: string
  利用者: string
  advance_limit: number | null
  unbilled_amount: number         // 未請求立替額
  unpaid_amount: number           // 未入金請求残高
  total_balance: number           // 総残高（unbilled + unpaid）
  is_over_limit: boolean
}

// Check計算ヘルパー
export function calcCheckTotal(check: Check): number {
  return (
    check.一万円札 * 10000 +
    check.五千円札 * 5000 +
    check.二千円札 * 2000 +
    check.千円札 * 1000 +
    check.五百円玉 * 500 +
    check.百円硬貨 * 100 +
    check.五十円玉 * 50 +
    check.十円硬貨 * 10 +
    check.五円硬貨 * 5 +
    check.一円硬貨 * 1
  )
}
