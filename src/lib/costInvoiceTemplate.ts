// Shared Cost Invoice / Cost Report HTML template.
//
// Used by InvoiceViewer (re-printing an existing invoice's cost breakdown)
// and CreateInvoiceDialog in cost-report mode (rendering a freshly built
// cost report directly without persisting it). Keep both call sites going
// through this so the layout doesn't drift.
import { format } from 'date-fns';
import { escapeHtml } from '@/lib/html-escape';

export interface CostInvoiceItem {
  product_name: string;
  inclusions?: string[] | null;
  quantity: number;
  unit_price: number;
  amount: number;
  unit_cost_snapshot?: number | null;
  cost_currency?: string | null;
  profit_per_unit?: number | null;
  margin_percent?: number | null;
}

export interface CostInvoiceMeta {
  invoice_number: string;
  created_at: string;
  due_date?: string | null;
  currency?: string | null;
  client?: {
    name?: string | null;
    brand_name?: string | null;
    address?: string | null;
  } | null;
}

export interface PrintCostInvoiceOptions {
  // Title/subtitle shown above the line-items table. Defaults differ for
  // existing invoices vs. the standalone "New Cost Report" flow so the user
  // can tell which view they're looking at on paper.
  title?: string;
  subtitle?: string;
  // Optional banner override (e.g. "Internal Cost Report — not yet invoiced")
  bannerText?: string;
}

