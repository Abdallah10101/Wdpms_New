import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, parseISO } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
// NOTE: Avoid nested scroll containers with @hello-pangea/dnd
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar, LayoutGrid, List, Plus, Trash2 } from 'lucide-react';
import { PRODUCTION_STAGES, normalizeStage, type ProductionStage, type Order } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    return filteredOrders.filter(order => normalizeStage(order.current_stage) === stage);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // Dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStageValue = destination.droppableId;
    const orderId = draggableId;

    // Validate the stage is a valid production stage value.
    // Some drag/drop edge-cases can surface the *label* (e.g. "Not Started");
    // map it back to the enum value to keep the action reliable.
    const validStage =
      PRODUCTION_STAGES.find(s => s.value === newStageValue) ||
      PRODUCTION_STAGES.find(s => s.label === newStageValue) ||
      PRODUCTION_STAGES.find(s => s.label.toLowerCase() === String(newStageValue).toLowerCase());
    if (!validStage) {
      console.error('Invalid stage value:', newStageValue);
      toast({
        title: 'Error',
        description: 'Invalid stage value.',
        variant: 'destructive',
      });
      return;
    }

    const newStage = validStage.value;

    // Optimistic update
    setOrders(prevOrders =>
      prevOrders.map(order =>
        order.id === orderId ? { ...order, current_stage: newStage } : order
      )
    );

    try {
      const { error } = await supabase
        .from('orders')
        .update({ current_stage: newStage })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Stage Updated',
        description: `Order moved to ${validStage.label}`,
      });
    } catch (error) {
      console.error('Error updating order stage:', error);
      // Revert on error
      fetchOrders();
      toast({
        title: 'Error',
        description: 'Failed to update order stage.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteOrder = async () => {
    if (!orderToDelete || isDeleting) return;
    setIsDeleting(true);

    // Optimistic update
    setOrders(prev => prev.filter(o => o.id !== orderToDelete.id));
    setDeleteDialogOpen(false);

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (error) throw error;

      toast({
        title: 'Order Deleted',
        description: `${orderToDelete.product_name} has been removed.`,
      });
      setOrderToDelete(null);
    } catch (error) {
      console.error('Error deleting order:', error);
      fetchOrders(); // Revert
      toast({
        title: 'Error',
        description: 'Failed to delete order.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
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
    <>
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
            <div className="w-full overflow-x-auto">
              <DragDropContext onDragEnd={handleDragEnd}>
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

                        {/* Column Content - Droppable */}
                        <Droppable droppableId={stage.value}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.droppableProps}
                              className={`space-y-2 min-h-[200px] rounded-lg p-2 transition-colors ${
                                snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary/30' : 'bg-muted/20'
                              }`}
                            >
                              {stageOrders.map((order, index) => (
                                <Draggable key={order.id} draggableId={order.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      onClick={() => !snapshot.isDragging && navigate(`/orders/${order.id}`)}
                                      className={`group cursor-grab active:cursor-grabbing rounded-md border border-border/50 bg-card p-2.5 transition-all hover:border-primary/50 hover:bg-accent/50 ${
                                        snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''
                                      }`}
                                    >
                                      <div className="flex items-start gap-2">
                                        <div
                                          className={`mt-1 h-2 w-2 rounded-sm flex-shrink-0 ${stage.color}`}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="flex items-start justify-between gap-1">
                                            <p className="text-sm font-medium truncate leading-tight flex-1">
                                              {order.product_name}
                                            </p>
                                            <Button
                                              variant="ghost"
                                              size="icon"
                                              className="h-5 w-5 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity flex-shrink-0 -mr-1 -mt-0.5"
                                              onClick={(e) => confirmDelete(e, order)}
                                            >
                                              <Trash2 className="h-3 w-3" />
                                            </Button>
                                          </div>
                                          {order.client && (
                                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                                              {(order.client as any)?.brand_name || (order.client as any)?.name}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </Draggable>
                              ))}
                              {provided.placeholder}

                              {/* Add Item Placeholder */}
                              <button
                                onClick={() => navigate('/orders/new')}
                                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
                              >
                                <Plus className="h-3 w-3" />
                                New item
                              </button>
                            </div>
                          )}
                        </Droppable>
                      </div>
                    );
                  })}
                </div>
              </DragDropContext>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filteredOrders.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <LayoutGrid className="h-12 w-12 text-muted-foreground/30" />
                  <p className="mt-4 text-sm text-muted-foreground">No orders found</p>
                </div>
              ) : (
                filteredOrders.map(order => {
                  const stageConfig = PRODUCTION_STAGES.find(s => s.value === normalizeStage(order.current_stage));
                  return (
                    <div
                      key={order.id}
                      className="group flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-accent/50 transition-colors"
                    >
                      <div
                        className={`h-3 w-3 rounded-sm flex-shrink-0 ${stageConfig?.color || 'bg-gray-500'}`}
                        onClick={() => navigate(`/orders/${order.id}`)}
                      />
                      <div className="flex-1 min-w-0" onClick={() => navigate(`/orders/${order.id}`)}>
                        <p className="font-medium truncate">{order.product_name}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {(order.client as any)?.brand_name || (order.client as any)?.name}
                        </p>
                      </div>
                      <Badge className={`${stageConfig?.color} text-white`}>
                        {stageConfig?.label}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity flex-shrink-0"
                        onClick={(e) => confirmDelete(e, order)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{orderToDelete?.product_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
