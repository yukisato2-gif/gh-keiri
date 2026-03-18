export const DENOMINATIONS = [
  { key: 'yen_10000', label: '一万円札', value: 10000 },
  { key: 'yen_5000', label: '五千円札', value: 5000 },
  { key: 'yen_2000', label: '二千円札', value: 2000 },
  { key: 'yen_1000', label: '千円札', value: 1000 },
  { key: 'yen_500', label: '五百円玉', value: 500 },
  { key: 'yen_100', label: '百円玉', value: 100 },
  { key: 'yen_50', label: '五十円玉', value: 50 },
  { key: 'yen_10', label: '十円玉', value: 10 },
  { key: 'yen_5', label: '五円玉', value: 5 },
  { key: 'yen_1', label: '一円玉', value: 1 },
] as const

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  cash_advance: '立替金',
  hq_deposit: '本社入金',
  fund_transfer: '資金移動',
  fee: '手数料',
  shortage_entry: '不足金額登録',
  surplus_entry: '過剰金額登録',
}

export const INCOME_EXPENSE_LABELS: Record<string, string> = {
  income: '入金',
  expense: '出金',
}

export const APPROVAL_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  pending: '承認待ち',
  approved: '承認済み',
  rejected: '差戻し',
  corrected: '修正済み',
}

export const APPROVAL_STATUS_OPTIONS = [
  { value: '', label: '全ステータス' },
  { value: 'draft', label: '下書き' },
  { value: 'pending', label: '承認待ち' },
  { value: 'approved', label: '承認済み' },
  { value: 'rejected', label: '差戻し' },
] as const

export const ROLE_LABELS: Record<string, string> = {
  hq_admin: '本社管理者',
  section_chief: '課長',
  supervisor: 'SV',
  home_manager: 'ホーム長',
}

export const BILLING_STATUS_LABELS: Record<string, string> = {
  unbilled: '未請求',
  billed: '請求済',
  paid: '入金済',
  partial: '一部入金',
  carried_over: '繰越',
}

export const INVOICE_STATUS_LABELS: Record<string, string> = {
  draft: '下書き',
  issued: '発行済',
  sent: '送付済',
  partial: '一部入金',
  paid: '入金済',
  overdue: '未収',
  cancelled: '取消',
}

export const MONTHLY_CLOSE_STATUS_LABELS: Record<string, string> = {
  open: '未締め',
  closed: 'SV締め済',
  modified: '締め後修正あり',
}

export const SETTLEMENT_STATUS_LABELS: Record<string, string> = {
  pending: '集計中',
  requested: '振込依頼済',
  transferred: '振込済',
  confirmed: '確認済',
}

export const PAYMENT_METHOD_LABELS: Record<string, string> = {
  transfer: '振込',
  cash: '現金',
  other: 'その他',
}

export const HIGH_VALUE_THRESHOLD = 10000