const formatAmountInCur = (value: number, cur: string): string => {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${cur} ${value.toFixed(2)}`;
  }
};

export function buildCostInvoiceHtml(
  meta: CostInvoiceMeta,
  items: CostInvoiceItem[],
  opts: PrintCostInvoiceOptions = {},
): string {
  const effCur = (meta.currency || 'EUR').toUpperCase();
  const fmt = (v: number) => formatAmountInCur(v, effCur);

  const clientName = escapeHtml(meta.client?.brand_name || meta.client?.name || 'Client');
  const clientAddress = escapeHtml(meta.client?.address || '');
  const invoiceNumber = escapeHtml(meta.invoice_number);
  const titleText = escapeHtml(opts.title || 'Cost Invoice');
  const subtitleText = escapeHtml(opts.subtitle || `Internal cost & margin breakdown for ${meta.invoice_number}`);
  const bannerText = escapeHtml(opts.bannerText || '⚠ Internal — Cost Invoice — Do not share with client');

  let totalCost = 0;
  let totalRevenue = 0;
  const itemRowsHtml = items.length > 0
    ? items.map((item) => {
        const profitPerUnit = Number(item.profit_per_unit) || 0;
        const marginPct = Number(item.margin_percent) || 0;
        const unitCostInCostCur = Number(item.unit_cost_snapshot) || 0;
        const lineCost = (Number(item.unit_price) - profitPerUnit) * Number(item.quantity);
        const lineRevenue = Number(item.amount);
        totalCost += lineCost;
        totalRevenue += lineRevenue;
        const costCur = item.cost_currency || effCur;
        const profitPositive = profitPerUnit >= 0;
        return `
          <tr>
            <td>${item.quantity}</td>
            <td>
              <div style="font-weight:600;color:#1c1917;">${escapeHtml(item.product_name)}</div>
              ${item.inclusions && item.inclusions.length > 0 ? `<div style="color:#78716c;font-size:10.5px;margin-top:4px;">${item.inclusions.map((i) => escapeHtml(i)).join(' · ')}</div>` : ''}
            </td>
            <td style="text-align:right;">${unitCostInCostCur > 0 ? `${escapeHtml(costCur)} ${unitCostInCostCur.toFixed(2)}` : '—'}</td>
            <td style="text-align:right;">${fmt(lineCost)}</td>
            <td style="text-align:right;">${fmt(item.unit_price)}</td>
            <td style="text-align:right;">${fmt(lineRevenue)}</td>
            <td style="text-align:right;color:${profitPositive ? '#15803d' : '#b91c1c'};font-weight:600;">${fmt(profitPerUnit * Number(item.quantity))}</td>
            <td style="text-align:right;color:${profitPositive ? '#15803d' : '#b91c1c'};font-weight:600;">${marginPct.toFixed(1)}%</td>
          </tr>`;
      }).join('')
    : `<tr><td colspan="8" style="text-align:center;color:#78716c;padding:24px;">No line items found.</td></tr>`;

  const totalProfit = totalRevenue - totalCost;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
  const profitPositive = totalProfit >= 0;
  const issuedDate = meta.created_at ? format(new Date(meta.created_at), 'dd/MM/yyyy') : format(new Date(), 'dd/MM/yyyy');

  return `<!DOCTYPE html>
<html>
<head>
  <title>${titleText} ${invoiceNumber} — INTERNAL</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: white; color: #1c1917; font-size: 13px; min-height: 100vh; position: relative; }
    .page-wrapper { padding: 48px 56px 100px 56px; min-height: 100vh; position: relative; }

    .watermark { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 0; overflow: hidden; }
    .watermark::before {
      content: 'INTERNAL · COST INVOICE · DO NOT SHARE';
      position: absolute; top: 50%; left: 50%;
      transform: translate(-50%, -50%) rotate(-30deg);
      font-size: 70px; font-weight: 800; letter-spacing: 6px;
      color: rgba(212, 81, 30, 0.08); white-space: nowrap;
    }
    .page-content { position: relative; z-index: 1; }

    .logo-section { position: absolute; top: 40px; right: 56px; text-align: right; }
    .logo-text { font-weight: 800; font-size: 52px; color: #1c1917; letter-spacing: 4px; line-height: 1; }
    .logo-dots { position: relative; top: -38px; left: 2px; }
    .logo-dots span { display: inline-block; width: 6px; height: 6px; background: #D4511E; border-radius: 1.5px; margin: 0 1px; }

    .internal-banner { background: #fef3c7; border-left: 4px solid #d97706; padding: 12px 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
    .internal-banner-text { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: #92400e; }

    .company-section { margin-bottom: 32px; max-width: 65%; }
    .company-name { font-weight: 700; font-size: 16px; color: #1c1917; margin-bottom: 2px; }
    .company-brand { font-weight: 600; font-size: 13px; color: #D4511E; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .company-detail { font-size: 11.5px; line-height: 1.7; color: #57534e; }

    .invoice-title-section { margin-bottom: 24px; }
    .invoice-title { font-weight: 800; font-size: 28px; color: #D4511E; text-transform: uppercase; letter-spacing: 3px; }
    .invoice-subtitle { font-size: 12px; color: #78716c; margin-top: 4px; font-weight: 500; }

    .info-grid { display: flex; justify-content: space-between; margin-bottom: 28px; }
    .bill-to { flex: 1; }
    .section-label { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4511E; margin-bottom: 10px; }
    .client-name { font-weight: 600; font-size: 14px; color: #1c1917; margin-bottom: 4px; }
    .client-address { font-size: 12px; color: #57534e; line-height: 1.6; }
    .invoice-meta { text-align: right; min-width: 240px; }
    .meta-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f5f5f4; }
    .meta-label { font-weight: 600; font-size: 10.5px; text-transform: uppercase; letter-spacing: 1px; color: #78716c; }
    .meta-value { font-weight: 500; font-size: 12px; color: #1c1917; }

    .divider { height: 3px; background: #D4511E; margin-bottom: 18px; }

    table.cost-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    table.cost-table thead { background: #1c1917; }
    table.cost-table th { padding: 10px 8px; text-align: left; color: white; font-weight: 600; font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.5px; }
    table.cost-table th.right { text-align: right; }
    table.cost-table td { padding: 10px 8px; border-bottom: 1px solid #f0eeec; font-size: 11.5px; vertical-align: top; }
    table.cost-table tbody tr:nth-child(even) { background: #fafaf9; }

    .summary-section { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-top: 16px; }
    .summary-card { padding: 14px 16px; border-radius: 6px; border: 1px solid #e7e5e4; }
    .summary-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #78716c; font-weight: 600; }
    .summary-value { font-size: 22px; font-weight: 700; color: #1c1917; margin-top: 4px; }
    .summary-card.profit .summary-value { color: ${profitPositive ? '#15803d' : '#b91c1c'}; }
    .summary-card.margin { background: ${profitPositive ? '#dcfce7' : '#fee2e2'}; border-color: ${profitPositive ? '#86efac' : '#fca5a5'}; }
    .summary-card.margin .summary-value { color: ${profitPositive ? '#15803d' : '#b91c1c'}; }

    .footer-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 36px; background: #1c1917; }
    .footer-content { height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 56px; color: rgba(255,255,255,0.85); font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-wrapper { padding: 36px 44px 70px 44px; }
      @page { margin: 0; size: A4; }
    }
  </style>
</head>
<body>
  <div class="watermark"></div>
  <div class="page-wrapper">
    <div class="page-content">
      <div class="logo-section">
        <div><span class="logo-dots"><span></span><span></span><span></span></span></div>
        <div class="logo-text">WDS</div>
      </div>

      <div class="internal-banner">
        <span class="internal-banner-text">${bannerText}</span>
      </div>

      <div class="company-section">
        <div class="company-name">MOHAMMAD AL SAYED</div>
        <div class="company-brand">WorkDuShop</div>
        <div class="company-detail">
          ROSEVELT TEKSTİL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ<br>
          ŞEHREMİNİ MAH. VELET ÇELEBİ SK. NO:9/A FAİTH/İST<br>
          FAİTH V.D: 7352021157 &nbsp;|&nbsp; MERSİS NO: 0735202115700001
        </div>
      </div>

      <div class="invoice-title-section">
        <div class="invoice-title">${titleText}</div>
        <div class="invoice-subtitle">${subtitleText}</div>
      </div>

      <div class="info-grid">
        <div class="bill-to">
          <div class="section-label">Client</div>
          <div class="client-name">${clientName}</div>
          ${clientAddress ? `<div class="client-address">${clientAddress}</div>` : ''}
        </div>
        <div class="invoice-meta">
          <div class="meta-row"><span class="meta-label">Reference</span><span class="meta-value">${invoiceNumber}</span></div>
          <div class="meta-row"><span class="meta-label">Issued</span><span class="meta-value">${issuedDate}</span></div>
          ${meta.due_date ? `<div class="meta-row"><span class="meta-label">Due Date</span><span class="meta-value">${format(new Date(meta.due_date), 'dd/MM/yyyy')}</span></div>` : ''}
          <div class="meta-row"><span class="meta-label">Currency</span><span class="meta-value">${escapeHtml(effCur)}</span></div>
        </div>
      </div>

      <div class="divider"></div>

      <table class="cost-table">
        <thead>
          <tr>
            <th style="width:40px;">QTY</th>
            <th>Description</th>
            <th class="right" style="width:100px;">Unit Cost</th>
            <th class="right" style="width:100px;">Line Cost</th>
            <th class="right" style="width:100px;">Unit Price</th>
            <th class="right" style="width:100px;">Revenue</th>
            <th class="right" style="width:100px;">Profit</th>
            <th class="right" style="width:80px;">Margin</th>
          </tr>
        </thead>
        <tbody>${itemRowsHtml}</tbody>
      </table>

      <div class="summary-section">
        <div class="summary-card">
          <div class="summary-label">Total Costs</div>
          <div class="summary-value">${fmt(totalCost)}</div>
        </div>
        <div class="summary-card">
          <div class="summary-label">Total Revenue</div>
          <div class="summary-value">${fmt(totalRevenue)}</div>
        </div>
        <div class="summary-card profit">
          <div class="summary-label">Total Profit</div>
          <div class="summary-value">${fmt(totalProfit)}</div>
        </div>
        <div class="summary-card margin">
          <div class="summary-label">Overall Margin</div>
          <div class="summary-value">${overallMargin.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  </div>
  <div class="footer-bar">
    <div class="footer-content">
      <span>Internal · Cost &amp; Margin Report</span>
      <span>Generated ${escapeHtml(format(new Date(), "d MMM yyyy 'at' HH:mm"))}</span>
    </div>
  </div>
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 250); });
  </script>
</body>
</html>`;
}

// Convenience helper: open a popup window and write the cost-invoice HTML.
// Returns true on success, false if popups were blocked.
export function openCostInvoiceWindow(
  meta: CostInvoiceMeta,
  items: CostInvoiceItem[],
  opts: PrintCostInvoiceOptions = {},
): boolean {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return false;
  const html = buildCostInvoiceHtml(meta, items, opts);
  printWindow.document.write(html);
  printWindow.document.close();
  return true;
}
