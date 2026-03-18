// AppSheet PDF帳票生成の再現
// ブラウザのwindow.print()を利用してPDF保存可能な帳票を生成

import { formatCurrency, formatDate } from '@/lib/utils'
import { is入金 } from '@/lib/constants'
import type { Transaction } from '@/types/database'

interface ReportHeader {
  拠点名: string
  対象年月: string // "2026年3月" 形式
  作成日: string
}

// 入出金明細書PDF
export function generate入出金明細PDF(
  transactions: Transaction[],
  header: ReportHeader,
) {
  // 入金・出金の合計
  let totalIncome = 0
  let totalExpense = 0
  for (const t of transactions) {
    if (is入金(t.対応種別)) {
      totalIncome += t.金額
    } else {
      totalExpense += t.金額
    }
  }

  const rows = transactions
    .map(
      (t) => `
      <tr>
        <td>${formatDate(t.日付)}</td>
        <td>${t.対応種別}</td>
        <td>${t.摘要カテゴリ}</td>
        <td>${t.利用者 ?? ''}</td>
        <td class="right ${is入金(t.対応種別) ? 'income' : ''}">${is入金(t.対応種別) ? formatCurrency(t.金額) : ''}</td>
        <td class="right ${!is入金(t.対応種別) ? 'expense' : ''}">${!is入金(t.対応種別) ? formatCurrency(t.金額) : ''}</td>
        <td>${t.摘要 ?? ''}</td>
      </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>入出金明細書 - ${header.拠点名} ${header.対象年月}</title>
<style>
  @page { size: A4 landscape; margin: 15mm; }
  body { font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; font-size: 11px; color: #333; }
  h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
  .meta { text-align: center; font-size: 12px; color: #666; margin-bottom: 16px; }
  .summary { display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 12px; }
  .summary div { padding: 8px 16px; border: 1px solid #ddd; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 8px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  .right { text-align: right; }
  .income { color: #16a34a; }
  .expense { color: #dc2626; }
  .total-row { font-weight: bold; background: #fafafa; }
  .footer { margin-top: 16px; text-align: right; font-size: 10px; color: #999; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<h1>入出金明細書</h1>
<p class="meta">${header.拠点名} | ${header.対象年月} | 作成日: ${header.作成日}</p>

<div class="summary">
  <div>件数: <strong>${transactions.length}件</strong></div>
  <div>入金合計: <strong class="income">${formatCurrency(totalIncome)}</strong></div>
  <div>出金合計: <strong class="expense">${formatCurrency(totalExpense)}</strong></div>
  <div>差引残高: <strong>${formatCurrency(totalIncome - totalExpense)}</strong></div>
</div>

<table>
  <thead>
    <tr>
      <th>日付</th>
      <th>対応種別</th>
      <th>摘要カテゴリ</th>
      <th>利用者</th>
      <th class="right">入金</th>
      <th class="right">出金</th>
      <th>摘要</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="4">合計</td>
      <td class="right income">${formatCurrency(totalIncome)}</td>
      <td class="right expense">${formatCurrency(totalExpense)}</td>
      <td></td>
    </tr>
  </tbody>
</table>
<p class="footer">GH出納帳 - ${header.拠点名}</p>
</body>
</html>`

  openPrintWindow(html)
}

// 月次請求書PDF
export function generate月次請求PDF(
  records: { 利用者: string; 拠点: string; 合計金額: number }[],
  header: ReportHeader,
) {
  const total = records.reduce((sum, r) => sum + r.合計金額, 0)

  const rows = records
    .map(
      (r, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${r.利用者}</td>
        <td>${r.拠点}</td>
        <td class="right">${formatCurrency(r.合計金額)}</td>
      </tr>`,
    )
    .join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>月次利用者請求書 - ${header.拠点名} ${header.対象年月}</title>
<style>
  @page { size: A4; margin: 20mm; }
  body { font-family: "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif; font-size: 12px; color: #333; }
  h1 { text-align: center; font-size: 20px; margin-bottom: 4px; }
  .meta { text-align: center; font-size: 12px; color: #666; margin-bottom: 24px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
  th, td { border: 1px solid #ccc; padding: 6px 12px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  .right { text-align: right; }
  .total-row { font-weight: bold; background: #fafafa; font-size: 14px; }
  .footer { margin-top: 24px; text-align: right; font-size: 10px; color: #999; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
<h1>月次利用者請求書</h1>
<p class="meta">${header.拠点名} | ${header.対象年月} | 作成日: ${header.作成日}</p>

<table>
  <thead>
    <tr>
      <th>No.</th>
      <th>利用者</th>
      <th>拠点</th>
      <th class="right">立替金合計</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr class="total-row">
      <td colspan="3">合計 (${records.length}名)</td>
      <td class="right">${formatCurrency(total)}</td>
    </tr>
  </tbody>
</table>
<p class="footer">GH出納帳 - ${header.拠点名}</p>
</body>
</html>`

  openPrintWindow(html)
}

function openPrintWindow(html: string) {
  const win = window.open('', '_blank')
  if (!win) {
    alert('ポップアップがブロックされました。ポップアップを許可してください。')
    return
  }
  win.document.write(html)
  win.document.close()
  // 少し待ってからprint
  setTimeout(() => win.print(), 500)
}
