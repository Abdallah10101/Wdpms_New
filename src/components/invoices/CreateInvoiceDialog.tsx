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
import { CalendarIcon, Loader2, FileText, Plus, Trash2, Package } from 'lucide-react';
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
}: CreateInvoiceDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
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
      // Fetch orders with client info
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, product_name, quantity, client_id, has_printing, has_embroidery, has_wash_house, fabric, client:clients(id, name, brand_name, address)')
        .order('created_at', { ascending: false });

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
        .insert(invoiceData)
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Create invoice items
      const itemsToInsert = lineItems
        .filter(item => item.productName)
        .map((item, idx) => ({
          invoice_id: invoice.id,
          order_id: item.orderId,
          product_name: item.productName,
          description: item.description,
          inclusions: item.inclusions,
          quantity: Number(item.quantity) || 0,
          unit_price: Number(item.unitPrice) || 0,
          amount: (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0),
          sort_order: idx,
        }));

      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      toast({
        title: 'Invoice Created',
        description: `Invoice ${invoice.invoice_number} has been created with ${itemsToInsert.length} item(s).`,
      });

      onOpenChange(false);
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
            <FileText className="h-5 w-5 text-primary" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>
            Create an invoice with multiple products for a client.
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
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
