import type { Billing, BillingItem, Location, Resident } from '@/types/database'
import { formatCurrency, formatDate } from './formatters'

interface BillingPdfData {
  billing: Billing
  items: BillingItem[]
  location: Location
  resident: Resident
}

/**
 * Generate and open a billing PDF using a print-optimized HTML window.
 * Uses browser print dialog for PDF output — no external library needed.
 */
export function generateBillingPdf({ billing, items, location, resident }: BillingPdfData) {
  const billingName = resident.billing_name || resident.name + ' 様'
  const billingAddress = resident.billing_address || ''
  const billingPostalCode = resident.billing_postal_code || ''

  const accountTypeLabel = location.account_type === 'ordinary' ? '普通' : location.account_type === 'checking' ? '当座' : ''

  const itemRows = items.map((item) => {
    const tx = item.transaction
    return `<tr>
      <td>${tx ? formatDate(tx.transaction_date) : '-'}</td>
      <td>${tx?.description || '-'}</td>
      <td class="amount">${formatCurrency(item.amount)}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<title>請求書 ${billing.billing_number}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif; font-size: 12px; color: #333; padding: 40px; }
  .header { text-align: center; margin-bottom: 30px; }
  .header h1 { font-size: 24px; letter-spacing: 8px; border-bottom: 2px solid #333; display: inline-block; padding-bottom: 4px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 24px; }
  .meta-left { max-width: 50%; }
  .meta-right { text-align: right; font-size: 11px; }
  .recipient { font-size: 16px; font-weight: bold; border-bottom: 1px solid #333; padding-bottom: 2px; margin-bottom: 4px; }
  .address { font-size: 11px; color: #666; margin-bottom: 2px; }
  .total-box { background: #f5f5f5; border: 1px solid #ccc; padding: 12px 20px; text-align: center; margin-bottom: 24px; }
  .total-label { font-size: 11px; color: #666; }
  .total-amount { font-size: 22px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th, td { border: 1px solid #ccc; padding: 6px 10px; text-align: left; font-size: 11px; }
  th { background: #f0f0f0; font-weight: bold; }
  td.amount { text-align: right; font-family: monospace; }
  .footer-row td { font-weight: bold; background: #fafafa; }
  .bank-info { margin-top: 20px; padding: 12px; border: 1px solid #ccc; font-size: 11px; }
  .bank-info h3 { font-size: 12px; margin-bottom: 6px; }
  .notes { margin-top: 16px; font-size: 11px; color: #666; }
  .issuer { margin-top: 24px; text-align: right; font-size: 11px; }
  @media print {
    body { padding: 20px; }
    @page { size: A4; margin: 15mm; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>請　求　書</h1>
  </div>

  <div class="meta">
    <div class="meta-left">
      ${billingPostalCode ? `<p class="address">〒${billingPostalCode}</p>` : ''}
      ${billingAddress ? `<p class="address">${billingAddress}</p>` : ''}
      <p class="recipient">${billingName}</p>
    </div>
    <div class="meta-right">
      <p>請求番号: ${billing.billing_number}</p>
      <p>請求日: ${formatDate(billing.billing_date)}</p>
      <p>対象月: ${billing.billing_year}年${billing.billing_month}月</p>
      ${billing.due_date ? `<p>お支払期限: ${formatDate(billing.due_date)}</p>` : ''}
    </div>
  </div>

  <div class="total-box">
    <p class="total-label">ご請求金額（税込）</p>
    <p class="total-amount">${formatCurrency(billing.total_amount)}</p>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width:20%">日付</th>
        <th>内容</th>
        <th style="width:20%">金額</th>
      </tr>
    </thead>
    <tbody>
      ${itemRows}
      <tr class="footer-row">
        <td colspan="2" style="text-align:right">合計</td>
        <td class="amount">${formatCurrency(billing.total_amount)}</td>
      </tr>
    </tbody>
  </table>

  ${location.bank_name ? `
  <div class="bank-info">
    <h3>お振込先</h3>
    <p>${location.bank_name} ${location.bank_branch || ''}</p>
    <p>${accountTypeLabel} ${location.account_number || ''}</p>
    <p>口座名義: ${location.account_holder || ''}</p>
  </div>
  ` : ''}

  ${billing.notes ? `<div class="notes"><p>備考: ${billing.notes}</p></div>` : ''}

  <div class="issuer">
    <p>${location.name}</p>
    ${location.address ? `<p>${location.address}</p>` : ''}
    ${location.phone ? `<p>TEL: ${location.phone}</p>` : ''}
  </div>

  <script>window.onload = function() { window.print(); }</script>
</body>
</html>`

  const printWindow = window.open('', '_blank')
  if (printWindow) {
    printWindow.document.write(html)
    printWindow.document.close()
  }
}
