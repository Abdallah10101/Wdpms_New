import { escapeHtml } from '@/lib/html-escape';
import type { OrderAnalysis } from '@/lib/types';

interface PrintData {
  analysis: OrderAnalysis;
  clientName: string;
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function generateOrderAnalysisPrintHTML({ analysis, clientName }: PrintData): string {
  const fc = (v: number) => formatCurrency(v, analysis.display_currency);
  const fcTRY = (v: number) => formatCurrency(v, 'TRY');
  const rate = analysis.exchange_rate || 1;

  const totalCostsTRY = analysis.cost_breakdown.reduce((s, i) => s + (i.amountTry || 0), 0);
  const totalCostsDisplay = rate > 0 ? totalCostsTRY / rate : 0;

  const orderItemsHtml = analysis.order_items
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td class="right">${item.quantity}</td>
        <td class="right">${fc(item.unitPrice)}</td>
        <td class="right">${fc(item.amount)}</td>
      </tr>`
    )
    .join('');

  const totalQty = analysis.order_items.reduce((s, i) => s + i.quantity, 0);

  const invoiceBreakdownHtml = analysis.invoice_breakdown
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.product)}</td>
        <td class="right">${fc(item.totalRevenue * item.firstPaymentPct / 100)}</td>
        <td class="right">${fc(item.totalRevenue * item.secondPaymentPct / 100)}</td>
        <td class="right">${fc(item.totalRevenue)}</td>
      </tr>`
    )
    .join('');

  const invoiceTotalRevenue = analysis.invoice_breakdown.reduce((s, i) => s + i.totalRevenue, 0);
  const invoiceFirst = analysis.invoice_breakdown.reduce(
    (s, i) => s + (i.totalRevenue * i.firstPaymentPct) / 100,
    0
  );
  const invoiceSecond = analysis.invoice_breakdown.reduce(
    (s, i) => s + (i.totalRevenue * i.secondPaymentPct) / 100,
    0
  );

  const costBreakdownHtml = analysis.cost_breakdown
    .map((item) => {
      const converted = rate > 0 ? item.amountTry / rate : 0;
      const pctCosts = totalCostsTRY > 0 ? ((item.amountTry / totalCostsTRY) * 100).toFixed(1) : '0.0';
      const pctRevenue =
        analysis.total_revenue > 0 ? ((converted / analysis.total_revenue) * 100).toFixed(1) : '0.0';
      return `
      <tr>
        <td>${escapeHtml(item.category)}</td>
        <td class="right">${fcTRY(item.amountTry)}</td>
        <td class="right">${fc(converted)}</td>
        <td class="right">${pctCosts}%</td>
        <td class="right">${pctRevenue}%</td>
      </tr>`;
    })
    .join('');

  const costRevPct =
    analysis.total_revenue > 0 ? ((totalCostsDisplay / analysis.total_revenue) * 100).toFixed(1) : '0.0';

  const profitSummaryHtml = analysis.profit_summary
    .map(
      (item) => `
      <tr>
        <td>${escapeHtml(item.product)}</td>
        <td class="right">${fc(item.revenue)}</td>
        <td class="right">${fc(item.costs)}</td>
        <td class="right">${fc(item.grossProfit)}</td>
        <td class="right">${item.marginPct.toFixed(2)}%</td>
      </tr>`
    )
    .join('');

  const notesHtml = analysis.auto_notes
    ? analysis.auto_notes
        .split('\n')
        .filter(Boolean)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')
    : '';

  const firstPct = analysis.invoice_breakdown.length > 0 ? analysis.invoice_breakdown[0].firstPaymentPct : 60;
  const secondPct = analysis.invoice_breakdown.length > 0 ? analysis.invoice_breakdown[0].secondPaymentPct : 40;

