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
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { CalendarIcon, Loader2, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface Order {
  id: string;
  order_number: string;
  product_name: string;
  quantity: number;
  client_id: string;
  client?: {
    id: string;
    name: string;
    brand_name: string | null;
  };
}

interface Client {
  id: string;
  name: string;
  brand_name: string | null;
}

interface CalculatorData {
  orderName: string;
  quantity: number;
  exchangeRate: number;
  fabricCost: number;
  productionCost: number;
  accessoriesPerPiece: number;
  patternCostPerPiece: number;
  setupPerPiece: number;
  embroidery: { enabled: boolean; cost: number };
  printing: { enabled: boolean; cost: number };
  digitalPrinting: { enabled: boolean; cost: number };
  extraFees: { enabled: boolean; cost: number };
  washing: { enabled: boolean; cost: number };
  profitInTRY: number;
  totalCostTRY: number;
  wholesalePriceTRY: number;
  retailPriceTRY: number;
  accessories: Array<{ type: string; quantity: number; pricePerUnit: number }>;
}

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  calculatorData: CalculatorData;
  onSuccess?: () => void;
}

export function CreateInvoiceDialog({
  open,
  onOpenChange,
  calculatorData,
  onSuccess,
}: CreateInvoiceDialogProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedClientId, setSelectedClientId] = useState<string>('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [dueDate, setDueDate] = useState<Date | undefined>();
  const [clientNotes, setClientNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  // Update client when order is selected
  useEffect(() => {
    if (selectedOrderId) {
      const order = orders.find(o => o.id === selectedOrderId);
      if (order) {
        setSelectedClientId(order.client_id);
      }
    }
  }, [selectedOrderId, orders]);

  const fetchData = async () => {
    try {
      // Fetch orders with client info
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('id, order_number, product_name, quantity, client_id, client:clients(id, name, brand_name)')
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders((ordersData || []) as unknown as Order[]);

      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from('clients')
        .select('id, name, brand_name')
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

  const handleSubmit = async () => {
    if (!selectedOrderId || !selectedClientId) {
      toast({
        title: 'Missing Information',
        description: 'Please select an order.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    try {
      const invoiceData = {
        order_id: selectedOrderId,
        client_id: selectedClientId,
        invoice_number: invoiceNumber || '', // Will be auto-generated if empty
        order_name: calculatorData.orderName || 'Untitled Order',
        quantity: calculatorData.quantity,
        exchange_rate: calculatorData.exchangeRate,
        fabric_cost: calculatorData.fabricCost,
        production_cost: calculatorData.productionCost,
        accessories_cost: calculatorData.accessoriesPerPiece,
        pattern_cost: calculatorData.patternCostPerPiece,
        setup_cost: calculatorData.setupPerPiece,
        embroidery_cost: calculatorData.embroidery.enabled ? calculatorData.embroidery.cost : 0,
        printing_cost: calculatorData.printing.enabled ? calculatorData.printing.cost : 0,
        digital_printing_cost: calculatorData.digitalPrinting.enabled ? calculatorData.digitalPrinting.cost : 0,
        extra_fees: calculatorData.extraFees.enabled ? calculatorData.extraFees.cost : 0,
        washing_cost: calculatorData.washing.enabled ? calculatorData.washing.cost : 0,
        total_cost_per_piece: calculatorData.totalCostTRY,
        profit_per_piece: calculatorData.profitInTRY,
        wholesale_price: calculatorData.wholesalePriceTRY,
        retail_price: calculatorData.retailPriceTRY,
        accessories_detail: calculatorData.accessories,
        due_date: dueDate ? format(dueDate, 'yyyy-MM-dd') : null,
        client_notes: clientNotes || null,
        internal_notes: internalNotes || null,
        status: 'draft' as const,
      };

      const { data, error } = await supabase
        .from('invoices')
        .insert(invoiceData)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: 'Invoice Created',
        description: `Invoice ${data.invoice_number} has been created.`,
      });

      onOpenChange(false);
      onSuccess?.();

      // Reset form
      setSelectedOrderId('');
      setSelectedClientId('');
      setInvoiceNumber('');
      setDueDate(undefined);
      setClientNotes('');
      setInternalNotes('');
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

  const selectedOrder = orders.find(o => o.id === selectedOrderId);
  const selectedClient = clients.find(c => c.id === selectedClientId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-orange-500" />
            Create Invoice
          </DialogTitle>
          <DialogDescription>
            Create an invoice from the calculator data. The invoice will be linked to the selected order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Order Selection */}
          <div className="space-y-2">
            <Label>Select Order *</Label>
            <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select an order..." />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    <span className="font-mono text-sm">{order.order_number}</span>
                    <span className="mx-2">-</span>
                    <span>{order.product_name}</span>
                    {order.client && (
                      <span className="ml-2 text-muted-foreground">
                        ({order.client.brand_name || order.client.name})
                      </span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Client (auto-populated) */}
          {selectedClient && (
            <div className="p-3 bg-muted rounded-lg">
              <Label className="text-xs text-muted-foreground">Client</Label>
              <p className="font-medium">{selectedClient.brand_name || selectedClient.name}</p>
            </div>
          )}

          {/* Invoice Number */}
          <div className="space-y-2">
            <Label>Invoice Number (leave empty to auto-generate)</Label>
            <Input
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="INV-2025-0001"
            />
          </div>

          {/* Due Date */}
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
                  {dueDate ? format(dueDate, 'PPP') : 'Select due date'}
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

          {/* Pricing Summary */}
          <div className="p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg space-y-2">
            <Label className="text-orange-800">Pricing Summary</Label>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-orange-700">Total Cost:</span>
                <span className="font-medium">₺{calculatorData.totalCostTRY.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-700">Profit:</span>
                <span className="font-medium">₺{calculatorData.profitInTRY.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-700">Wholesale:</span>
                <span className="font-semibold">₺{calculatorData.wholesalePriceTRY.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-orange-700">Retail:</span>
                <span className="font-semibold">₺{calculatorData.retailPriceTRY.toFixed(2)}</span>
              </div>
            </div>
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !selectedOrderId}
            className="bg-orange-500 hover:bg-orange-600"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Invoice
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
