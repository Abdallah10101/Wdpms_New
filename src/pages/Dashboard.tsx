import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import {
  Package,
  Users,
  Beaker,
  Boxes,
  Truck,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import { DualOverviewKanban } from '@/components/dashboard/DualOverviewKanban';

interface DashboardStats {
  totalOrders: number;
  shipped: number;
  totalClients: number;
  overdueOrders: number;
  sampleCount: number;
  bulkCount: number;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    // Redirect clients to their dedicated portal
    if (!authLoading && role === 'client') {
      navigate('/portal');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role) {
      fetchDashboardData();
    }
  }, [user, role]);

  const fetchDashboardData = async () => {
    try {
      // Get all orders for stats
      const { data: allOrders } = await supabase
        .from('orders')
        .select('current_stage, delivery_date, supplier');

      // Fetch clients count (admin only)
      let clientsCount = 0;
      if (role === 'admin') {
        const { count } = await supabase
          .from('clients')
          .select('*', { count: 'exact', head: true });
        clientsCount = count || 0;
      }

      // Calculate stats
      const today = new Date().toISOString().split('T')[0];
      
      const calculatedStats: DashboardStats = {
        totalOrders: allOrders?.length || 0,
        shipped: allOrders?.filter(o => ['shipping', 'delivered'].includes(o.current_stage)).length || 0,
        totalClients: clientsCount,
        overdueOrders: allOrders?.filter(o => o.delivery_date && o.delivery_date < today && o.current_stage !== 'delivered').length || 0,
        sampleCount: allOrders?.filter(o => o.supplier === 'sample').length || 0,
        bulkCount: allOrders?.filter(o => 
          o.supplier !== 'sample' && 
          o.current_stage !== 'not_started' && 
          o.current_stage !== 'sample'
        ).length || 0,
      };

      setStats(calculatedStats);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back! Here's your production overview.
            </p>
          </div>
          {role === 'admin' && (
            <Button asChild>
              <Link to="/orders/new">
                <Plus className="mr-2 h-4 w-4" />
                New Order
              </Link>
            </Button>
          )}
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.totalOrders || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Bulk</CardTitle>
              <Boxes className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-blue-600">{stats?.bulkCount || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Samples</CardTitle>
              <Beaker className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold text-purple-600">{stats?.sampleCount || 0}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Shipped</CardTitle>
              <Truck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : (
                <div className="text-2xl font-bold">{stats?.shipped || 0}</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Secondary Stats */}
        {role === 'admin' && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Clients</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className="text-2xl font-bold">{stats?.totalClients || 0}</div>
                )}
              </CardContent>
            </Card>

            <Card className={stats?.overdueOrders ? 'border-destructive' : ''}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Overdue Orders</CardTitle>
                <AlertTriangle className={`h-4 w-4 ${stats?.overdueOrders ? 'text-destructive' : 'text-muted-foreground'}`} />
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-8 w-20" />
                ) : (
                  <div className={`text-2xl font-bold ${stats?.overdueOrders ? 'text-destructive' : ''}`}>
                    {stats?.overdueOrders || 0}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Dual Overview Kanbans (Bulk & Samples) */}
        <DualOverviewKanban />
      </div>
    </DashboardLayout>
  );
}
