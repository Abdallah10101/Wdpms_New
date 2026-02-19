import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { escapeHtml } from '@/lib/html-escape';
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

  const formatAmount = (value: number): string => {
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
  };
  
  // Calculate totals from items
  const subtotal = items.length > 0 
    ? items.reduce((sum, item) => sum + item.amount, 0)
    : invoice.subtotal || (invoice.wholesale_price * invoice.quantity);

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
            <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4; width: 60px; vertical-align: top; font-weight: 500;">${item.quantity}</td>
            <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4; vertical-align: top;">
              <div style="font-weight: 600;">${escapeHtml(item.product_name)}</div>
              ${item.inclusions && item.inclusions.length > 0 ? `
                <div style="color: #78716c; font-size: 13px; margin-top: 6px;">
                  <div>includes :</div>
                  ${item.inclusions.map(inc => `<div>- ${escapeHtml(inc)}</div>`).join('')}
                </div>
              ` : ''}
            </td>
            <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4; text-align: right; width: 100px; vertical-align: top;">${formatAmount(item.unit_price)}</td>
            <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4; text-align: right; width: 120px; vertical-align: top; font-weight: 500;">${formatAmount(item.amount)}</td>
          </tr>
        `).join('')
      : `<tr>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4;">${invoice.quantity}</td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4;">${orderName}</td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4; text-align: right;">${formatAmount(invoice.wholesale_price)}</td>
          <td style="padding: 16px 12px; border-bottom: 1px solid #e7e5e4; text-align: right;">${formatAmount(invoice.wholesale_price * invoice.quantity)}</td>
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
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Bebas+Neue&family=Great+Vibes&display=swap');
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; background: white; color: #1c1917; font-size: 14px; }
          .header { margin-bottom: 40px; }
          .invoice-title { font-family: 'Bebas Neue', sans-serif; font-size: 48px; font-weight: 700; color: #0369a1; text-decoration: underline; text-underline-offset: 8px; }
          .company-info { margin-top: 16px; font-size: 12px; line-height: 1.6; }
          .company-name { font-weight: 700; font-size: 13px; }
          .bill-section { display: flex; justify-content: space-between; margin-bottom: 40px; }
          .bill-to { flex: 1; }
          .bill-to-label { color: #0369a1; font-weight: 700; font-size: 14px; margin-bottom: 8px; }
          .invoice-meta { text-align: right; }
          .invoice-meta-row { display: flex; justify-content: flex-end; gap: 24px; margin-bottom: 4px; }
          .invoice-meta-label { color: #0369a1; font-weight: 700; font-size: 12px; text-transform: uppercase; }
          .invoice-meta-value { min-width: 100px; text-align: right; }
          .divider { height: 3px; background: linear-gradient(90deg, #0369a1, #0369a1 50%, #f59e0b 50%, #f59e0b); margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 40px; }
          th { padding: 12px; text-align: left; color: #0369a1; font-weight: 700; font-size: 12px; text-transform: uppercase; border-bottom: 2px solid #e7e5e4; }
          th:nth-child(3), th:nth-child(4) { text-align: right; }
          .total-section { display: flex; justify-content: flex-end; margin-bottom: 40px; }
          .total-box { text-align: right; }
          .total-row { display: flex; justify-content: space-between; gap: 48px; padding: 8px 0; border-bottom: 1px solid #e7e5e4; }
          .grand-total { font-size: 18px; font-weight: 700; border-bottom: none; padding-top: 12px; }
          .terms-section { max-width: 400px; margin-left: auto; padding: 20px; border: 1px solid #e7e5e4; }
          .terms-title { color: #0369a1; font-weight: 700; font-size: 14px; margin-bottom: 12px; text-transform: uppercase; }
          .terms-content { font-size: 12px; line-height: 1.8; color: #57534e; }
          .footer { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 40px; }
          .thank-you { font-family: 'Great Vibes', cursive; font-size: 48px; color: #1e40af; }
          .signature-note { font-size: 11px; color: #78716c; max-width: 300px; text-align: right; }
          @media print { 
            body { padding: 20px; }
            @page { margin: 20mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="invoice-title">INVOICE</div>
          <div class="company-info">
            <div class="company-name">MOHAMMAD AL SAYED</div>
            <div>WORKDUSHOP</div>
            <div>ROSEVELT TEKSTİL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ</div>
            <div>ŞEHREMİNİ MAH. VELET ÇELEBİ SK.</div>
            <div>NO:9/A FAİTH/İST</div>
            <div>FAİTH V.D:7352021157</div>
            <div>MERSİS NO:0735202115700001</div>
          </div>
        </div>

        <div class="bill-section">
          <div class="bill-to">
            <div class="bill-to-label">BILL TO</div>
            <div style="font-weight: 500;">${clientName}</div>
            ${clientAddress ? `<div>${clientAddress}</div>` : ''}
          </div>
          <div class="invoice-meta">
            <div class="invoice-meta-row">
              <span class="invoice-meta-label">INVOICE #</span>
              <span class="invoice-meta-value">${escapeHtml(invoice.invoice_number.replace('INV-', '').replace(/-/g, ''))}</span>
            </div>
            <div class="invoice-meta-row">
              <span class="invoice-meta-label">INVOICE DATE</span>
              <span class="invoice-meta-value">${format(new Date(invoice.created_at), 'dd/MM/yyyy')}</span>
            </div>
            ${invoice.due_date ? `
            <div class="invoice-meta-row">
              <span class="invoice-meta-label">DUE DATE</span>
              <span class="invoice-meta-value">${format(new Date(invoice.due_date), 'dd/MM/yyyy')}</span>
            </div>
            ` : ''}
          </div>
        </div>

        <div class="divider"></div>

        <table>
          <thead>
            <tr>
              <th style="width: 60px;">QTY</th>
              <th>DESCRIPTION</th>
              <th style="width: 100px;">UNIT PRICE</th>
              <th style="width: 120px;">AMOUNT</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="total-section">
          <div class="total-box">
            <div class="total-row grand-total">
              <span>Total</span>
              <span>${formatAmount(subtotal)}</span>
            </div>
          </div>
        </div>

        ${invoice.terms_and_conditions ? `
        <div class="terms-section">
          <div class="terms-title">TERMS & CONDITIONS</div>
          <div class="terms-content">${termsHtml}</div>
          <div style="margin-top: 16px; font-size: 11px; color: #57534e;">
            By signing this invoice, I agree to the terms and conditions of this quote and order form and any documents incorporated herein.
          </div>
        </div>
        ` : ''}

        <div class="footer">
          <div class="thank-you">Thank you</div>
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
            <Button variant="outline" size="sm" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-1" />
              Print Invoice
            </Button>
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
                      <td className="p-3 text-right">{formatAmount(invoice.wholesale_price)}</td>
                      <td className="p-3 text-right font-medium">{formatAmount(invoice.wholesale_price * invoice.quantity)}</td>
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
