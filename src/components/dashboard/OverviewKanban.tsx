import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, LayoutGrid, List, Plus } from 'lucide-react';
import { PRODUCTION_STAGES, type ProductionStage, type Order } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';

interface OverviewKanbanProps {
  onOrdersLoaded?: (count: number) => void;
}

export function OverviewKanban({ onOrdersLoaded }: OverviewKanbanProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [availableMonths, setAvailableMonths] = useState<{ value: string; label: string; count: number }[]>([]);
  const [viewMode, setViewMode] = useState<'board' | 'list'>('board');

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*, client:clients(name, brand_name)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const ordersData = (data || []) as Order[];
      setOrders(ordersData);
      onOrdersLoaded?.(ordersData.length);

      // Build available months
      const monthsMap = new Map<string, { date: Date; count: number }>();
      ordersData.forEach(order => {
        const orderDate = parseISO(order.created_at);
        const monthStart = startOfMonth(orderDate);
        const key = format(monthStart, 'yyyy-MM');
        const existing = monthsMap.get(key);
        if (existing) {
          existing.count++;
        } else {
          monthsMap.set(key, { date: monthStart, count: 1 });
        }
      });

      const months = Array.from(monthsMap.entries())
        .sort((a, b) => b[1].date.getTime() - a[1].date.getTime())
        .map(([key, val]) => ({
          value: key,
          label: format(val.date, 'MMMM yyyy'),
          count: val.count,
        }));

      setAvailableMonths(months);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch orders',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const filteredOrders = selectedMonth === 'all'
    ? orders
    : orders.filter(order => {
        const orderDate = parseISO(order.created_at);
        const monthKey = format(startOfMonth(orderDate), 'yyyy-MM');
        return monthKey === selectedMonth;
      });

  const getOrdersByStage = (stage: ProductionStage) => {
    return filteredOrders.filter(order => order.current_stage === stage);
  };

  const getStageColor = (stage: ProductionStage) => {
    const config = PRODUCTION_STAGES.find(s => s.value === stage);
    return config?.color || 'bg-gray-500';
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-6" />
            <Skeleton className="h-6 w-32" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[400px] w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="border-b border-border/50 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-xl">Overview</CardTitle>
            <Badge variant="secondary" className="font-normal">
              {filteredOrders.length} orders
            </Badge>
          </div>
          
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center rounded-lg border border-border bg-background p-1">
              <Button
                variant={viewMode === 'board' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('board')}
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 px-2"
                onClick={() => setViewMode('list')}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Month Filter */}
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder="All months" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All months ({orders.length})</SelectItem>
                {availableMonths.map(month => (
                  <SelectItem key={month.value} value={month.value}>
                    {month.label} ({month.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {viewMode === 'board' ? (
          <ScrollArea className="w-full">
            <div className="flex gap-3 p-4 min-w-max">
              {PRODUCTION_STAGES.map(stage => {
                const stageOrders = getOrdersByStage(stage.value);
                return (
                  <div key={stage.value} className="w-[180px] flex-shrink-0">
                    {/* Column Header */}
                    <div className="mb-3 flex items-center gap-2">
                      <Badge className={`${stage.color} text-white text-xs px-2 py-0.5`}>
                        {stage.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {stageOrders.length}
                      </span>
                    </div>

                    {/* Column Content */}
                    <div className="space-y-2 min-h-[200px]">
                      {stageOrders.map(order => (
                        <div
                          key={order.id}
                          onClick={() => navigate(`/orders/${order.id}`)}
                          className="group cursor-pointer rounded-md border border-border/50 bg-card p-2.5 transition-all hover:border-primary/50 hover:bg-accent/50"
                        >
                          <div className="flex items-start gap-2">
                            <div
                              className={`mt-1 h-2 w-2 rounded-sm flex-shrink-0 ${stage.color}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate leading-tight">
                                {order.product_name}
                              </p>
                              {order.client && (
                                <p className="text-xs text-muted-foreground truncate mt-0.5">
                                  {(order.client as any)?.brand_name || (order.client as any)?.name}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Add Item Placeholder */}
                      <button
                        onClick={() => navigate('/orders/new')}
                        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                      >
                        <Plus className="h-3 w-3" />
                        New item
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        ) : (
          <div className="divide-y divide-border">
            {filteredOrders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <LayoutGrid className="h-12 w-12 text-muted-foreground/30" />
                <p className="mt-4 text-sm text-muted-foreground">No orders found</p>
              </div>
            ) : (
              filteredOrders.map(order => {
                const stageConfig = PRODUCTION_STAGES.find(s => s.value === order.current_stage);
                return (
                  <div
                    key={order.id}
                    onClick={() => navigate(`/orders/${order.id}`)}
                    className="flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                  >
                    <div
                      className={`h-3 w-3 rounded-sm flex-shrink-0 ${stageConfig?.color || 'bg-gray-500'}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{order.product_name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {(order.client as any)?.brand_name || (order.client as any)?.name}
                      </p>
                    </div>
                    <Badge className={`${stageConfig?.color} text-white`}>
                      {stageConfig?.label}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
