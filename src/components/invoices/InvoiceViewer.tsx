import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Download, Printer, Eye, EyeOff } from 'lucide-react';
import { format } from 'date-fns';

export type InvoiceStatus = 'draft' | 'sent' | 'viewed' | 'partially_paid' | 'paid' | 'overdue';

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
  created_at: string;
  sent_at: string | null;
  viewed_at: string | null;
  paid_at: string | null;
  client?: {
    name: string;
    brand_name: string | null;
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
  onPrint,
}: InvoiceViewerProps) {
  if (!invoice) return null;

  const formatCurrency = (value: number) => `₺${value.toFixed(2)}`;
  const formatEUR = (value: number) => `€${(value / invoice.exchange_rate).toFixed(2)}`;

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const clientName = invoice.client?.brand_name || invoice.client?.name || 'Client';
    
    // Generate HTML based on view type
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice ${invoice.invoice_number}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Inter', -apple-system, sans-serif; padding: 40px; background: white; color: #1c1917; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; }
          .logo { font-size: 24px; font-weight: 700; color: #F97316; }
          .invoice-info { text-align: right; }
          .invoice-number { font-size: 20px; font-weight: 600; }
          .status { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 500; }
          .client-info { margin-bottom: 32px; padding: 16px; background: #f5f5f4; border-radius: 8px; }
          .section { margin-bottom: 24px; }
          .section-title { font-size: 14px; font-weight: 600; color: #F97316; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { padding: 12px; text-align: left; border-bottom: 1px solid #e7e5e4; }
          th { font-weight: 500; color: #78716c; font-size: 12px; text-transform: uppercase; }
          td { font-size: 14px; }
          .amount { text-align: right; font-weight: 500; }
          .total-row { background: #f5f5f4; font-weight: 600; }
          .grand-total { background: linear-gradient(135deg, #F97316 0%, #ea580c 100%); color: white; }
          .grand-total td { padding: 16px 12px; font-size: 16px; }
          .notes { margin-top: 32px; padding: 16px; background: #fffbeb; border-radius: 8px; border-left: 4px solid #F97316; }
          .footer { margin-top: 48px; text-align: center; color: #78716c; font-size: 12px; }
          @media print { body { padding: 20px; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="logo">WDS</div>
            <p style="color: #78716c; margin-top: 4px;">WorkDuShop</p>
          </div>
          <div class="invoice-info">
            <div class="invoice-number">${invoice.invoice_number}</div>
            <p style="color: #78716c; margin-top: 4px;">${format(new Date(invoice.created_at), 'PPP')}</p>
            ${invoice.due_date ? `<p style="color: #78716c;">Due: ${format(new Date(invoice.due_date), 'PPP')}</p>` : ''}
          </div>
        </div>

        <div class="client-info">
          <p style="font-size: 12px; color: #78716c; text-transform: uppercase;">Bill To</p>
          <p style="font-size: 18px; font-weight: 600; margin-top: 4px;">${clientName}</p>
        </div>

        <div class="section">
          <div class="section-title">Order Details</div>
          <table>
            <tr>
              <td><strong>Order:</strong> ${invoice.order?.order_number || 'N/A'}</td>
              <td><strong>Product:</strong> ${invoice.order_name}</td>
              <td><strong>Quantity:</strong> ${invoice.quantity} pcs</td>
            </tr>
          </table>
        </div>

        ${!isClientView ? `
        <div class="section">
          <div class="section-title">Cost Breakdown</div>
          <table>
            <thead>
              <tr>
                <th>Description</th>
                <th class="amount">Per Piece (TRY)</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>Fabric</td><td class="amount">${formatCurrency(invoice.fabric_cost)}</td></tr>
              <tr><td>Production</td><td class="amount">${formatCurrency(invoice.production_cost)}</td></tr>
              <tr><td>Accessories</td><td class="amount">${formatCurrency(invoice.accessories_cost)}</td></tr>
              <tr><td>Pattern</td><td class="amount">${formatCurrency(invoice.pattern_cost)}</td></tr>
              <tr><td>Setup</td><td class="amount">${formatCurrency(invoice.setup_cost)}</td></tr>
              ${invoice.embroidery_cost > 0 ? `<tr><td>Embroidery</td><td class="amount">${formatCurrency(invoice.embroidery_cost)}</td></tr>` : ''}
              ${invoice.printing_cost > 0 ? `<tr><td>Printing</td><td class="amount">${formatCurrency(invoice.printing_cost)}</td></tr>` : ''}
              ${invoice.digital_printing_cost > 0 ? `<tr><td>Digital Printing</td><td class="amount">${formatCurrency(invoice.digital_printing_cost)}</td></tr>` : ''}
              ${invoice.washing_cost > 0 ? `<tr><td>Washing</td><td class="amount">${formatCurrency(invoice.washing_cost)}</td></tr>` : ''}
              ${invoice.extra_fees > 0 ? `<tr><td>Extra Fees</td><td class="amount">${formatCurrency(invoice.extra_fees)}</td></tr>` : ''}
              <tr class="total-row"><td><strong>Total Cost</strong></td><td class="amount"><strong>${formatCurrency(invoice.total_cost_per_piece)}</strong></td></tr>
              <tr><td>Your Profit</td><td class="amount">${formatCurrency(invoice.profit_per_piece)}</td></tr>
            </tbody>
          </table>
        </div>
        ` : ''}

        <div class="section">
          <div class="section-title">Pricing</div>
          <table>
            <tbody>
              <tr><td>Wholesale Price (per piece)</td><td class="amount">${formatCurrency(invoice.wholesale_price)} / ${formatEUR(invoice.wholesale_price)}</td></tr>
              <tr><td>Retail Price (per piece)</td><td class="amount">${formatCurrency(invoice.retail_price)} / ${formatEUR(invoice.retail_price)}</td></tr>
              <tr class="grand-total">
                <td>Total (${invoice.quantity} pcs × ${formatCurrency(invoice.wholesale_price)})</td>
                <td class="amount">${formatCurrency(invoice.wholesale_price * invoice.quantity)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        ${invoice.client_notes ? `
        <div class="notes">
          <p style="font-weight: 500; margin-bottom: 8px;">Notes</p>
          <p>${invoice.client_notes}</p>
        </div>
        ` : ''}

        <div class="footer">
          <p>Thank you for your business!</p>
          <p style="margin-top: 4px;">Exchange Rate: 1 EUR = ${invoice.exchange_rate} TRY</p>
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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-1" />
                {isClientView ? 'Print' : 'Print Client Version'}
              </Button>
              {!isClientView && (
                <Button variant="outline" size="sm" onClick={() => {
                  const prev = isClientView;
                  handlePrint();
                }}>
                  <Eye className="h-4 w-4 mr-1" />
                  Print Full Version
                </Button>
              )}
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Client & Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Client</p>
              <p className="font-semibold">{invoice.client?.brand_name || invoice.client?.name || 'N/A'}</p>
            </div>
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-xs text-muted-foreground uppercase">Order</p>
              <p className="font-semibold">{invoice.order?.order_number || 'N/A'}</p>
              <p className="text-sm text-muted-foreground">{invoice.order_name}</p>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Created</p>
              <p className="font-medium">{format(new Date(invoice.created_at), 'PPP')}</p>
            </div>
            {invoice.due_date && (
              <div>
                <p className="text-muted-foreground">Due Date</p>
                <p className="font-medium">{format(new Date(invoice.due_date), 'PPP')}</p>
              </div>
            )}
            {invoice.sent_at && (
              <div>
                <p className="text-muted-foreground">Sent</p>
                <p className="font-medium">{format(new Date(invoice.sent_at), 'PPP')}</p>
              </div>
            )}
          </div>

          <Separator />

          {/* Cost Breakdown (Internal Only) */}
          {!isClientView && (
            <>
              <div>
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                  Cost Breakdown (Internal)
                </h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span>Fabric</span>
                    <span className="font-medium">{formatCurrency(invoice.fabric_cost)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span>Production</span>
                    <span className="font-medium">{formatCurrency(invoice.production_cost)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span>Accessories</span>
                    <span className="font-medium">{formatCurrency(invoice.accessories_cost)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span>Pattern</span>
                    <span className="font-medium">{formatCurrency(invoice.pattern_cost)}</span>
                  </div>
                  <div className="flex justify-between p-2 bg-muted/50 rounded">
                    <span>Setup</span>
                    <span className="font-medium">{formatCurrency(invoice.setup_cost)}</span>
                  </div>
                  {invoice.embroidery_cost > 0 && (
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Embroidery</span>
                      <span className="font-medium">{formatCurrency(invoice.embroidery_cost)}</span>
                    </div>
                  )}
                  {invoice.printing_cost > 0 && (
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Printing</span>
                      <span className="font-medium">{formatCurrency(invoice.printing_cost)}</span>
                    </div>
                  )}
                  {invoice.washing_cost > 0 && (
                    <div className="flex justify-between p-2 bg-muted/50 rounded">
                      <span>Washing</span>
                      <span className="font-medium">{formatCurrency(invoice.washing_cost)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 p-3 bg-orange-50 rounded-lg">
                  <div className="flex justify-between font-semibold">
                    <span>Total Cost per Piece</span>
                    <span>{formatCurrency(invoice.total_cost_per_piece)}</span>
                  </div>
                  <div className="flex justify-between text-orange-600 mt-1">
                    <span>Your Profit per Piece</span>
                    <span>{formatCurrency(invoice.profit_per_piece)}</span>
                  </div>
                </div>
              </div>
              <Separator />
            </>
          )}

          {/* Pricing */}
          <div>
            <h3 className="font-semibold mb-3">Pricing</h3>
            <div className="space-y-2">
              <div className="flex justify-between p-3 bg-muted rounded-lg">
                <span>Wholesale Price (per piece)</span>
                <div className="text-right">
                  <span className="font-semibold">{formatCurrency(invoice.wholesale_price)}</span>
                  <span className="text-muted-foreground ml-2">/ {formatEUR(invoice.wholesale_price)}</span>
                </div>
              </div>
              <div className="flex justify-between p-3 bg-muted rounded-lg">
                <span>Retail Price (per piece)</span>
                <div className="text-right">
                  <span className="font-semibold">{formatCurrency(invoice.retail_price)}</span>
                  <span className="text-muted-foreground ml-2">/ {formatEUR(invoice.retail_price)}</span>
                </div>
              </div>
              <div className="flex justify-between p-4 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg">
                <span className="font-semibold">Total ({invoice.quantity} pcs)</span>
                <span className="font-bold text-lg">{formatCurrency(invoice.wholesale_price * invoice.quantity)}</span>
              </div>
            </div>
          </div>

          {/* Payment Status */}
          {invoice.amount_paid > 0 && (
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="flex justify-between">
                <span className="text-green-800">Amount Paid</span>
                <span className="font-semibold text-green-800">{formatCurrency(invoice.amount_paid)}</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-green-800">Remaining</span>
                <span className="font-semibold text-green-800">
                  {formatCurrency((invoice.wholesale_price * invoice.quantity) - invoice.amount_paid)}
                </span>
              </div>
            </div>
          )}

          {/* Notes */}
          {(invoice.client_notes || (!isClientView && invoice.internal_notes)) && (
            <>
              <Separator />
              <div className="space-y-3">
                {invoice.client_notes && (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-xs text-muted-foreground uppercase mb-1">Client Notes</p>
                    <p className="text-sm">{invoice.client_notes}</p>
                  </div>
                )}
                {!isClientView && invoice.internal_notes && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-yellow-700 uppercase mb-1 flex items-center gap-1">
                      <EyeOff className="h-3 w-3" /> Internal Notes
                    </p>
                    <p className="text-sm">{invoice.internal_notes}</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
