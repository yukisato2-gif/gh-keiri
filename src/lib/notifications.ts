// AppSheet Bot再現: アプリ内通知システム
// 将来的にメール送信（Supabase Edge Functions）に拡張可能
import { supabase } from '@/lib/supabase'
import { generateId } from '@/lib/utils'

export type NotificationType =
  | '高額入出金'
  | '通常入出金'
  | '修正依頼'
  | '修正完了'
  | '不足過剰アラート'
  | '残高不一致'

interface NotifyParams {
  type: NotificationType
  title: string
  body: string
  拠点: string
  // 通知先: 特定のメールアドレスまたは role
  recipientEmail?: string
  recipientRole?: string
  relatedId?: string
  createdBy: string
}

// 通知レコードを作成
export async function createNotification(params: NotifyParams) {
  const now = new Date().toISOString()
  await supabase.from('notifications').insert({
    id: generateId(),
    type: params.type,
    title: params.title,
    body: params.body,
    拠点: params.拠点,
    recipient_email: params.recipientEmail ?? null,
    recipient_role: params.recipientRole ?? null,
    related_id: params.relatedId ?? null,
    read: false,
    created_by: params.createdBy,
    created_at: now,
  })
}

// === AppSheet Bot 再現関数 ===

// Bot 1: 高額入出金記録(10,000円以上)
export async function notify高額入出金(
  拠点: string,
  金額: number,
  摘要カテゴリ: string,
  createdBy: string,
  transactionId: string,
) {
  await createNotification({
    type: '高額入出金',
    title: `【高額】${摘要カテゴリ} ¥${金額.toLocaleString()}`,
    body: `10,000円以上の入出金が記録されました。\n摘要カテゴリ: ${摘要カテゴリ}\n金額: ¥${金額.toLocaleString()}`,
    拠点,
    recipientRole: 'SV',
    relatedId: transactionId,
    createdBy,
  })
}

// Bot 2: 通常入出金記録(10,000円未満)
export async function notify通常入出金(
  拠点: string,
  金額: number,
  摘要カテゴリ: string,
  createdBy: string,
  transactionId: string,
) {
  await createNotification({
    type: '通常入出金',
    title: `${摘要カテゴリ} ¥${金額.toLocaleString()}`,
    body: `入出金が記録されました。\n摘要カテゴリ: ${摘要カテゴリ}\n金額: ¥${金額.toLocaleString()}`,
    拠点,
    recipientRole: 'SV',
    relatedId: transactionId,
    createdBy,
  })
}

// Bot 3: 修正依頼通知
export async function notify修正依頼(
  拠点: string,
  内容: string,
  createdBy: string,
  transactionId: string,
) {
  await createNotification({
    type: '修正依頼',
    title: '修正依頼があります',
    body: `修正依頼内容: ${内容}`,
    拠点,
    recipientRole: 'ホーム長',
    relatedId: transactionId,
    createdBy,
  })
}

// Bot 4: 不足/過剰金額登録アラート
export async function notify不足過剰アラート(
  拠点: string,
  type: '過剰' | '不足',
  金額: number,
  createdBy: string,
) {
  await createNotification({
    type: '不足過剰アラート',
    title: `【${type}金額登録】¥${金額.toLocaleString()}`,
    body: `残高チェックで${type}が検出され、${type}金額登録が行われました。\n金額: ¥${金額.toLocaleString()}`,
    拠点,
    recipientRole: 'SV',
    createdBy,
  })
}

// Bot 5: 修正完了通知
export async function notify修正完了(
  拠点: string,
  依頼者Email: string,
  createdBy: string,
  transactionId: string,
) {
  await createNotification({
    type: '修正完了',
    title: '修正が完了しました',
    body: '依頼した修正が完了しました。内容をご確認ください。',
    拠点,
    recipientEmail: 依頼者Email,
    relatedId: transactionId,
    createdBy,
  })
}

// Bot 6: 残高不一致アラート
export async function notify残高不一致(
  拠点: string,
  差額: number,
  createdBy: string,
) {
  await createNotification({
    type: '残高不一致',
    title: `【残高不一致】差額 ¥${Math.abs(差額).toLocaleString()}`,
    body: `残高チェックで差額が検出されました。\n差額: ¥${差額.toLocaleString()}`,
    拠点,
    recipientRole: 'SV',
    createdBy,
  })
}
