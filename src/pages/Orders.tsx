import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Package, Calendar, ArrowUpDown } from 'lucide-react';
import { PRODUCTION_STAGES, PRIORITY_CONFIG, type Order, type ProductionStage, type OrderPriority } from '@/lib/types';
import { format } from 'date-fns';

export default function Orders() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && role) {
      fetchOrders();
    }
  }, [user, role]);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, client:clients(id, name, brand_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load orders.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStageConfig = (stage: ProductionStage) => {
    return PRODUCTION_STAGES.find(s => s.value === stage) || PRODUCTION_STAGES[0];
  };

  const getPriorityConfig = (priority: OrderPriority) => {
    return PRIORITY_CONFIG.find(p => p.value === priority) || PRIORITY_CONFIG[1];
  };

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.product_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      order.order_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.client as any)?.name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStage = stageFilter === 'all' || order.current_stage === stageFilter;
    const matchesPriority = priorityFilter === 'all' || order.priority === priorityFilter;

    return matchesSearch && matchesStage && matchesPriority;
  });

  if (authLoading || !user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
            <p className="text-muted-foreground">
              Track and manage production orders
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

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by stage" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Stages</SelectItem>
              {PRODUCTION_STAGES.map((stage) => (
                <SelectItem key={stage.value} value={stage.value}>
                  {stage.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {PRIORITY_CONFIG.map((priority) => (
                <SelectItem key={priority.value} value={priority.value}>
                  {priority.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Orders Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                {searchQuery || stageFilter !== 'all' || priorityFilter !== 'all'
                  ? 'No orders match your filters'
                  : 'No orders yet'}
              </p>
              {role === 'admin' && !searchQuery && stageFilter === 'all' && priorityFilter === 'all' && (
                <Button className="mt-4" asChild>
                  <Link to="/orders/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Order
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredOrders.map((order) => {
              const stageConfig = getStageConfig(order.current_stage);
              const priorityConfig = getPriorityConfig(order.priority);
              const isOverdue = order.delivery_date && new Date(order.delivery_date) < new Date() && order.current_stage !== 'delivered';

              return (
                <Card
                  key={order.id}
                  className={`cursor-pointer transition-all hover:shadow-lg hover:border-primary/50 ${isOverdue ? 'border-destructive' : ''}`}
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate">
                          {order.product_name}
                        </CardTitle>
                        <CardDescription className="truncate">
                          {order.order_number}
                        </CardDescription>
                      </div>
                      <Badge
                        variant="secondary"
                        className={priorityConfig.color + ' text-white text-xs'}
                      >
                        {priorityConfig.label}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-sm text-muted-foreground">
                      {(order.client as any)?.brand_name || (order.client as any)?.name || 'No client'}
                    </div>

                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className={stageConfig.color + ' text-white'}>
                        {stageConfig.label}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        Qty: {order.quantity}
                      </span>
                    </div>

                    {order.delivery_date && (
                      <div className={`flex items-center gap-2 text-sm ${isOverdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                        <Calendar className="h-4 w-4" />
                        <span>
                          {isOverdue ? 'Overdue: ' : 'Due: '}
                          {format(new Date(order.delivery_date), 'MMM d, yyyy')}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
