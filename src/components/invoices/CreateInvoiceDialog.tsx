import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { openCostInvoiceWindow } from '@/lib/costInvoiceTemplate';
import { CalendarIcon, Loader2, FileText, Plus, Trash2, Package, TrendingUp, Lock, FileBarChart } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: string;
  product_name: string;
  quantity: number;
  client_id: string;
  has_printing: boolean;
  has_embroidery: boolean;
  has_wash_house: boolean;
  fabric: string | null;
  // Internal costs — null when not set, used to compute profit/margin.
  fabric_cost: number | null;
  pattern_cost: number | null;
  cut_sew_cost: number | null;
  cost_currency: string | null;
  client?: {
    id: string;
    name: string;
    brand_name: string | null;
    address: string | null;
  };
}

interface Client {
  id: string;
  name: string;
  brand_name: string | null;
  address: string | null;
}

interface InvoiceLineItem {
  orderId: string | null;
  productName: string;
  description: string;
  inclusions: string[];
  quantity: number | '';
  unitPrice: number | '';
}

interface CreatedInvoiceInfo {
  id: string;
  invoice_number: string;
  client_name: string;
  total: number;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (invoice?: CreatedInvoiceInfo) => void;
  currency?: string;
  exchangeRate?: number;
  availableCurrencies?: string[];
  ratesFromEUR?: Record<string, number>;
  // 'client' (default) saves the invoice and lets the parent open the client
  // PDF afterwards. 'cost' uses the same picker flow but, on submit, persists
  // the invoice as a draft AND immediately opens the watermarked Cost Invoice
  // PDF — no client-facing PDF is shown. This is the "New Cost Report"
  // entry point, accessible only to admins.
  mode?: 'client' | 'cost';
}

const DEFAULT_INCLUSIONS = [
  'Fabric',
  'Screen Prints',
  'Cut & Sew',
  'Tags',
  'Thank you cards',
  'Custom Packaging',
  'Custom Dye',
  'Embroidery',
  'Washing',
  'Labels',
];

const getCurrencySymbol = (currency: string) => {
  const symbols: Record<string, string> = {
    EUR: '€', USD: '$', GBP: '£', TRY: '₺', AED: 'AED ', SAR: 'SAR ', JPY: '¥', CNY: '¥',
  };
  return symbols[currency] ?? (currency + ' ');
};

