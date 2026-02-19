import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend,
} from 'recharts';
import { PRODUCTION_STAGES } from '@/lib/types';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { BarChart3 } from 'lucide-react';

export default function Analytics() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);

  const [ordersByStage, setOrdersByStage] = useState<{ stage: string; count: number; color: string }[]>([]);
  const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; revenue: number }[]>([]);
  const [topClients, setTopClients] = useState<{ name: string; orders: number }[]>([]);
  const [leadConversion, setLeadConversion] = useState<{ name: string; value: number }[]>([]);
  const [onTimeRate, setOnTimeRate] = useState<number>(0);

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && (role === 'client' || role === 'team')) navigate('/dashboard');
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role === 'admin') {
      fetchAnalyticsData();
    }
  }, [user, role]);

  const fetchAnalyticsData = async () => {
    try {
      // Orders by stage
      const { data: orders } = await supabase.from('orders').select('current_stage, delivery_date, client_id, client:clients(name, brand_name)');

      if (orders) {
        const stageCounts = PRODUCTION_STAGES.filter(s => s.value !== 'not_started').map(stage => ({
          stage: stage.label,
          count: orders.filter(o => o.current_stage === stage.value).length,
          color: stage.color.replace('bg-', ''),
        })).filter(s => s.count > 0);
        setOrdersByStage(stageCounts);

        // On-time rate (delivered before or on due date)
        const deliveredOrders = orders.filter(o => o.current_stage === 'delivered' && o.delivery_date);
        const today = new Date().toISOString().split('T')[0];
        const onTime = deliveredOrders.filter(o => o.delivery_date! >= today).length;
        setOnTimeRate(deliveredOrders.length > 0 ? Math.round((onTime / deliveredOrders.length) * 100) : 0);

        // Top clients by order count
        const clientCounts: Record<string, { name: string; count: number }> = {};
        orders.forEach(o => {
          if (o.client_id && o.client) {
            const clientName = (o.client as any)?.brand_name || (o.client as any)?.name || 'Unknown';
            if (!clientCounts[o.client_id]) clientCounts[o.client_id] = { name: clientName, count: 0 };
            clientCounts[o.client_id].count++;
          }
        });
        const sortedClients = Object.values(clientCounts)
          .sort((a, b) => b.count - a.count)
          .slice(0, 8)
          .map(c => ({ name: c.name, orders: c.count }));
        setTopClients(sortedClients);
      }

      // Revenue by month (last 6 months)
      const months = Array.from({ length: 6 }, (_, i) => subMonths(new Date(), i)).reverse();
      const monthlyRevenue = await Promise.all(months.map(async (month) => {
        const start = startOfMonth(month).toISOString();
        const end = endOfMonth(month).toISOString();
        const { data: invoices } = await supabase
          .from('invoices')
          .select('wholesale_price, quantity')
          .gte('created_at', start)
          .lte('created_at', end)
          .in('status', ['paid', 'partially_paid']);
        const total = (invoices || []).reduce((sum, inv) => sum + inv.wholesale_price * inv.quantity, 0);
        return { month: format(month, 'MMM'), revenue: total };
      }));
      setRevenueByMonth(monthlyRevenue);

      // Lead conversion funnel
      const { data: leads } = await (supabase.from('leads' as any) as any).select('status');
      if (leads) {
        const statuses = ['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won'];
        const funnel = statuses.map(s => ({
          name: s.charAt(0).toUpperCase() + s.slice(1),
          value: (leads as any[]).filter(l => l.status === s).length,
        }));
        setLeadConversion(funnel);
      }

    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const CHART_COLORS = ['#e8560c', '#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899'];

  if (authLoading || !user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BarChart3 className="h-6 w-6" />
            Analytics
          </h1>
          <p className="text-muted-foreground">Production metrics and business insights</p>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : (
          <>
            {/* KPI row */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">On-Time Delivery Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{onTimeRate}%</div>
                  <p className="text-xs text-muted-foreground mt-1">Of delivered orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue (6mo)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">
                    ₺{revenueByMonth.reduce((s, m) => s + m.revenue, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">From paid invoices</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Lead Win Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">
                    {leadConversion.reduce((s, l) => s + l.value, 0) > 0
                      ? Math.round(((leadConversion.find(l => l.name === 'Won')?.value || 0) / leadConversion.reduce((s, l) => s + l.value, 0)) * 100)
                      : 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Leads converted to clients</p>
                </CardContent>
              </Card>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              {/* Revenue over time */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Revenue (Last 6 Months)</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={revenueByMonth}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `₺${(v / 1000).toFixed(0)}k`} />
                      <Tooltip formatter={(v: number) => [`₺${v.toLocaleString()}`, 'Revenue']} />
                      <Line type="monotone" dataKey="revenue" stroke="#e8560c" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Orders by stage */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Orders by Stage</CardTitle>
                </CardHeader>
                <CardContent>
                  {ordersByStage.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No active orders</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={ordersByStage} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis type="number" tick={{ fontSize: 12 }} />
                        <YAxis dataKey="stage" type="category" tick={{ fontSize: 11 }} width={80} />
                        <Tooltip />
                        <Bar dataKey="count" fill="#e8560c" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Top Clients */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Top Clients by Order Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  {topClients.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No data yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={topClients}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="orders" radius={[4, 4, 0, 0]}>
                          {topClients.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Lead Conversion Funnel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lead Pipeline</CardTitle>
                </CardHeader>
                <CardContent>
                  {leadConversion.every(l => l.value === 0) ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No leads yet</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={leadConversion}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 12 }} />
                        <Tooltip />
                        <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                          {leadConversion.map((_, index) => (
                            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
