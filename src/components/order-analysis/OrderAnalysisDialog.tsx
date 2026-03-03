import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import {
  Loader2, Plus, Trash2, BarChart3, Printer, RefreshCw,
} from 'lucide-react';
import { format } from 'date-fns';
import { generateOrderAnalysisPrintHTML } from './orderAnalysisPrint';
import type {
  OrderAnalysis, OrderAnalysisOrderItem, OrderAnalysisInvoiceItem,
  OrderAnalysisCostItem, OrderAnalysisProfitItem, ANALYSIS_COST_CATEGORIES,
} from '@/lib/types';

const FALLBACK_CURRENCIES = ['EUR', 'USD', 'GBP', 'TRY', 'AED', 'SAR', 'JPY', 'CNY'];

const COST_CATEGORIES = [
  'Fabric', 'Production', 'Washhouse', 'Printing', 'Accessories',
  'Embroidery', 'Packaging', 'Shipping', 'Commission', 'Other',
];

const getCurrencyLabel = (code: string): string => {
  try {
    const symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: code })
      .formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
    return symbol === code ? code : `${symbol} ${code}`;
  } catch {
    return code;
  }
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
  existing?: OrderAnalysis | null;
  onSaved?: () => void;
}

export function OrderAnalysisDialog({
  open, onOpenChange, clientId, clientName, existing, onSaved,
}: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const isView = !!existing;

  // Form state
  const [title, setTitle] = useState('');
  const [invoiceRef, setInvoiceRef] = useState('');
  const [supplierName, setSupplierName] = useState('');
  const [analysisDate, setAnalysisDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [displayCurrency, setDisplayCurrency] = useState('EUR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Per-section currencies
  const [orderItemsCurrency, setOrderItemsCurrency] = useState('EUR');
  const [invoiceCurrency, setInvoiceCurrency] = useState('EUR');
  const [costCurrency, setCostCurrency] = useState('TRY');

  // Dynamic arrays
  const [orderItems, setOrderItems] = useState<OrderAnalysisOrderItem[]>([
    { id: crypto.randomUUID(), description: '', category: '', quantity: 0, unitPrice: 0, amount: 0 },
  ]);
  const [invoiceBreakdown, setInvoiceBreakdown] = useState<OrderAnalysisInvoiceItem[]>([
    { id: crypto.randomUUID(), product: '', firstPaymentPct: 60, secondPaymentPct: 40, totalRevenue: 0 },
  ]);
  const [costBreakdown, setCostBreakdown] = useState<OrderAnalysisCostItem[]>([
    { id: crypto.randomUUID(), category: 'Fabric', amountTry: 0 },
  ]);

  // Exchange rates
  const [currencies, setCurrencies] = useState<string[]>(FALLBACK_CURRENCIES);
  const [ratesFromEUR, setRatesFromEUR] = useState<Record<string, number>>({});
  const [rateLoading, setRateLoading] = useState(false);

  const fetchRates = useCallback(async () => {
    setRateLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/EUR');
      const data = await res.json();
      if (data.result === 'success' && data.rates) {
        setRatesFromEUR(data.rates);
        setCurrencies(['EUR', ...Object.keys(data.rates).filter(c => c !== 'EUR').sort()]);
      }
    } catch { /* keep fallback */ }
    finally { setRateLoading(false); }
  }, []);

  useEffect(() => { if (open) fetchRates(); }, [open, fetchRates]);

  // Helper: get exchange rate from currencyA to currencyB using EUR base rates
  const getCrossRate = useCallback((from: string, to: string): number => {
    if (from === to) return 1;
    if (Object.keys(ratesFromEUR).length === 0) return 1;
    const fromRate = from === 'EUR' ? 1 : (ratesFromEUR[from] || 1);
    const toRate = to === 'EUR' ? 1 : (ratesFromEUR[to] || 1);
    return toRate / fromRate;
  }, [ratesFromEUR]);

  useEffect(() => {
    if (Object.keys(ratesFromEUR).length === 0 || isView) return;
    if (displayCurrency === 'EUR') { setExchangeRate(1); return; }
    if (ratesFromEUR[displayCurrency]) {
      setExchangeRate(+(ratesFromEUR[displayCurrency]).toFixed(4));
    }
  }, [displayCurrency, ratesFromEUR, isView]);

  // Populate form from existing analysis
  useEffect(() => {
    if (open && existing) {
      setTitle(existing.analysis_title);
      setInvoiceRef(existing.invoice_ref || '');
      setSupplierName(existing.supplier || '');
      setAnalysisDate(existing.analysis_date);
      setDisplayCurrency(existing.display_currency);
      setExchangeRate(existing.exchange_rate);
      setOrderItemsCurrency(existing.order_items_currency || existing.display_currency);
      setInvoiceCurrency(existing.invoice_currency || existing.display_currency);
      setCostCurrency(existing.cost_currency || 'TRY');
      setNotes(existing.notes || '');
      setOrderItems(existing.order_items.length > 0 ? existing.order_items : [
        { id: crypto.randomUUID(), description: '', category: '', quantity: 0, unitPrice: 0, amount: 0 },
      ]);
      setInvoiceBreakdown(existing.invoice_breakdown.length > 0 ? existing.invoice_breakdown : [
        { id: crypto.randomUUID(), product: '', firstPaymentPct: 60, secondPaymentPct: 40, totalRevenue: 0 },
      ]);
      setCostBreakdown(existing.cost_breakdown.length > 0 ? existing.cost_breakdown : [
        { id: crypto.randomUUID(), category: 'Fabric', amountTry: 0 },
      ]);
    } else if (open && !existing) {
      resetForm();
    }
  }, [open, existing]);

  const resetForm = () => {
    setTitle('');
    setInvoiceRef('');
    setSupplierName('');
    setAnalysisDate(format(new Date(), 'yyyy-MM-dd'));
    setDisplayCurrency('EUR');
    setExchangeRate(1);
    setOrderItemsCurrency('EUR');
    setInvoiceCurrency('EUR');
    setCostCurrency('TRY');
    setNotes('');
    setOrderItems([{ id: crypto.randomUUID(), description: '', category: '', quantity: 0, unitPrice: 0, amount: 0 }]);
    setInvoiceBreakdown([{ id: crypto.randomUUID(), product: '', firstPaymentPct: 60, secondPaymentPct: 40, totalRevenue: 0 }]);
    setCostBreakdown([{ id: crypto.randomUUID(), category: 'Fabric', amountTry: 0 }]);
  };

  // ── Calculations ──
  const calculations = useMemo(() => {
    // Cross rates to convert each section to display currency
    const orderToDisplay = getCrossRate(orderItemsCurrency, displayCurrency);
    const invoiceToDisplay = getCrossRate(invoiceCurrency, displayCurrency);
    const costToDisplay = getCrossRate(costCurrency, displayCurrency);

    // Revenue in display currency
    const totalRevenueRaw = orderItems.reduce((s, i) => s + (i.quantity * i.unitPrice), 0);
    const totalRevenue = totalRevenueRaw * orderToDisplay;

    // Costs in their original currency and converted
    const totalCostsOriginal = costBreakdown.reduce((s, i) => s + (i.amountTry || 0), 0);
    const totalCostsDisplay = totalCostsOriginal * costToDisplay;

    const grossProfit = totalRevenue - totalCostsDisplay;
    const marginPct = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;

    // Invoice breakdown converted to display
    const profitSummary: OrderAnalysisProfitItem[] = invoiceBreakdown
      .filter(i => i.product)
      .map(item => {
        const rev = item.totalRevenue * invoiceToDisplay;
        const share = totalRevenue > 0 ? rev / totalRevenue : 0;
        const cost = totalCostsDisplay * share;
        const profit = rev - cost;
        const margin = rev > 0 ? (profit / rev) * 100 : 0;
        return { product: item.product, revenue: rev, costs: cost, grossProfit: profit, marginPct: margin };
      });

    // Auto notes
    const lines: string[] = [];
    const totalQty = orderItems.reduce((s, i) => s + i.quantity, 0);
    const designs = orderItems.filter(i => i.description).length;
    if (totalQty > 0) {
      lines.push(`This analysis covers ${totalQty} total units across ${designs} design${designs !== 1 ? 's' : ''}. Total value: ${fc(totalRevenue)}.`);
    }
    profitSummary.forEach(ps => {
      lines.push(`${ps.product} — revenue ${fc(ps.revenue)}, costs ${fc(ps.costs)}, gross profit ${fc(ps.grossProfit)} (${ps.marginPct.toFixed(2)}% margin).`);
    });
    const sorted = [...costBreakdown].sort((a, b) => (b.amountTry || 0) - (a.amountTry || 0));
    if (sorted.length > 0 && sorted[0].amountTry > 0) {
      const pct = totalCostsOriginal > 0 ? ((sorted[0].amountTry / totalCostsOriginal) * 100).toFixed(1) : '0';
      lines.push(`${sorted[0].category} is the largest cost at ${fcCost(sorted[0].amountTry)} (${fc(sorted[0].amountTry * costToDisplay)}), representing ${pct}% of costs.`);
    }
    if (totalRevenue > 0) {
      lines.push(`Combined gross profit: ${fc(grossProfit)} on ${fc(totalRevenue)} revenue — blended margin of ${marginPct.toFixed(2)}%.`);
    }
    lines.push(`Costs in ${costCurrency} converted at live rates. Direct costs only — customs and overhead not included.`);

    return { totalRevenue, totalRevenueRaw, totalCostsOriginal, totalCostsDisplay, grossProfit, marginPct, profitSummary, autoNotes: lines.join('\n'), orderToDisplay, costToDisplay };
  }, [orderItems, costBreakdown, invoiceBreakdown, displayCurrency, orderItemsCurrency, invoiceCurrency, costCurrency, getCrossRate]);

  function fmtCur(v: number, cur: string): string {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: cur,
        minimumFractionDigits: 2, maximumFractionDigits: 2,
      }).format(v);
    } catch { return `${cur} ${v.toFixed(2)}`; }
  }
  function fc(v: number): string { return fmtCur(v, displayCurrency); }
  function fcOrder(v: number): string { return fmtCur(v, orderItemsCurrency); }
  function fcInvoice(v: number): string { return fmtCur(v, invoiceCurrency); }
  function fcCost(v: number): string { return fmtCur(v, costCurrency); }

  // ── Order Items helpers ──
  const updateOrderItem = (id: string, field: keyof OrderAnalysisOrderItem, value: any) => {
    setOrderItems(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      updated.amount = updated.quantity * updated.unitPrice;
      return updated;
    }));
  };
  const addOrderItem = () => setOrderItems(prev => [...prev, { id: crypto.randomUUID(), description: '', category: '', quantity: 0, unitPrice: 0, amount: 0 }]);
  const removeOrderItem = (id: string) => { if (orderItems.length > 1) setOrderItems(prev => prev.filter(i => i.id !== id)); };

  // ── Invoice Breakdown helpers ──
  const updateInvoiceItem = (id: string, field: keyof OrderAnalysisInvoiceItem, value: any) => {
    setInvoiceBreakdown(prev => prev.map(i => {
      if (i.id !== id) return i;
      const updated = { ...i, [field]: value };
      if (field === 'firstPaymentPct') updated.secondPaymentPct = 100 - (updated.firstPaymentPct || 0);
      return updated;
    }));
  };
  const addInvoiceItem = () => setInvoiceBreakdown(prev => [...prev, { id: crypto.randomUUID(), product: '', firstPaymentPct: 60, secondPaymentPct: 40, totalRevenue: 0 }]);
  const removeInvoiceItem = (id: string) => { if (invoiceBreakdown.length > 1) setInvoiceBreakdown(prev => prev.filter(i => i.id !== id)); };

  // ── Cost Breakdown helpers ──
  const updateCostItem = (id: string, field: keyof OrderAnalysisCostItem, value: any) => {
    setCostBreakdown(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  };
  const addCostItem = () => setCostBreakdown(prev => [...prev, { id: crypto.randomUUID(), category: 'Other', amountTry: 0 }]);
  const removeCostItem = (id: string) => { if (costBreakdown.length > 1) setCostBreakdown(prev => prev.filter(i => i.id !== id)); };

  // ── Save ──
  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: 'Missing title', description: 'Please enter an analysis title.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        client_id: clientId,
        analysis_title: title.trim(),
        invoice_ref: invoiceRef || null,
        supplier: supplierName || null,
        exchange_rate: exchangeRate,
        display_currency: displayCurrency,
        order_items_currency: orderItemsCurrency,
        invoice_currency: invoiceCurrency,
        cost_currency: costCurrency,
        analysis_date: analysisDate,
        notes: notes || null,
        order_items: orderItems.map(i => ({ ...i, amount: i.quantity * i.unitPrice })),
        invoice_breakdown: invoiceBreakdown,
        cost_breakdown: costBreakdown,
        profit_summary: calculations.profitSummary,
        total_revenue: calculations.totalRevenue,
        total_costs: calculations.totalCostsDisplay,
        total_profit: calculations.grossProfit,
        margin_pct: calculations.marginPct,
        auto_notes: calculations.autoNotes,
        created_by: user?.id,
      };

      if (existing) {
        const { error } = await (supabase.from('order_analyses' as any) as any)
          .update(payload).eq('id', existing.id);
        if (error) throw error;
        toast({ title: 'Updated', description: 'Analysis updated successfully.' });
      } else {
        const { error } = await (supabase.from('order_analyses' as any) as any).insert(payload);
        if (error) throw error;
        toast({ title: 'Saved', description: 'Analysis saved successfully.' });
      }

      onOpenChange(false);
      onSaved?.();
    } catch (err: any) {
      console.error('Error saving analysis:', err);
      toast({ title: 'Error', description: err.message || 'Failed to save analysis.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Print ──
  const handlePrint = () => {
    const data: OrderAnalysis = {
      id: existing?.id || '',
      client_id: clientId,
      analysis_title: title,
      invoice_ref: invoiceRef || null,
      supplier: supplierName || null,
      exchange_rate: exchangeRate,
      display_currency: displayCurrency,
      order_items_currency: orderItemsCurrency,
      invoice_currency: invoiceCurrency,
      cost_currency: costCurrency,
      analysis_date: analysisDate,
      notes: notes || null,
      order_items: orderItems.map(i => ({ ...i, amount: i.quantity * i.unitPrice })),
      invoice_breakdown: invoiceBreakdown,
      cost_breakdown: costBreakdown,
      profit_summary: calculations.profitSummary,
      total_revenue: calculations.totalRevenue,
      total_costs: calculations.totalCostsDisplay,
      total_profit: calculations.grossProfit,
      margin_pct: calculations.marginPct,
      auto_notes: calculations.autoNotes,
      created_by: null,
      created_at: '',
      updated_at: '',
    };
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(generateOrderAnalysisPrintHTML({ analysis: data, clientName }));
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[900px] h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            {existing ? 'Order Analysis' : 'New Order Analysis'}
          </DialogTitle>
          <DialogDescription>
            {existing ? `${existing.analysis_title} — ${clientName}` : `Create an order analysis for ${clientName}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto pr-2">
          <div className="space-y-6 py-4">

            {/* ── Section 1: Details ── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Analysis Title *</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Invoice #254 Analysis" disabled={isView} />
                  </div>
                  <div className="space-y-2">
                    <Label>Invoice Reference</Label>
                    <Input value={invoiceRef} onChange={e => setInvoiceRef(e.target.value)} placeholder="e.g. Invoice #254" disabled={isView} />
                  </div>
                  <div className="space-y-2">
                    <Label>Supplier</Label>
                    <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="Supplier name" disabled={isView} />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={analysisDate} onChange={e => setAnalysisDate(e.target.value)} disabled={isView} />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Display Currency</Label>
                      {!isView && (
                        <button type="button" onClick={fetchRates} disabled={rateLoading} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                          <RefreshCw className={`h-3 w-3 ${rateLoading ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                    </div>
                    <Select value={displayCurrency} onValueChange={setDisplayCurrency} disabled={isView}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[260px]">
                        {currencies.map(c => <SelectItem key={c} value={c}>{getCurrencyLabel(c)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Exchange Rate (1 {displayCurrency} = ? TRY)</Label>
                    <Input type="number" step="0.0001" value={exchangeRate} onChange={e => setExchangeRate(Number(e.target.value))} disabled={isView} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ── Section 2: Order Items (Revenue) ── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-base font-semibold">Order Items (Revenue)</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Currency:</Label>
                    <Select value={orderItemsCurrency} onValueChange={setOrderItemsCurrency} disabled={isView}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[260px]">
                        {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!isView && (
                      <Button type="button" variant="outline" size="sm" onClick={addOrderItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add Item
                      </Button>
                    )}
                  </div>
                </div>
                {orderItems.map(item => (
                  <div key={item.id} className="p-3 border rounded-lg space-y-3 bg-muted/20">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Description</Label>
                        <Input value={item.description} onChange={e => updateOrderItem(item.id, 'description', e.target.value)} placeholder="Product name" disabled={isView} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Category</Label>
                        <Input value={item.category} onChange={e => updateOrderItem(item.id, 'category', e.target.value)} placeholder="e.g. Longsleeve" disabled={isView} />
                      </div>
                      <div className="col-span-1 space-y-1">
                        <Label className="text-xs">QTY</Label>
                        <Input type="number" min="0" value={item.quantity || ''} onChange={e => updateOrderItem(item.id, 'quantity', parseInt(e.target.value) || 0)} disabled={isView} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Unit Price ({orderItemsCurrency})</Label>
                        <Input type="number" step="0.01" min="0" value={item.unitPrice || ''} onChange={e => updateOrderItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)} disabled={isView} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center font-medium text-sm">
                          {fcOrder(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                      {!isView && orderItems.length > 1 && (
                        <div className="col-span-1 flex justify-center">
                          <Button variant="ghost" size="icon" onClick={() => removeOrderItem(item.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                <div className="flex justify-end text-sm font-semibold">
                  Total Revenue: {fcOrder(calculations.totalRevenueRaw)}
                  {orderItemsCurrency !== displayCurrency && <span className="text-muted-foreground font-normal ml-2">({fc(calculations.totalRevenue)})</span>}
                </div>
              </CardContent>
            </Card>

            {/* ── Section 3: Invoice Breakdown ── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-base font-semibold">Invoice Breakdown</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Currency:</Label>
                    <Select value={invoiceCurrency} onValueChange={setInvoiceCurrency} disabled={isView}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[260px]">
                        {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!isView && (
                      <Button type="button" variant="outline" size="sm" onClick={addInvoiceItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add Product
                      </Button>
                    )}
                  </div>
                </div>
                {invoiceBreakdown.map(item => (
                  <div key={item.id} className="p-3 border rounded-lg bg-muted/20">
                    <div className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-4 space-y-1">
                        <Label className="text-xs">Product</Label>
                        <Input value={item.product} onChange={e => updateInvoiceItem(item.id, 'product', e.target.value)} placeholder="Product name" disabled={isView} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">1st Payment %</Label>
                        <Input type="number" min="0" max="100" value={item.firstPaymentPct || ''} onChange={e => updateInvoiceItem(item.id, 'firstPaymentPct', parseInt(e.target.value) || 0)} disabled={isView} />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <Label className="text-xs">2nd Payment %</Label>
                        <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center text-sm">
                          {item.secondPaymentPct}%
                        </div>
                      </div>
                      <div className="col-span-3 space-y-1">
                        <Label className="text-xs">Total Revenue ({invoiceCurrency})</Label>
                        <Input type="number" step="0.01" min="0" value={item.totalRevenue || ''} onChange={e => updateInvoiceItem(item.id, 'totalRevenue', parseFloat(e.target.value) || 0)} disabled={isView} />
                      </div>
                      {!isView && invoiceBreakdown.length > 1 && (
                        <div className="col-span-1 flex justify-center">
                          <Button variant="ghost" size="icon" onClick={() => removeInvoiceItem(item.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* ── Section 4: Cost Breakdown ── */}
            <Card>
              <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <Label className="text-base font-semibold">Cost Breakdown</Label>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground whitespace-nowrap">Currency:</Label>
                    <Select value={costCurrency} onValueChange={setCostCurrency} disabled={isView}>
                      <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-[260px]">
                        {currencies.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {!isView && (
                      <Button type="button" variant="outline" size="sm" onClick={addCostItem}>
                        <Plus className="h-4 w-4 mr-1" /> Add Cost
                      </Button>
                    )}
                  </div>
                </div>
                {costBreakdown.map(item => {
                  const converted = (item.amountTry || 0) * calculations.costToDisplay;
                  const pctCosts = calculations.totalCostsOriginal > 0 ? ((item.amountTry || 0) / calculations.totalCostsOriginal * 100) : 0;
                  const pctRevenue = calculations.totalRevenue > 0 ? (converted / calculations.totalRevenue * 100) : 0;
                  return (
                    <div key={item.id} className="p-3 border rounded-lg bg-muted/20">
                      <div className="grid grid-cols-12 gap-3 items-end">
                        <div className="col-span-3 space-y-1">
                          <Label className="text-xs">Category</Label>
                          {isView ? (
                            <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center text-sm">{item.category}</div>
                          ) : (
                            <Select value={item.category} onValueChange={v => updateCostItem(item.id, 'category', v)}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {COST_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          )}
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Amount ({costCurrency})</Label>
                          <Input type="number" step="0.01" min="0" value={item.amountTry || ''} onChange={e => updateCostItem(item.id, 'amountTry', parseFloat(e.target.value) || 0)} disabled={isView} />
                        </div>
                        {costCurrency !== displayCurrency && (
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">Amount ({displayCurrency})</Label>
                          <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center font-medium text-sm">
                            {fc(converted)}
                          </div>
                        </div>
                        )}
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">% of Costs</Label>
                          <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center text-sm">
                            {pctCosts.toFixed(1)}%
                          </div>
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">% of Revenue</Label>
                          <div className="h-10 px-3 py-2 rounded-md border bg-muted flex items-center text-sm">
                            {pctRevenue.toFixed(1)}%
                          </div>
                        </div>
                        {!isView && costBreakdown.length > 1 && (
                          <div className="col-span-1 flex justify-center">
                            <Button variant="ghost" size="icon" onClick={() => removeCostItem(item.id)} className="text-destructive hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div className="flex justify-end text-sm font-semibold">
                  Total Costs: {fcCost(calculations.totalCostsOriginal)}
                  {costCurrency !== displayCurrency && <span className="text-muted-foreground font-normal ml-2">({fc(calculations.totalCostsDisplay)})</span>}
                </div>
              </CardContent>
            </Card>

            {/* ── Section 5: Notes ── */}
            <Card>
              <CardContent className="pt-6 space-y-2">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes..." rows={3} disabled={isView} />
              </CardContent>
            </Card>

            {/* ── Section 6: Live Summary ── */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Revenue</p>
                  <p className="text-2xl font-bold mt-1">{fc(calculations.totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground">All Products</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Costs</p>
                  <p className="text-2xl font-bold mt-1">{fc(calculations.totalCostsDisplay)}</p>
                  <p className="text-xs text-muted-foreground">Materials + Production</p>
                </CardContent>
              </Card>
              <Card className={calculations.grossProfit >= 0 ? 'border-green-500/50' : 'border-red-500/50'}>
                <CardContent className="pt-6 text-center">
                  <p className="text-xs text-muted-foreground uppercase font-semibold">Total Profit</p>
                  <p className={`text-2xl font-bold mt-1 ${calculations.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {fc(calculations.grossProfit)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Blended Margin: {calculations.marginPct.toFixed(2)}%
                  </p>
                </CardContent>
              </Card>
            </div>

          </div>
        </div>

        <DialogFooter className="mt-4 gap-2">
          {isView ? (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Print Report
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" /> Print
              </Button>
              <Button onClick={handleSave} disabled={isSaving}>
                {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Analysis
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