const getDefaultTerms = (currency: string) => `Terms and Conditions:
• This invoice total does not include taxes that may be applicable based on your location
• The prices above are in (${currency})
• Payment terms is 100% in advance
• Processing & Manufacturing for the order is 10-15 business days
• Delivery will be made in 3-5 business days`;

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  onSuccess,
  currency: propCurrency = 'EUR',
  exchangeRate: propExchangeRate = 50.43,
  availableCurrencies = ['EUR', 'USD', 'GBP', 'TRY', 'AED', 'SAR', 'JPY', 'CNY'],
  ratesFromEUR = {},
  mode = 'client',
}: CreateInvoiceDialogProps) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const isCostMode = mode === 'cost';
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [invoiceCurrency, setInvoiceCurrency] = useState(propCurrency);
  const [termsAndConditions, setTermsAndConditions] = useState(() => getDefaultTerms(propCurrency));
  const [clientNotes, setClientNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [exchangeRate, setExchangeRate] = useState(propExchangeRate);

  // Update exchange rate when invoice currency changes
  useEffect(() => {
    if (invoiceCurrency === 'EUR') {
      setExchangeRate(1);
    } else if (ratesFromEUR[invoiceCurrency]) {
      setExchangeRate(+(ratesFromEUR[invoiceCurrency]).toFixed(4));
    }
    setTermsAndConditions(getDefaultTerms(invoiceCurrency));
  }, [invoiceCurrency, ratesFromEUR]);

  // Sync default currency from prop on open
  useEffect(() => {
    if (open) {
      setInvoiceCurrency(propCurrency);
    }
  }, [open, propCurrency]);
  
  // Line items
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { orderId: null, productName: '', description: '', inclusions: [], quantity: 1, unitPrice: 0 }
  ]);

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    try {
      // Fetch orders with client info. Cost columns are pulled too — they
      // only display for admins, but fetching unconditionally avoids needing
      // a separate query when an admin loads the dialog.
      // If the cost migration hasn't run yet on this DB, the SELECT will fail
      // with PGRST204; we retry without those columns so the dialog still works.
      const fullSelect = 'id, order_number, product_name, quantity, client_id, has_printing, has_embroidery, has_wash_house, fabric, fabric_cost, pattern_cost, cut_sew_cost, cost_currency, client:clients(id, name, brand_name, address)';
      const fallbackSelect = 'id, order_number, product_name, quantity, client_id, has_printing, has_embroidery, has_wash_house, fabric, client:clients(id, name, brand_name, address)';
      let ordersData: any[] | null = null;
      let ordersError: any = null;
      ({ data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(fullSelect)
        .order('created_at', { ascending: false }));
      if (ordersError && (ordersError as any).code === 'PGRST204') {
        ({ data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select(fallbackSelect)
          .order('created_at', { ascending: false }));
      }

      if (ordersError) throw ordersError;
      setOrders((ordersData || []) as unknown as Order[]);

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, brand_name, address')
        .order('brand_name');

      if (clientsError) throw clientsError;
      setClients((clientsData || []) as Client[]);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load orders and clients.',
        variant: 'destructive',
      });
    }
  };

  const clientOrders = orders.filter(o => o.client_id === selectedClientId);
  const selectedClient = clients.find(c => c.id === selectedClientId);

  const handleOrderSelect = (index: number, orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const newItems = [...lineItems];
    const autoInclusions: string[] = [];
    
    if (order.fabric) autoInclusions.push('Fabric');
    if (order.has_printing) autoInclusions.push('Screen Prints');
    autoInclusions.push('Cut & Sew');
    if (order.has_embroidery) autoInclusions.push('Embroidery');
    if (order.has_wash_house) autoInclusions.push('Washing');
    
    newItems[index] = {
      orderId: order.id,
      productName: order.product_name,
      description: '',
      inclusions: autoInclusions,
      quantity: order.quantity,
      unitPrice: 0,
    };
    setLineItems(newItems);
  };

  const handleLineItemChange = (index: number, field: keyof InvoiceLineItem, value: any) => {
    const newItems = [...lineItems];
    (newItems[index] as any)[field] = value;
    setLineItems(newItems);
  };

  const toggleInclusion = (index: number, inclusion: string) => {
    const newItems = [...lineItems];
    const current = newItems[index].inclusions;
    if (current.includes(inclusion)) {
      newItems[index].inclusions = current.filter(i => i !== inclusion);
    } else {
      newItems[index].inclusions = [...current, inclusion];
    }
    setLineItems(newItems);
  };

  const addLineItem = () => {
    setLineItems([
      ...lineItems,
      { orderId: null, productName: '', description: '', inclusions: [], quantity: 1, unitPrice: 0 }
    ]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length <= 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + ((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)), 0);
  };

  // Convert an amount from one currency to another using the EUR-pivoted FX
  // table the parent already loads. Returns the same number if rates aren't
  // available yet — graceful degrade rather than breaking the live preview.
  const convertCurrency = (amount: number, from: string, to: string): number => {
    if (!amount || !from || !to || from === to) return amount;
    const fromUp = from.toUpperCase();
    const toUp = to.toUpperCase();
    const fromRate = fromUp === 'EUR' ? 1 : ratesFromEUR[fromUp];
    const toRate = toUp === 'EUR' ? 1 : ratesFromEUR[toUp];
    if (!fromRate || !toRate) return amount;
    // amount in `from` -> EUR -> `to`
    return (amount / fromRate) * toRate;
  };

  // Per-line cost summary used by the live margin panel. All numbers returned
  // are in the invoice currency so the user sees apples-to-apples math.
  const computeLineCostSummary = (item: InvoiceLineItem) => {
    const order = orders.find((o) => o.id === item.orderId);
    if (!order || (order.fabric_cost == null && order.pattern_cost == null && order.cut_sew_cost == null)) {
      return null;
    }
    const cur = order.cost_currency || 'TRY';
    const fabric = Number(order.fabric_cost) || 0;
    const pattern = Number(order.pattern_cost) || 0;
    const cutSew = Number(order.cut_sew_cost) || 0;
    const totalUnitInCostCur = fabric + pattern + cutSew;
    const totalUnitInInvoiceCur = convertCurrency(totalUnitInCostCur, cur, invoiceCurrency);
    const qty = Number(item.quantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;
    const totalCost = totalUnitInInvoiceCur * qty;
    const totalRevenue = unitPrice * qty;
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    return {
      costCurrency: cur,
      fabric,
      pattern,
      cutSew,
      totalUnitInCostCur,
      totalUnitInInvoiceCur,
      totalCost,
      totalRevenue,
      profit,
      margin,
    };
  };

  // Roll-up across all line items for the dialog footer.
  const overallCostSummary = (() => {
    let totalCost = 0;
    let totalRevenue = 0;
    for (const item of lineItems) {
      const summary = computeLineCostSummary(item);
      if (summary) {
        totalCost += summary.totalCost;
        totalRevenue += summary.totalRevenue;
      } else {
        // Item has no order link / no cost data — still count revenue so the
        // footer matches the invoice total but treat cost as 0.
        totalRevenue += (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      }
    }
    const profit = totalRevenue - totalCost;
    const margin = totalRevenue > 0 ? (profit / totalRevenue) * 100 : 0;
    return { totalCost, totalRevenue, profit, margin };
  })();

  const formatInInvoiceCurrency = (value: number): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: invoiceCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${invoiceCurrency} ${value.toFixed(2)}`;
    }
  };

  const handleSubmit = async () => {
    if (!selectedClientId) {
      toast({
        title: 'Missing Information',
        description: 'Please select a client.',
        variant: 'destructive',
      });
      return;
    }

    if (lineItems.every(item => !item.productName)) {
      toast({
        title: 'Missing Information',
        description: 'Please add at least one product.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const subtotal = calculateSubtotal();
      
      // Create invoice
      const invoiceData = {
        client_id: selectedClientId,
        order_id: lineItems[0]?.orderId || null, // Primary order reference
        invoice_number: invoiceNumber || `INV-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`,
        order_name: lineItems.map(i => i.productName).filter(Boolean).join(', '),
        quantity: lineItems.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0),
        exchange_rate: exchangeRate,
        currency: invoiceCurrency,
        subtotal: subtotal,
        total: subtotal,
        wholesale_price: subtotal,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        client_notes: clientNotes || null,
        internal_notes: internalNotes || null,
        terms_and_conditions: termsAndConditions,
        status: 'draft' as const,
      };

      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert(invoiceData as any)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items, snapshotting cost numbers so the historical
      // profit/margin survives later edits to the order's cost fields.
      const itemsToInsertWithCosts = lineItems
        .filter((item) => item.productName)
        .map((item, idx) => {
          const summary = computeLineCostSummary(item);
          const base: Record<string, any> = {
            invoice_id: invoice.id,
            order_id: item.orderId,
            product_name: item.productName,
            description: item.description,
            inclusions: item.inclusions,
            quantity: Number(item.quantity) || 0,
            unit_price: Number(item.unitPrice) || 0,
            amount: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
            sort_order: idx,
          };
          if (summary) {
            // Snapshot the cost in its original currency so the math is
            // re-derivable; also store profit and margin pre-computed in the
            // invoice's currency for fast read-back.
            base.unit_cost_snapshot = summary.totalUnitInCostCur;
            base.cost_currency = summary.costCurrency;
            base.profit_per_unit = summary.totalRevenue > 0
              ? (Number(item.unitPrice) || 0) - summary.totalUnitInInvoiceCur
              : 0;
            base.margin_percent = summary.margin;
          }
          return base;
        });

      let { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsertWithCosts);

      // Retry without the snapshot columns if the migration isn't applied
      // yet — keeps invoice creation unblocked.
      if (itemsError && (itemsError as any).code === 'PGRST204') {
        const itemsStripped = itemsToInsertWithCosts.map(({
          unit_cost_snapshot: _u,
          cost_currency: _c,
          profit_per_unit: _p,
          margin_percent: _m,
          ...rest
        }) => rest);
        const retry = await supabase.from('invoice_items').insert(itemsStripped);
        itemsError = retry.error;
        if (!itemsError) {
          toast({
            title: 'Invoice created (cost snapshot skipped)',
            description: 'The cost-snapshot columns are not deployed yet. Run the latest Supabase migration to enable cost history.',
          });
        }
      }

      if (itemsError) throw itemsError;
      const itemsToInsert = itemsToInsertWithCosts;

      toast({
        title: isCostMode ? 'Cost Report Created' : 'Invoice Created',
        description: `${isCostMode ? 'Cost report' : 'Invoice'} ${invoice.invoice_number} has been created with ${itemsToInsert.length} item(s).`,
      });

      onOpenChange(false);

      // In cost-report mode, open the watermarked Cost PDF directly here so
      // the user gets the same download experience as a normal invoice flow,
      // but for cost. The parent's onSuccess still fires so the row appears
      // in the invoice list (admins can mark it draft / delete if it was
      // only meant as a one-off analysis).
      if (isCostMode) {
        const costMeta = {
          invoice_number: invoice.invoice_number,
          created_at: invoice.created_at || new Date().toISOString(),
          due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
          currency: invoiceCurrency,
          client: selectedClient
            ? { name: selectedClient.name, brand_name: selectedClient.brand_name, address: selectedClient.address }
            : null,
        };
        const costItems = itemsToInsert.map((row: any) => ({
          product_name: row.product_name,
          inclusions: row.inclusions,
          quantity: row.quantity,
          unit_price: row.unit_price,
          amount: row.amount,
          unit_cost_snapshot: row.unit_cost_snapshot ?? null,
          cost_currency: row.cost_currency ?? null,
          profit_per_unit: row.profit_per_unit ?? null,
          margin_percent: row.margin_percent ?? null,
        }));
        const opened = openCostInvoiceWindow(costMeta, costItems, {
          title: 'Cost Report',
          subtitle: `Internal cost & margin breakdown for ${invoice.invoice_number}`,
          bannerText: '⚠ Internal — Cost Report — Do not share with client',
        });
        if (!opened) {
          toast({
            title: 'Pop-up blocked',
            description: 'Allow pop-ups to open the Cost Report PDF. The report is saved — you can re-open it from the invoice viewer.',
            variant: 'destructive',
          });
        }
      }

      onSuccess?.({
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        client_name: selectedClient?.brand_name || selectedClient?.name || '',
        total: subtotal,
      });

      // Reset form
      setSelectedClientId('');
      setInvoiceNumber('');
      setDueDate(undefined);
      setClientNotes('');
      setInternalNotes('');
      setTermsAndConditions(getDefaultTerms(invoiceCurrency));
      setLineItems([{ orderId: null, productName: '', description: '', inclusions: [], quantity: 1, unitPrice: 0 }]);
    } catch (error: any) {
      console.error('Error creating invoice:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create invoice.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCostMode ? <FileBarChart className="h-5 w-5 text-amber-600" /> : <FileText className="h-5 w-5 text-primary" />}
            {isCostMode ? 'New Cost Report' : 'Create Invoice'}
          </DialogTitle>
          <DialogDescription>
            {isCostMode
              ? 'Same picker flow as a normal invoice — but generates the watermarked Cost PDF (admin-only) instead of the client invoice. The record is saved as a draft so you can re-open the cost PDF later from the invoice list.'
              : 'Create an invoice with multiple products for a client.'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-4">
          <div className="space-y-6 py-4">
            {/* Client Selection */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Select Client *</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a client..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.brand_name || client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Invoice Number (auto-generated if empty)</Label>
                <Input
                  value={invoiceNumber}
                  onChange={(e) => setInvoiceNumber(e.target.value)}
                  placeholder="INV-2026-0001"
                />
              </div>
            </div>

            {/* Client Address Preview */}
            {selectedClient && (
              <div className="p-3 bg-muted rounded-lg">
                <Label className="text-xs text-muted-foreground">Bill To</Label>
                <p className="font-medium">{selectedClient.brand_name || selectedClient.name}</p>
                {selectedClient.address && (
                  <p className="text-sm text-muted-foreground">{selectedClient.address}</p>
                )}
              </div>
            )}

            {/* Invoice Date, Due Date, Currency */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Invoice Date</Label>
                <Input
                  value={format(new Date(), 'dd/MM/yyyy')}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label>Due Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        'w-full justify-start text-left font-normal',
                        !dueDate && 'text-muted-foreground'
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dueDate ? format(dueDate, 'dd/MM/yyyy') : 'Select due date'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dueDate}
                      onSelect={setDueDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Currency</Label>
                <Select value={invoiceCurrency} onValueChange={setInvoiceCurrency}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-[260px]">
                    {availableCurrencies.map((c) => (
                      <SelectItem key={c} value={c}>{getCurrencySymbol(c)} {c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Exchange Rate (1 {invoiceCurrency} = TRY)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(parseFloat(e.target.value) || 0)}
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Products / Line Items</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLineItem}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Item
                </Button>
              </div>

              {lineItems.map((item, index) => (
                <div key={index} className="p-4 border rounded-lg space-y-4 bg-card">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium flex items-center gap-2">
                      <Package className="h-4 w-4" />
                      Item {index + 1}
                    </span>
                    {lineItems.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeLineItem(index)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {/* Order Selection (optional) */}
                    <div className="col-span-2 space-y-2">
                      <Label className="text-xs">Link to Order (optional)</Label>
                      <Select
                        value={item.orderId || ''}
                        onValueChange={(value) => handleOrderSelect(index, value)}
                        disabled={!selectedClientId}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select order..." />
                        </SelectTrigger>
                        <SelectContent>
                          {clientOrders.map((order) => (
                            <SelectItem key={order.id} value={order.id}>
                              {order.order_number} - {order.product_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Quantity</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => handleLineItemChange(index, 'quantity', e.target.value === '' ? '' : parseInt(e.target.value) || '')}
                        onBlur={(e) => { if (e.target.value === '') handleLineItemChange(index, 'quantity', 1); }}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">Unit Price ({invoiceCurrency})</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unitPrice}
                        onChange={(e) => handleLineItemChange(index, 'unitPrice', e.target.value === '' ? '' : parseFloat(e.target.value))}
                        onBlur={(e) => { if (e.target.value === '') handleLineItemChange(index, 'unitPrice', 0); }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs">Product Name</Label>
                      <Input
                        value={item.productName}
                        onChange={(e) => handleLineItemChange(index, 'productName', e.target.value)}
                        placeholder="e.g., Black Maltese Longsleeve"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Amount</Label>
                      <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center font-medium">
                        {getCurrencySymbol(invoiceCurrency)}{((Number(item.quantity) || 0) * (Number(item.unitPrice) || 0)).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {/* Internal Cost Panel — admin-only. Only renders when this
                      line is linked to an order that has cost data. */}
                  {isAdmin && (() => {
                    const summary = computeLineCostSummary(item);
                    if (!summary) {
                      if (item.orderId) {
                        return (
                          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50/40 dark:bg-amber-950/20 p-3 text-xs text-muted-foreground flex items-center gap-2">
                            <Lock className="h-3.5 w-3.5" />
                            No internal costs set on this order yet — add Fabric / Pattern / Cut & Sew costs to see live profit and margin here.
                          </div>
                        );
                      }
                      return null;
                    }
                    const sym = getCurrencySymbol(invoiceCurrency);
                    const fmtCost = (v: number) => `${getCurrencySymbol(summary.costCurrency)}${v.toFixed(2)}`;
                    const profitPositive = summary.profit >= 0;
                    return (
                      <div className="rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                            <TrendingUp className="h-3.5 w-3.5" />
                            Internal Costs &amp; Margin
                          </div>
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                            Admin only · costs in {summary.costCurrency}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                          <div>
                            <p className="text-muted-foreground">Fabric / unit</p>
                            <p className="font-medium">{fmtCost(summary.fabric)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Pattern / unit</p>
                            <p className="font-medium">{fmtCost(summary.pattern)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Cut &amp; Sew / unit</p>
                            <p className="font-medium">{fmtCost(summary.cutSew)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total cost / unit</p>
                            <p className="font-semibold">{fmtCost(summary.totalUnitInCostCur)}</p>
                            {summary.costCurrency !== invoiceCurrency && (
                              <p className="text-[10px] text-muted-foreground">≈ {sym}{summary.totalUnitInInvoiceCur.toFixed(2)}</p>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground">Total cost (line)</p>
                            <p className="font-semibold">{sym}{summary.totalCost.toFixed(2)}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs pt-2 border-t border-amber-200 dark:border-amber-900/50">
                          <div>
                            <p className="text-muted-foreground">Revenue</p>
                            <p className="font-semibold">{sym}{summary.totalRevenue.toFixed(2)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Profit</p>
                            <p className={`font-semibold ${profitPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                              {sym}{summary.profit.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Margin</p>
                            <p className={`font-semibold ${profitPositive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                              {summary.margin.toFixed(1)}%
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Inclusions */}
                  <div className="space-y-2">
                    <Label className="text-xs">Includes</Label>
                    <div className="flex flex-wrap gap-2">
                      {DEFAULT_INCLUSIONS.map((inclusion) => (
                        <div
                          key={inclusion}
                          className="flex items-center space-x-2"
                        >
                          <Checkbox
                            id={`${index}-${inclusion}`}
                            checked={item.inclusions.includes(inclusion)}
                            onCheckedChange={() => toggleInclusion(index, inclusion)}
                          />
                          <label
                            htmlFor={`${index}-${inclusion}`}
                            className="text-sm cursor-pointer"
                          >
                            {inclusion}
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {/* Totals */}
              <div className="p-4 bg-primary/5 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span className="font-medium">{getCurrencySymbol(invoiceCurrency)}{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>{getCurrencySymbol(invoiceCurrency)}{calculateSubtotal().toFixed(2)}</span>
                </div>
              </div>

              {/* Overall margin summary — admin-only. Aggregates cost from
                  every linked line item; lines without cost data contribute
                  to revenue but contribute zero cost. */}
              {isAdmin && overallCostSummary.totalCost > 0 && (
                <div className="rounded-lg border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/30 p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Internal Margin Summary
                    </div>
                    <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Admin only</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted-foreground">Total Costs</p>
                      <p className="font-semibold">{formatInInvoiceCurrency(overallCostSummary.totalCost)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Revenue</p>
                      <p className="font-semibold">{formatInInvoiceCurrency(overallCostSummary.totalRevenue)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Total Profit</p>
                      <p className={`font-semibold ${overallCostSummary.profit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {formatInInvoiceCurrency(overallCostSummary.profit)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Overall Margin</p>
                      <p className={`font-semibold ${overallCostSummary.profit >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                        {overallCostSummary.margin.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Terms & Conditions */}
            <div className="space-y-2">
              <Label>Terms & Conditions</Label>
              <Textarea
                value={termsAndConditions}
                onChange={(e) => setTermsAndConditions(e.target.value)}
                rows={6}
              />
            </div>

            {/* Notes */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Client Notes (visible to client)</Label>
                <Textarea
                  value={clientNotes}
                  onChange={(e) => setClientNotes(e.target.value)}
                  placeholder="Notes visible to the client..."
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <Label>Internal Notes (hidden from client)</Label>
                <Textarea
                  value={internalNotes}
                  onChange={(e) => setInternalNotes(e.target.value)}
                  placeholder="Internal notes..."
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedClientId}
            className={isCostMode ? 'bg-amber-600 hover:bg-amber-700 text-white' : ''}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isCostMode ? 'Generate Cost Report' : 'Create Invoice'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
