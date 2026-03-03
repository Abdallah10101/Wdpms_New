import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  Trash2,
  Package,
  Clock,
  History,
  Copy,
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  PRODUCTION_STAGES,
  getStageProgress,
  normalizeStage,
  type Order,
  type ProductionStage,
  type OrderPriority,
  type OrderStageHistory,
} from '@/lib/types';
import { format } from 'date-fns';
import { OrderHeader } from '@/components/orders/OrderHeader';
import { OrderDetails } from '@/components/orders/OrderDetails';
import { OrderNotes } from '@/components/orders/OrderNotes';
import { OrderTasks } from '@/components/orders/OrderTasks';
import { OrderInvoices } from '@/components/orders/OrderInvoices';
import { OrderStageImages } from '@/components/orders/OrderStageImages';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [stageHistory, setStageHistory] = useState<OrderStageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCloning, setIsCloning] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && id) {
      fetchOrderData();
    }
  }, [user, id]);

  const fetchOrderData = async () => {
    try {
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, client:clients(*)')
        .eq('id', id)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData as Order);

      const { data: historyData, error: historyError } = await supabase
        .from('order_stage_history')
        .select('*')
        .eq('order_id', id)
        .order('changed_at', { ascending: false });

      if (historyError) throw historyError;
      setStageHistory((historyData || []) as OrderStageHistory[]);
    } catch (error) {
      console.error('Error fetching order:', error);
      toast({
        title: 'Error',
        description: 'Failed to load order details.',
        variant: 'destructive',
      });
      navigate('/orders');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStageChange = async (newStage: ProductionStage) => {
    if (!order || isUpdating) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ current_stage: newStage })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Order stage updated.',
      });

      fetchOrderData();
    } catch (error) {
      console.error('Error updating stage:', error);
      toast({
        title: 'Error',
        description: 'Failed to update stage.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePriorityChange = async (newPriority: OrderPriority) => {
    if (!order || isUpdating) return;
    setIsUpdating(true);

    try {
      const { error } = await supabase
        .from('orders')
        .update({ priority: newPriority })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Order priority updated.',
      });

      fetchOrderData();
    } catch (error) {
      console.error('Error updating priority:', error);
      toast({
        title: 'Error',
        description: 'Failed to update priority.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!order || isDeleting) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'Order Deleted',
        description: 'The order has been permanently deleted.',
      });

      // Navigate back instead of always going to /orders
      navigate(-1);
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete order.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCloneOrder = async () => {
    if (!order || isCloning) return;
    setIsCloning(true);
    try {
      const { data: newOrder, error } = await supabase
        .from('orders')
        .insert({
          product_name: `${order.product_name} (Copy)`,
          client_id: order.client_id,
          collection: order.collection,
          size: order.size,
          fabric: order.fabric,
          supplier: order.supplier,
          quantity: order.quantity,
          delivery_date: order.delivery_date,
          priority: order.priority,
          current_stage: 'not_started',
          has_printing: order.has_printing,
          has_embroidery: order.has_embroidery,
          has_wash_house: order.has_wash_house,
          created_by: user?.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      toast({ title: 'Order Duplicated', description: 'A copy of this order has been created.' });
      navigate(`/orders/${newOrder.id}`);
    } catch (error) {
      console.error('Error cloning order:', error);
      toast({ title: 'Error', description: 'Failed to duplicate order.', variant: 'destructive' });
    } finally {
      setIsCloning(false);
    }
  };

  const getStageConfig = (stage: ProductionStage) => {
    return PRODUCTION_STAGES.find(s => s.value === normalizeStage(stage)) || PRODUCTION_STAGES[0];
  };

  if (authLoading || !user) {
    return null;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6 max-w-5xl mx-auto">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-20 w-full" />
          <div className="grid gap-6 lg:grid-cols-2">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!order) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Package className="h-12 w-12 text-muted-foreground/50" />
          <p className="mt-4 text-muted-foreground">Order not found</p>
          <Button className="mt-4" onClick={() => navigate('/orders')}>
            Back to Orders
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  const canEdit = role === 'admin' || role === 'team';
  const progress = getStageProgress(order.current_stage);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <OrderHeader
          order={order}
          canEdit={canEdit}
          isUpdating={isUpdating}
          onBack={() => navigate(-1)}
          onStageChange={handleStageChange}
          onPriorityChange={handlePriorityChange}
          onNameChange={(newName) => setOrder(prev => prev ? { ...prev, product_name: newName } : null)}
        />

        {/* Progress Bar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Production Progress</span>
              <span className="text-sm text-muted-foreground">{progress}% Complete</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="flex gap-1 mt-3 overflow-x-auto pb-1">
              {PRODUCTION_STAGES.map((stage, index) => {
                const normalizedCurrent = normalizeStage(order.current_stage);
                const isActive = normalizedCurrent === stage.value;
                const isPast = PRODUCTION_STAGES.findIndex(s => s.value === normalizedCurrent) > index;
                return (
                  <div
                    key={stage.value}
                    className={`flex-shrink-0 rounded px-2 py-1 text-xs ${
                      isActive
                        ? stage.color + ' text-white'
                        : isPast
                        ? 'bg-muted text-muted-foreground line-through'
                        : 'bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    {stage.label}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Left Column - Details & Notes */}
          <div className="space-y-6">
            {/* Product Description */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Product Description</CardTitle>
              </CardHeader>
              <CardContent>
                <OrderDetails order={order} canEdit={canEdit} onUpdate={fetchOrderData} />
              </CardContent>
            </Card>

            {/* Comments/Notes */}
            <Card>
              <CardContent className="pt-6">
                <OrderNotes orderId={order.id} />
              </CardContent>
            </Card>

            {/* Stage Images (client-visible) */}
            <Card>
              <CardContent className="pt-6">
                <OrderStageImages orderId={order.id} canUpload={canEdit} />
              </CardContent>
            </Card>

            {/* Invoices - Admin/Team only */}
            {(role === 'admin' || role === 'team') && (
              <Card>
                <CardContent className="pt-6">
                  <OrderInvoices orderId={order.id} />
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column - Tasks & History */}
          <div className="space-y-6">
            {/* To Do List - Admin/Team only */}
            {(role === 'admin' || role === 'team') && (
              <Card>
                <CardContent className="pt-6">
                  <OrderTasks orderId={order.id} />
                </CardContent>
              </Card>
            )}

            {/* Stage History */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Stage History
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stageHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No stage changes recorded yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {stageHistory.slice(0, 5).map((history) => {
                      const toStageConfig = getStageConfig(history.to_stage);
                      const fromStageConfig = history.from_stage
                        ? getStageConfig(history.from_stage)
                        : null;
                      return (
                        <div key={history.id} className="flex items-start gap-3">
                          <div className={`mt-1.5 h-2.5 w-2.5 rounded-full ${toStageConfig.color}`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              {fromStageConfig && (
                                <>
                                  <span className="text-muted-foreground">
                                    {fromStageConfig.label}
                                  </span>
                                  <span className="mx-2">→</span>
                                </>
                              )}
                              <span className="font-medium">{toStageConfig.label}</span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(history.changed_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Quick Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Created</span>
                  <span>{format(new Date(order.created_at), 'MMM d, yyyy')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Updated</span>
                  <span>{format(new Date(order.updated_at), 'MMM d, yyyy h:mm a')}</span>
                </div>
                {order.stage_updated_at && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Stage Updated</span>
                    <span>{format(new Date(order.stage_updated_at), 'MMM d, yyyy h:mm a')}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Clone Order - Admin/Team */}
            {canEdit && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Copy className="h-5 w-5" />
                    Duplicate Order
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Create a copy of this order with the same specifications, starting from the beginning.
                  </p>
                  <Button variant="outline" className="w-full" onClick={handleCloneOrder} disabled={isCloning}>
                    {isCloning ? (
                      <><Copy className="mr-2 h-4 w-4 animate-spin" />Duplicating...</>
                    ) : (
                      <><Copy className="mr-2 h-4 w-4" />Duplicate Order</>
                    )}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Delete Order - Admin Only */}
            {role === 'admin' && (
              <Card className="border-destructive/50">
                <CardHeader>
                  <CardTitle className="text-destructive text-lg">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="w-full" disabled={isDeleting}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {isDeleting ? 'Deleting...' : 'Delete Order'}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Order</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete this order and all associated data. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteOrder}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Delete
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
