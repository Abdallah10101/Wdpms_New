import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Invoice, InvoiceViewer, InvoiceStatus } from '@/components/invoices/InvoiceViewer';
import { CreateInvoiceDialog } from '@/components/invoices/CreateInvoiceDialog';
import {
  FileText,
  Search,
  MoreHorizontal,
  Eye,
  Send,
  CheckCircle,
  AlertCircle,
  Plus,
  Download,
  DollarSign,
  RefreshCw,
} from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';

const FALLBACK_CURRENCIES = ['EUR', 'USD', 'GBP', 'TRY', 'AED', 'SAR', 'JPY', 'CNY'];

const getCurrencyLabel = (code: string): string => {
  try {
    const symbol = new Intl.NumberFormat('en-US', { style: 'currency', currency: code })
      .formatToParts(0).find((p) => p.type === 'currency')?.value ?? code;
    return symbol === code ? code : `${symbol} ${code}`;
  } catch {
    return code;
  }
};

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

export default function Invoices() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<Invoice | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Currency
  const [displayCurrency, setDisplayCurrency] = useState('EUR');
  const [exchangeRate, setExchangeRate] = useState(1);
  const [currencies, setCurrencies] = useState<string[]>(FALLBACK_CURRENCIES);
  const [ratesFromEUR, setRatesFromEUR] = useState<Record<string, number>>({});
  const [rateLoading, setRateLoading] = useState(false);
  const [rateLastUpdated, setRateLastUpdated] = useState<string | null>(null);

  const fetchRates = useCallback(async () => {
    setRateLoading(true);
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/EUR');
      const data = await res.json();
      if (data.result === 'success' && data.rates) {
        setRatesFromEUR(data.rates);
        setCurrencies(['EUR', ...Object.keys(data.rates).filter((c) => c !== 'EUR').sort()]);
        setRateLastUpdated(new Date().toLocaleTimeString());
      }
    } catch {
      // keep fallback
    } finally {
      setRateLoading(false);
    }
  }, []);

  useEffect(() => { fetchRates(); }, [fetchRates]);

  useEffect(() => {
    if (Object.keys(ratesFromEUR).length === 0) return;
    if (displayCurrency === 'EUR') { setExchangeRate(1); return; }
    if (ratesFromEUR[displayCurrency]) {
      setExchangeRate(+(ratesFromEUR[displayCurrency]).toFixed(4));
    }
  }, [displayCurrency, ratesFromEUR]);

  const formatAmount = (value: number): string => {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${displayCurrency} ${value.toFixed(2)}`;
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role === 'client') {
      navigate('/portal');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client') {
      fetchInvoices();
    }
  }, [user, role]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          client:clients(name, brand_name, address),
          order:orders(order_number, product_name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices((data || []) as unknown as Invoice[]);
    } catch (error) {
      console.error('Error fetching invoices:', error);
      toast({
        title: 'Error',
        description: 'Failed to load invoices.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateStatus = async (invoiceId: string, newStatus: InvoiceStatus) => {
    try {
      const updates: Record<string, any> = { status: newStatus };
      
      if (newStatus === 'sent' && !invoices.find(i => i.id === invoiceId)?.sent_at) {
        updates.sent_at = new Date().toISOString();
      }
      if (newStatus === 'paid') {
        updates.paid_at = new Date().toISOString();
        const invoice = invoices.find(i => i.id === invoiceId);
        if (invoice) {
          updates.amount_paid = invoice.wholesale_price * invoice.quantity;
        }
      }

      const { error } = await supabase
        .from('invoices')
        .update(updates)
        .eq('id', invoiceId);

      if (error) throw error;

      toast({
        title: 'Status Updated',
        description: `Invoice marked as ${STATUS_LABELS[newStatus]}.`,
      });

      fetchInvoices();
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update invoice status.',
        variant: 'destructive',
      });
    }
  };

  const handleRecordPayment = async () => {
    if (!paymentInvoice || !paymentAmount) return;
    setIsSubmittingPayment(true);
    try {
      const totalAmount = paymentInvoice.wholesale_price * paymentInvoice.quantity;
      const paid = parseFloat(paymentAmount);
      if (isNaN(paid) || paid <= 0) {
        toast({ title: 'Invalid Amount', description: 'Please enter a valid payment amount.', variant: 'destructive' });
        return;
      }
      const newStatus: InvoiceStatus = paid >= totalAmount ? 'paid' : 'partially_paid';
      const { error } = await supabase
        .from('invoices')
        .update({
          amount_paid: paid,
          status: newStatus,
          ...(newStatus === 'paid' ? { paid_at: new Date().toISOString() } : {}),
        })
        .eq('id', paymentInvoice.id);

      if (error) throw error;
      toast({ title: 'Payment Recorded', description: `${formatAmount(paid)} recorded.` });
      setPaymentDialogOpen(false);
      setPaymentInvoice(null);
      setPaymentAmount('');
      fetchInvoices();
    } catch (error) {
      console.error('Error recording payment:', error);
      toast({ title: 'Error', description: 'Failed to record payment.', variant: 'destructive' });
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  const exportCSV = () => {
    const headers = ['Invoice #', 'Client', 'Order', 'Amount', 'Status', 'Date'];
    const rows = filteredInvoices.map(inv => [
      inv.invoice_number,
      inv.client?.brand_name || inv.client?.name || '',
      inv.order?.order_number || '',
      (inv.wholesale_price * inv.quantity).toString(),
      STATUS_LABELS[inv.status],
      format(new Date(inv.created_at), 'yyyy-MM-dd'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'invoices.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = 
      invoice.invoice_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.order_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      invoice.client?.brand_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: invoices.length,
    draft: invoices.filter(i => i.status === 'draft').length,
    sent: invoices.filter(i => i.status === 'sent' || i.status === 'viewed').length,
    paid: invoices.filter(i => i.status === 'paid').length,
    overdue: invoices.filter(i => i.status === 'overdue').length,
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Invoices</h1>
            <p className="text-muted-foreground">Manage your invoices and billing</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Invoice
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <FileText className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Send className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.sent}</p>
                  <p className="text-sm text-muted-foreground">Sent</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.paid}</p>
                  <p className="text-sm text-muted-foreground">Paid</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-center">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search invoices..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="viewed">Viewed</SelectItem>
              <SelectItem value="partially_paid">Partially Paid</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="overdue">Overdue</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">Display Currency</span>
                <button
                  type="button"
                  onClick={fetchRates}
                  disabled={rateLoading}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  title="Refresh live rates"
                >
                  <RefreshCw className={`h-3 w-3 ${rateLoading ? 'animate-spin' : ''}`} />
                  {rateLastUpdated ? `Updated ${rateLastUpdated}` : 'Live rates'}
                </button>
              </div>
              <Select value={displayCurrency} onValueChange={setDisplayCurrency}>
                <SelectTrigger className="w-36 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[260px]">
                  {currencies.map((c) => (
                    <SelectItem key={c} value={c}>{getCurrencyLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Invoice Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredInvoices.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      No invoices found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredInvoices.map((invoice) => (
                    <TableRow
                      key={invoice.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setViewerOpen(true);
                      }}
                    >
                      <TableCell>
                        <span className="font-mono font-medium">{invoice.invoice_number}</span>
                      </TableCell>
                      <TableCell>
                        {invoice.client?.brand_name || invoice.client?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <div>
                          <span className="font-mono text-sm">{invoice.order?.order_number || 'N/A'}</span>
                          <p className="text-sm text-muted-foreground">{invoice.order_name}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold">
                          {formatAmount(invoice.wholesale_price * invoice.quantity)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Badge className={STATUS_COLORS[invoice.status]}>
                          {STATUS_LABELS[invoice.status]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => {
                              e.stopPropagation();
                              setSelectedInvoice(invoice);
                              setViewerOpen(true);
                            }}>
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </DropdownMenuItem>
                            {invoice.status === 'draft' && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(invoice.id, 'sent');
                              }}>
                                <Send className="mr-2 h-4 w-4" />
                                Mark as Sent
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'partially_paid') && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                updateStatus(invoice.id, 'paid');
                              }}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Mark as Paid
                              </DropdownMenuItem>
                            )}
                            {(invoice.status === 'sent' || invoice.status === 'viewed' || invoice.status === 'partially_paid') && (
                              <DropdownMenuItem onClick={(e) => {
                                e.stopPropagation();
                                setPaymentInvoice(invoice);
                                setPaymentAmount(String(invoice.amount_paid || ''));
                                setPaymentDialogOpen(true);
                              }}>
                                <DollarSign className="mr-2 h-4 w-4" />
                                Record Payment
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Viewer Dialog */}
      <InvoiceViewer
        invoice={selectedInvoice}
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        isClientView={false}
        currency={displayCurrency}
      />

      {/* Create Invoice Dialog */}
      <CreateInvoiceDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={fetchInvoices}
        currency={displayCurrency}
        exchangeRate={exchangeRate}
      />

      {/* Record Payment Dialog */}
      <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
            <DialogDescription>
              {paymentInvoice && (
                <>Invoice {paymentInvoice.invoice_number} — Total: {formatAmount(paymentInvoice.wholesale_price * paymentInvoice.quantity)}</>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Amount Paid ({displayCurrency})</Label>
              <Input
                type="number"
                placeholder="0.00"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                min="0"
                step="0.01"
              />
              {paymentInvoice && paymentAmount && (
                <p className="text-xs text-muted-foreground">
                  {parseFloat(paymentAmount) >= paymentInvoice.wholesale_price * paymentInvoice.quantity
                    ? 'Will mark as Paid'
                    : 'Will mark as Partially Paid'}
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleRecordPayment} disabled={isSubmittingPayment}>
              {isSubmittingPayment ? 'Saving...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
