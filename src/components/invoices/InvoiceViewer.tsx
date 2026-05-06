import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, Eye, EyeOff, FileBarChart } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { escapeHtml } from '@/lib/html-escape';
import { useAuth } from '@/hooks/useAuth';
export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue';

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  order_id: string | null;
  product_name: string;
  description: string | null;
  inclusions: string[];
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
  // Snapshot fields populated by the new cost-tracking flow.
  unit_cost_snapshot?: number | null;
  cost_currency?: string | null;
  profit_per_unit?: number | null;
  margin_percent?: number | null;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  order_id: string | null;
  client_id: string;
  status: InvoiceStatus;
  order_name: string;
  quantity: number;
  fabric_cost: number;
  production_cost: number;
  accessories_cost: number;
  pattern_cost: number;
  setup_cost: number;
  embroidery_cost: number;
  printing_cost: number;
  digital_printing_cost: number;
  extra_fees: number;
  washing_cost: number;
  total_cost_per_piece: number;
  profit_per_piece: number;
  wholesale_price: number;
  retail_price: number;
  exchange_rate: number;
  currency?: string | null;
  accessories_detail: any[];
  amount_paid: number;
  due_date: string | null;
  internal_notes: string | null;
  client_notes: string | null;
  terms_and_conditions: string | null;
  subtotal: number;
  total: number;
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  client?: {
    name: string;
    brand_name: string | null;
    address: string | null;
  };
  order?: {
    order_number: string;
    product_name: string;
  };
}

interface InvoiceViewerProps {
  invoice: Invoice | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isClientView?: boolean;
  onPrint?: () => void;
  currency?: string;
}

const STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-purple-100 text-purple-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
};

