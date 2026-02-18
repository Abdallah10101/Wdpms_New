import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, ArrowLeft, Clock } from 'lucide-react';
import { differenceInDays, format } from 'date-fns';

interface OverdueOrder {
  id: string;
  order_number: string;
  product_name: string;
  client_id: string;
  delivery_date: string;
  current_stage: string;
  priority: string;
  supplier: string | null;
  quantity: number;
  collection: string | null;
  client?: { name: string; brand_name?: string | null };
}

const STAGE_LABELS: Record<string, string> = {
  not_started: 'Not Started',
  sample: 'Sample',
  cutting: 'Cutting',
  printing: 'Printing',
  embroidery: 'Embroidery',
  sewing: 'Sewing',
  wash_house: 'Wash House',
  qc: 'QC',
  packaging: 'Packaging',
  shipping: 'Shipping',
  delivered: 'Delivered',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 border-slate-200',
  medium: 'bg-blue-50 text-blue-700 border-blue-200',
  high: 'bg-orange-50 text-orange-700 border-orange-200',
  urgent: 'bg-red-50 text-red-700 border-red-200',
};

export default function OverdueOrders() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<OverdueOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && role === 'client') navigate('/portal');
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role) fetchOverdueOrders();
  }, [user, role]);

  const fetchOverdueOrders = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number, product_name, client_id, delivery_date, current_stage, priority, supplier, quantity, collection, clients(name, brand_name)')
        .lt('delivery_date', today)
        .neq('current_stage', 'delivered')
        .not('delivery_date', 'is', null)
        .order('delivery_date', { ascending: true });

      if (error) throw error;

      const mapped = (data || []).map((o: any) => ({
        ...o,
        client: o.clients,
      }));
      setOrders(mapped);
    } catch (err) {
      console.error('Error fetching overdue orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const daysOverdue = (deliveryDate: string) =>
    differenceInDays(new Date(), new Date(deliveryDate));

  const clientName = (order: OverdueOrder) =>
    order.client?.brand_name || order.client?.name || '—';

  const orderType = (order: OverdueOrder) =>
    order.supplier === 'sample' ? 'Sample' : 'Bulk';

  if (authLoading || !user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/dashboard">
                <ArrowLeft className="h-4 w-4" />
              </Link>
            </Button>
            <div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
                <AlertTriangle className="h-6 w-6 text-destructive" />
                Overdue Orders
              </h1>
              <p className="text-muted-foreground">
                {isLoading ? '—' : `${orders.length} order${orders.length !== 1 ? 's' : ''} past their delivery date`}
              </p>
            </div>
          </div>
        </div>

        {/* Table Card */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">All Overdue Orders</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : orders.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <Clock className="h-10 w-10 opacity-30" />
                <p className="font-medium">No overdue orders</p>
                <p className="text-sm">All orders are on track.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-3">Order #</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Due Date</th>
                      <th className="px-4 py-3">Days Overdue</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3">Priority</th>
                      <th className="px-4 py-3">Qty</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map((order) => {
                      const days = daysOverdue(order.delivery_date);
                      return (
                        <tr
                          key={order.id}
                          className="transition-colors hover:bg-muted/30"
                        >
                          <td className="px-4 py-3 font-mono font-medium">
                            {order.order_number}
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-medium">{order.product_name}</div>
                            {order.collection && (
                              <div className="text-xs text-muted-foreground">{order.collection}</div>
                            )}
                          </td>
                          <td className="px-4 py-3">{clientName(order)}</td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className="text-xs">
                              {orderType(order)}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {format(new Date(order.delivery_date), 'dd MMM yyyy')}
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-1 font-semibold text-destructive">
                              <AlertTriangle className="h-3 w-3" />
                              {days}d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary" className="text-xs">
                              {STAGE_LABELS[order.current_stage] || order.current_stage}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${PRIORITY_COLORS[order.priority] || ''}`}
                            >
                              {order.priority}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{order.quantity}</td>
                          <td className="px-4 py-3">
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/orders/${order.id}`}>View</Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
