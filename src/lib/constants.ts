import type { AbstractMaster } from '@/types/database'

// AppSheet Abstract(摘要)マスタ - 19エントリを忠実に再現
export const ABSTRACT_MASTER: AbstractMaster[] = [
  { 摘要カテゴリ: '食材費', 対応種別: '立替金' },
  { 摘要カテゴリ: '日用品費', 対応種別: '立替金' },
  { 摘要カテゴリ: '医療費', 対応種別: '立替金' },
  { 摘要カテゴリ: '被服費', 対応種別: '立替金' },
  { 摘要カテゴリ: '教養娯楽費', 対応種別: '立替金' },
  { 摘要カテゴリ: '交通費', 対応種別: '立替金' },
  { 摘要カテゴリ: '嗜好品', 対応種別: '出金' },
  { 摘要カテゴリ: '理美容費', 対応種別: '出金' },
  { 摘要カテゴリ: 'その他', 対応種別: '立替金' },
  { 摘要カテゴリ: '本部入金', 対応種別: '本社入金' },
  { 摘要カテゴリ: 'おつり', 対応種別: '入金' },
  { 摘要カテゴリ: '不明金', 対応種別: '出金' },
  { 摘要カテゴリ: '仮払金', 対応種別: '出金' },
  { 摘要カテゴリ: '不足金額登録', 対応種別: '出金' },
  { 摘要カテゴリ: '過剰金額登録', 対応種別: '入金' },
  { 摘要カテゴリ: '電話代立替', 対応種別: '立替金' },
  { 摘要カテゴリ: '自販機（おやつ）', 対応種別: '立替金' },
  { 摘要カテゴリ: '自販機（飲料）', 対応種別: '出金' },
  { 摘要カテゴリ: 'クリーニング', 対応種別: '立替金' },
]

// 高額閾値 - AppSheet Bot通知の基準
export const HIGH_VALUE_THRESHOLD = 10000

// 入金系の対応種別（残高計算で加算される）
export const INCOME_TYPES: string[] = ['本社入金', '入金']

// 出金系の対応種別（残高計算で減算される）
export const EXPENSE_TYPES: string[] = [
  '立替金',
  '出金',
  '手数料',
  '資金移動',
]

// 摘要カテゴリから対応種別を自動取得
export function get対応種別(摘要カテゴリ: string): string | undefined {
  const entry = ABSTRACT_MASTER.find((a) => a.摘要カテゴリ === 摘要カテゴリ)
  return entry?.対応種別
}

// 金額の入出金判定
export function is入金(対応種別: string): boolean {
  return INCOME_TYPES.includes(対応種別)
}