export function InvoiceViewer({
  invoice,
  open,
  onOpenChange,
  isClientView = false,
  currency = 'EUR',
}: InvoiceViewerProps) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<InvoiceItem[]>([]);

  useEffect(() => {
    if (invoice && open) {
      fetchItems();
    }
  }, [invoice, open]);

  const fetchItems = async () => {
    if (!invoice) return;

    const { data, error } = await supabase
      .from('invoice_items')
      .select('*')
      .eq('invoice_id', invoice.id)
      .order('sort_order');

    if (!error && data) {
      setItems(data as InvoiceItem[]);
    }
  };

  if (!invoice) return null;

  const effectiveCurrency = invoice.currency || currency;

  const formatAmount = (value: number): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: effectiveCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${effectiveCurrency} ${value.toFixed(2)}`;
    }
  };
  
  // Calculate totals from items.
  // Fallback order when items haven't loaded:
  //   1. invoice.total (set by the new multi-line invoice flow)
  //   2. invoice.subtotal (also set by the new flow)
  //   3. wholesale_price * quantity (legacy invoices that stored a per-piece price)
  const subtotal = items.length > 0
    ? items.reduce((sum, item) => sum + item.amount, 0)
    : (invoice.total && invoice.total > 0
        ? invoice.total
        : invoice.subtotal && invoice.subtotal > 0
          ? invoice.subtotal
          : invoice.wholesale_price * invoice.quantity);

  // For legacy single-row fallback (no items), compute a sensible unit price.
  // Prefer dividing the stored total by the stored quantity so the row math
  // adds up; only fall back to wholesale_price for very old invoices.
  const fallbackUnitPrice = invoice.quantity > 0 && subtotal > 0
    ? subtotal / invoice.quantity
    : invoice.wholesale_price;

  // Reusable formatter for the invoice currency.
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

  // Internal Cost Invoice — admin-only PDF that renders the same line items
  // with cost / profit / margin columns plus a footer summary, and a
  // "DO NOT SHARE" watermark across every page. This intentionally lives
  // alongside the client-facing handlePrint so the two outputs can diverge.
  const handlePrintCostInvoice = () => {
    if (!isAdmin) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const effCur = invoice.currency || currency;
    const fmt = (v: number) => formatAmountInCur(v, effCur);

    const clientName = escapeHtml(invoice.client?.brand_name || invoice.client?.name || 'Client');
    const clientAddress = escapeHtml(invoice.client?.address || '');
    const invoiceNumber = escapeHtml(invoice.invoice_number);

    let totalCost = 0;
    let totalRevenue = 0;
    const itemRowsHtml = items.length > 0
      ? items.map((item) => {
          const unitCostInCostCur = Number(item.unit_cost_snapshot) || 0;
          const profitPerUnit = Number(item.profit_per_unit) || 0;
          const marginPct = Number(item.margin_percent) || 0;
          const lineCost = (Number(item.unit_price) - profitPerUnit) * item.quantity;
          const lineRevenue = item.amount;
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
              <td style="text-align:right;color:${profitPositive ? '#15803d' : '#b91c1c'};font-weight:600;">${fmt(profitPerUnit * item.quantity)}</td>
              <td style="text-align:right;color:${profitPositive ? '#15803d' : '#b91c1c'};font-weight:600;">${marginPct.toFixed(1)}%</td>
            </tr>`;
        }).join('')
      : `<tr><td colspan="8" style="text-align:center;color:#78716c;padding:24px;">No line items found for this invoice.</td></tr>`;

    const totalProfit = totalRevenue - totalCost;
    const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const profitPositive = totalProfit >= 0;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Cost Invoice ${invoiceNumber} — INTERNAL</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: white; color: #1c1917; font-size: 13px; min-height: 100vh; position: relative; }
    .page-wrapper { padding: 48px 56px 100px 56px; min-height: 100vh; position: relative; }

    /* Watermark — repeats diagonally across every printed page. */
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
        <span class="internal-banner-text">⚠ Internal — Cost Invoice — Do not share with client</span>
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
        <div class="invoice-title">Cost Invoice</div>
        <div class="invoice-subtitle">Internal cost &amp; margin breakdown for ${invoiceNumber}</div>
      </div>

      <div class="info-grid">
        <div class="bill-to">
          <div class="section-label">Client</div>
          <div class="client-name">${clientName}</div>
          ${clientAddress ? `<div class="client-address">${clientAddress}</div>` : ''}
        </div>
        <div class="invoice-meta">
          <div class="meta-row"><span class="meta-label">Invoice #</span><span class="meta-value">${invoiceNumber}</span></div>
          <div class="meta-row"><span class="meta-label">Issued</span><span class="meta-value">${format(new Date(invoice.created_at), 'dd/MM/yyyy')}</span></div>
          ${invoice.due_date ? `<div class="meta-row"><span class="meta-label">Due Date</span><span class="meta-value">${format(new Date(invoice.due_date), 'dd/MM/yyyy')}</span></div>` : ''}
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

    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    // Escape all user-provided data to prevent XSS
    const clientName = escapeHtml(invoice.client?.brand_name || invoice.client?.name || 'Client');
    const clientAddress = escapeHtml(invoice.client?.address || '');
    const invoiceNumber = escapeHtml(invoice.invoice_number);
    const orderName = escapeHtml(invoice.order_name);
    
    // Generate line items HTML with escaped content
    const itemsHtml = items.length > 0
      ? items.map(item => `
          <tr>
            <td style="vertical-align: top; font-weight: 500;">${item.quantity}</td>
            <td style="vertical-align: top;">
              <div style="font-weight: 600; color: #1c1917;">${escapeHtml(item.product_name)}</div>
              ${item.inclusions && item.inclusions.length > 0 ? `
                <div style="color: #78716c; font-size: 11.5px; margin-top: 6px;">
                  <div style="font-weight: 500; color: #a8a29e; text-transform: uppercase; font-size: 10px; letter-spacing: 0.5px;">Includes:</div>
                  ${item.inclusions.map(inc => `<div style="padding-left: 8px;">- ${escapeHtml(inc)}</div>`).join('')}
                </div>
              ` : ''}
            </td>
            <td style="text-align: right; vertical-align: top;">${formatAmount(item.unit_price)}</td>
            <td style="text-align: right; vertical-align: top; font-weight: 600;">${formatAmount(item.amount)}</td>
          </tr>
        `).join('')
      : `<tr>
          <td style="font-weight: 500;">${invoice.quantity}</td>
          <td style="font-weight: 600; color: #1c1917;">${orderName}</td>
          <td style="text-align: right;">${formatAmount(fallbackUnitPrice)}</td>
          <td style="text-align: right; font-weight: 600;">${formatAmount(subtotal)}</td>
        </tr>`;

    const termsHtml = invoice.terms_and_conditions 
      ? invoice.terms_and_conditions.split('\n').map(line => `<div>${escapeHtml(line)}</div>`).join('')
      : '';
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html, body { height: 100%; }
          body { font-family: 'Inter', -apple-system, sans-serif; background: white; color: #1c1917; font-size: 14px; position: relative; min-height: 100vh; }
          .page-wrapper { padding: 48px 56px 100px 56px; min-height: 100vh; position: relative; }

          /* WDS Logo */
          .logo-section { position: absolute; top: 40px; right: 56px; text-align: right; }
          .logo-text { font-weight: 800; font-size: 52px; color: #1c1917; letter-spacing: 4px; line-height: 1; }
          .logo-dot { display: inline-block; width: 14px; height: 14px; background: #D4511E; border-radius: 3px; position: relative; top: -32px; margin-left: 2px; }
          .logo-dots { position: relative; top: -38px; left: 2px; }
          .logo-dots span { display: inline-block; width: 6px; height: 6px; background: #D4511E; border-radius: 1.5px; margin: 0 1px; }

          /* Company Info */
          .company-section { margin-bottom: 48px; max-width: 65%; }
          .company-name { font-weight: 700; font-size: 16px; color: #1c1917; margin-bottom: 2px; }
          .company-brand { font-weight: 600; font-size: 13px; color: #D4511E; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
          .company-detail { font-size: 11.5px; line-height: 1.7; color: #57534e; }

          /* Invoice Title */
          .invoice-title-section { margin-bottom: 36px; }
          .invoice-title { font-weight: 800; font-size: 32px; color: #D4511E; text-transform: uppercase; letter-spacing: 3px; }

          /* Bill To & Meta */
          .info-grid { display: flex; justify-content: space-between; margin-bottom: 32px; }
          .bill-to { flex: 1; }
          .section-label { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4511E; margin-bottom: 10px; }
          .client-name { font-weight: 600; font-size: 15px; color: #1c1917; margin-bottom: 4px; }
          .client-address { font-size: 13px; color: #57534e; line-height: 1.6; }
          .invoice-meta { text-align: right; min-width: 240px; }
          .meta-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f5f5f4; }
          .meta-row:last-child { border-bottom: none; }
          .meta-label { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #78716c; }
          .meta-value { font-weight: 500; font-size: 13px; color: #1c1917; }

          /* Divider */
          .divider { height: 3px; background: #D4511E; margin-bottom: 0; }

          /* Table */
          table { width: 100%; border-collapse: collapse; margin-bottom: 32px; }
          thead { background: #D4511E; }
          th { padding: 14px 16px; text-align: left; color: white; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; }
          th:nth-child(3), th:nth-child(4) { text-align: right; }
          td { padding: 14px 16px; border-bottom: 1px solid #f0eeec; font-size: 13px; }
          tbody tr:nth-child(even) { background: #fafaf9; }
          tbody tr:hover { background: #f5f5f4; }

          /* Totals */
          .totals-section { display: flex; justify-content: flex-end; margin-bottom: 36px; }
          .totals-box { min-width: 280px; }
          .total-row { display: flex; justify-content: space-between; padding: 10px 16px; font-size: 13px; }
          .total-row.subtotal { border-bottom: 1px solid #e7e5e4; color: #57534e; }
          .total-row.grand-total { background: #D4511E; color: white; font-weight: 700; font-size: 16px; margin-top: 4px; }

          /* Payment info */
          .payment-info { display: flex; justify-content: flex-end; margin-bottom: 32px; }
          .payment-box { min-width: 280px; padding: 12px 16px; background: #fef3c7; border-left: 3px solid #f59e0b; }
          .payment-row { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
          .payment-row.remaining { font-weight: 600; color: #b45309; }

          /* Terms */
          .terms-section { margin-top: 24px; padding: 20px 24px; border: 1px solid #e7e5e4; border-radius: 4px; }
          .terms-title { font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #D4511E; margin-bottom: 12px; }
          .terms-content { font-size: 11.5px; line-height: 1.8; color: #57534e; }
          .terms-agreement { margin-top: 14px; font-size: 10.5px; color: #a8a29e; font-style: italic; }

          /* Client Notes */
          .notes-section { margin-top: 20px; padding: 16px 20px; background: #fafaf9; border-radius: 4px; }
          .notes-title { font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #78716c; margin-bottom: 8px; }
          .notes-content { font-size: 12px; line-height: 1.7; color: #57534e; }

          /* Footer bar */
          .footer-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 48px; background: #D4511E; }
          .footer-content { height: 100%; display: flex; align-items: center; justify-content: center; padding: 0 56px; }
          .footer-text { color: rgba(255,255,255,0.85); font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }

          @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page-wrapper { padding: 36px 44px 90px 44px; }
            .footer-bar { position: fixed; }
            @page { margin: 0; size: A4; }
          }
        </style>
      </head>
      <body>
        <div class="page-wrapper">
          <!-- WDS Logo -->
          <div class="logo-section">
            <div>
              <span class="logo-dots"><span></span><span></span><span></span></span>
            </div>
            <div class="logo-text">WDS</div>
          </div>

          <!-- Company Info -->
          <div class="company-section">
            <div class="company-name">MOHAMMAD AL SAYED</div>
            <div class="company-brand">WorkDuShop</div>
            <div class="company-detail">
              ROSEVELT TEKSTİL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ<br>
              ŞEHREMİNİ MAH. VELET ÇELEBİ SK. NO:9/A FAİTH/İST<br>
              FAİTH V.D: 7352021157 &nbsp;|&nbsp; MERSİS NO: 0735202115700001
            </div>
          </div>

          <!-- Invoice Title -->
          <div class="invoice-title-section">
            <div class="invoice-title">Invoice</div>
          </div>

          <!-- Bill To & Invoice Meta -->
          <div class="info-grid">
            <div class="bill-to">
              <div class="section-label">Bill To</div>
              <div class="client-name">${clientName}</div>
              ${clientAddress ? `<div class="client-address">${clientAddress}</div>` : ''}
            </div>
            <div class="invoice-meta">
              <div class="meta-row">
                <span class="meta-label">Invoice #</span>
                <span class="meta-value">${invoiceNumber}</span>
              </div>
              <div class="meta-row">
                <span class="meta-label">Date</span>
                <span class="meta-value">${format(new Date(invoice.created_at), 'dd/MM/yyyy')}</span>
              </div>
              ${invoice.due_date ? `
              <div class="meta-row">
                <span class="meta-label">Due Date</span>
                <span class="meta-value">${format(new Date(invoice.due_date), 'dd/MM/yyyy')}</span>
              </div>
              ` : ''}
              ${invoice.order?.order_number ? `
              <div class="meta-row">
                <span class="meta-label">Order Ref</span>
                <span class="meta-value">${escapeHtml(invoice.order.order_number)}</span>
              </div>
              ` : ''}
            </div>
          </div>

          <!-- Divider -->
          <div class="divider"></div>

          <!-- Items Table -->
          <table>
            <thead>
              <tr>
                <th style="width: 60px;">QTY</th>
                <th>Description</th>
                <th style="width: 110px;">Unit Price</th>
                <th style="width: 120px;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <!-- Totals -->
          <div class="totals-section">
            <div class="totals-box">
              <div class="total-row subtotal">
                <span>Subtotal</span>
                <span>${formatAmount(subtotal)}</span>
              </div>
              <div class="total-row grand-total">
                <span>Total</span>
                <span>${formatAmount(subtotal)}</span>
              </div>
            </div>
          </div>

          ${invoice.amount_paid > 0 ? `
          <!-- Payment Info -->
          <div class="payment-info">
            <div class="payment-box">
              <div class="payment-row">
                <span>Amount Paid</span>
                <span>${formatAmount(invoice.amount_paid)}</span>
              </div>
              <div class="payment-row remaining">
                <span>Balance Due</span>
                <span>${formatAmount(subtotal - invoice.amount_paid)}</span>
              </div>
            </div>
          </div>
          ` : ''}

          ${invoice.terms_and_conditions ? `
          <!-- Terms & Conditions -->
          <div class="terms-section">
            <div class="terms-title">Terms & Conditions</div>
            <div class="terms-content">${termsHtml}</div>
            <div class="terms-agreement">
              By signing this invoice, I agree to the terms and conditions of this quote and order form and any documents incorporated herein.
            </div>
          </div>
          ` : ''}

          ${invoice.client_notes ? `
          <!-- Notes -->
          <div class="notes-section">
            <div class="notes-title">Notes</div>
            <div class="notes-content">${escapeHtml(invoice.client_notes).split('\\n').map(line => `<div>${line}</div>`).join('')}</div>
          </div>
          ` : ''}
        </div>

        <!-- Orange Footer Bar -->
        <div class="footer-bar">
          <div class="footer-content">
            <span class="footer-text">WorkDuShop &nbsp;&bull;&nbsp; Quality Garment Manufacturing</span>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              Invoice {invoice.invoice_number}
              <Badge className={STATUS_COLORS[invoice.status]}>
                {STATUS_LABELS[invoice.status]}
              </Badge>
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                Client Invoice
              </Button>
              {/* Cost Invoice — admin-only and never shown to client viewers. */}
              {isAdmin && !isClientView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrintCostInvoice}
                  className="border-amber-300 text-amber-900 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-950/40"
                >
                  <FileBarChart className="h-4 w-4 mr-1" />
                  Cost Invoice
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client & Invoice Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Bill To</p>
              <p className="font-semibold">{invoice.client?.brand_name || invoice.client?.name || 'N/A'}</p>
              {invoice.client?.address && (
                <p className="text-sm text-muted-foreground">{invoice.client.address}</p>
              )}
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <div className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Invoice #:</span>
                  <span className="font-mono font-medium">{invoice.invoice_number}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Date:</span>
                  <span>{format(new Date(invoice.created_at), 'dd/MM/yyyy')}</span>
                </div>
                {invoice.due_date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Due:</span>
                    <span>{format(new Date(invoice.due_date), 'dd/MM/yyyy')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Line Items Table */}
          <div>
            <h3 className="font-semibold mb-3">Items</h3>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium w-16">QTY</th>
                    <th className="text-left p-3 font-medium">Description</th>
                    <th className="text-right p-3 font-medium w-24">Unit Price</th>
                    <th className="text-right p-3 font-medium w-28">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {items.length > 0 ? items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-3 align-top font-medium">{item.quantity}</td>
                      <td className="p-3 align-top">
                        <div className="font-medium">{item.product_name}</div>
                        {item.inclusions && item.inclusions.length > 0 && (
                          <div className="text-muted-foreground text-xs mt-1">
                            <span>includes:</span>
                            {item.inclusions.map((inc, i) => (
                              <div key={i}>- {inc}</div>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-right align-top">{formatAmount(item.unit_price)}</td>
                      <td className="p-3 text-right align-top font-medium">{formatAmount(item.amount)}</td>
                    </tr>
                  )) : (
                    <tr className="border-t">
                      <td className="p-3">{invoice.quantity}</td>
                      <td className="p-3">{invoice.order_name}</td>
                      <td className="p-3 text-right">{formatAmount(fallbackUnitPrice)}</td>
                      <td className="p-3 text-right font-medium">{formatAmount(subtotal)}</td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-primary/5">
                    <td colSpan={3} className="p-3 text-right font-semibold">Total</td>
                    <td className="p-3 text-right font-bold text-lg">{formatAmount(subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Payment Status */}
          {invoice.amount_paid > 0 && (
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-green-800">Amount Paid</span>
                <span className="font-semibold text-green-800">{formatAmount(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-green-800">Remaining</span>
                <span className="font-semibold text-green-800">
                  {formatAmount(subtotal - invoice.amount_paid)}
                </span>
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          {invoice.terms_and_conditions && (
            <>
              <Separator />
              <div className="p-4 border rounded-lg">
                <p className="text-sm font-medium text-primary mb-2">Terms & Conditions</p>
                <p className="text-sm text-muted-foreground whitespace-pre-line">{invoice.terms_and_conditions}</p>
              </div>
            </>
          )}

          {/* Notes (Internal only) */}
          {!isClientView && invoice.internal_notes && (
            <>
              <Separator />
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-xs text-yellow-700 uppercase mb-1 flex items-center gap-1">
                  <EyeOff className="h-3 w-3" /> Internal Notes
                </p>
                <p className="text-sm">{invoice.internal_notes}</p>
              </div>
            </>
          )}

          {/* Client Notes */}
          {invoice.client_notes && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase mb-1">Notes</p>
              <p className="text-sm">{invoice.client_notes}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