  return `<!DOCTYPE html>
<html>
<head>
  <title>Order Analysis - ${escapeHtml(analysis.analysis_title)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Bebas+Neue&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; background: white; color: #1c1917; font-size: 13px; }
    .header { background: #1e3a5f; color: white; padding: 28px 32px; margin: -40px -40px 28px -40px; text-align: center; }
    .header h1 { font-family: 'Bebas Neue', sans-serif; font-size: 36px; letter-spacing: 2px; margin-bottom: 4px; }
    .header .subtitle { font-size: 14px; opacity: 0.9; }
    .header .meta { font-size: 11px; opacity: 0.75; margin-top: 6px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 28px; }
    .summary-card { padding: 16px; border: 1px solid #e5e7eb; text-align: center; }
    .summary-card .label { font-size: 10px; text-transform: uppercase; color: #6b7280; font-weight: 600; }
    .summary-card .value { font-size: 22px; font-weight: 700; margin-top: 4px; }
    .summary-card .sub { font-size: 11px; color: #6b7280; margin-top: 2px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 4px; }
    th { padding: 8px 10px; text-align: left; font-size: 11px; font-weight: 700; border-bottom: 2px solid #e5e7eb; background: #f9fafb; }
    td { padding: 8px 10px; border-bottom: 1px solid #f3f4f6; }
    th.right, td.right { text-align: right; }
    tfoot td { font-weight: 700; border-top: 2px solid #e5e7eb; background: #f9fafb; }
    .notes { padding: 16px; background: #f9fafb; border: 1px solid #e5e7eb; margin-top: 24px; }
    .notes h3 { font-size: 13px; font-weight: 700; margin-bottom: 8px; }
    .notes ul { font-size: 12px; line-height: 1.7; color: #374151; padding-left: 18px; }
    .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 10px; color: #9ca3af; text-align: center; }
    @media print {
      body { padding: 20px; }
      .header { margin: -20px -20px 24px -20px; }
      @page { margin: 15mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>ORDER ANALYSIS REPORT</h1>
    <div class="subtitle">${escapeHtml(clientName)} — ${escapeHtml(analysis.invoice_ref || 'N/A')}</div>
    <div class="meta">Date: ${escapeHtml(analysis.analysis_date)} | Supplier: ${escapeHtml(analysis.supplier || 'N/A')} | Rate: 1 ${escapeHtml(analysis.display_currency)} = ${rate.toFixed(2)} TRY</div>
  </div>

  <div class="summary-grid">
    <div class="summary-card">
      <div class="label">Total Revenue</div>
      <div class="value">${fc(analysis.total_revenue)}</div>
      <div class="sub">All Products</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Costs</div>
      <div class="value">${fc(totalCostsDisplay)}</div>
      <div class="sub">Materials + Production</div>
    </div>
    <div class="summary-card">
      <div class="label">Total Profit</div>
      <div class="value">${fc(analysis.total_profit)}</div>
      <div class="sub">Blended Margin: ${analysis.margin_pct.toFixed(2)}%</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Order Items</div>
    <table>
      <thead><tr>
        <th>Description</th><th>Category</th><th class="right">QTY</th><th class="right">Unit Price</th><th class="right">Amount (${escapeHtml(analysis.display_currency)})</th>
      </tr></thead>
      <tbody>${orderItemsHtml}</tbody>
      <tfoot><tr>
        <td colspan="2"><strong>ORDER TOTAL</strong></td><td class="right"><strong>${totalQty}</strong></td><td></td><td class="right"><strong>${fc(analysis.total_revenue)}</strong></td>
      </tr></tfoot>
    </table>
  </div>

  ${analysis.invoice_breakdown.length > 0 ? `
  <div class="section">
    <div class="section-title">Invoice Breakdown</div>
    <table>
      <thead><tr>
        <th>Product</th><th class="right">${firstPct}% Payment</th><th class="right">${secondPct}% Payment</th><th class="right">Total Revenue</th>
      </tr></thead>
      <tbody>${invoiceBreakdownHtml}</tbody>
      <tfoot><tr>
        <td><strong>TOTAL</strong></td><td class="right"><strong>${fc(invoiceFirst)}</strong></td><td class="right"><strong>${fc(invoiceSecond)}</strong></td><td class="right"><strong>${fc(invoiceTotalRevenue)}</strong></td>
      </tr></tfoot>
    </table>
  </div>` : ''}

  ${analysis.cost_breakdown.length > 0 ? `
  <div class="section">
    <div class="section-title">Cost Breakdown</div>
    <table>
      <thead><tr>
        <th>Category</th><th class="right">Amount (TRY)</th><th class="right">Amount (${escapeHtml(analysis.display_currency)})</th><th class="right">% of Costs</th><th class="right">% of Revenue</th>
      </tr></thead>
      <tbody>${costBreakdownHtml}</tbody>
      <tfoot><tr>
        <td><strong>TOTAL EXPENSES</strong></td><td class="right"><strong>${fcTRY(totalCostsTRY)}</strong></td><td class="right"><strong>${fc(totalCostsDisplay)}</strong></td><td class="right"><strong>100.0%</strong></td><td class="right"><strong>${costRevPct}%</strong></td>
      </tr></tfoot>
    </table>
  </div>` : ''}

  ${analysis.profit_summary.length > 0 ? `
  <div class="section">
    <div class="section-title">Profit &amp; Margin Summary</div>
    <table>
      <thead><tr>
        <th>Product</th><th class="right">Revenue</th><th class="right">Costs</th><th class="right">Gross Profit</th><th class="right">Margin</th>
      </tr></thead>
      <tbody>${profitSummaryHtml}</tbody>
      <tfoot><tr>
        <td><strong>TOTAL</strong></td><td class="right"><strong>${fc(analysis.total_revenue)}</strong></td><td class="right"><strong>${fc(totalCostsDisplay)}</strong></td><td class="right"><strong>${fc(analysis.total_profit)}</strong></td><td class="right"><strong>${analysis.margin_pct.toFixed(2)}%</strong></td>
      </tr></tfoot>
    </table>
  </div>` : ''}

  ${notesHtml ? `
  <div class="notes">
    <h3>Analysis Notes</h3>
    <ul>${notesHtml}</ul>
  </div>` : ''}

  <div class="footer">Confidential | ${escapeHtml(clientName)} — ${escapeHtml(analysis.invoice_ref || '')} | ${escapeHtml(analysis.analysis_date)} | Supplier: ${escapeHtml(analysis.supplier || 'N/A')}</div>
</body>
</html>`;
}
