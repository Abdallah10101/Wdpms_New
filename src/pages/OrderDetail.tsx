import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  Calendar,
  Package,
  Building2,
  Ruler,
  Shirt,
  Hash,
  Truck,
  Clock,
  CheckCircle2,
} from 'lucide-react';
import {
  PRODUCTION_STAGES,
  PRIORITY_CONFIG,
  getStageProgress,
  type Order,
  type ProductionStage,
  type OrderStageHistory,
} from '@/lib/types';
import { format } from 'date-fns';

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [stageHistory, setStageHistory] = useState<OrderStageHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdating, setIsUpdating] = useState(false);

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
      // Fetch order
      const { data: orderData, error: orderError } = await supabase
        .from('orders')
        .select('*, client:clients(*)')
        .eq('id', id)
        .single();

      if (orderError) throw orderError;
      setOrder(orderData as Order);

      // Fetch stage history
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

  const getStageConfig = (stage: ProductionStage) => {
    return PRODUCTION_STAGES.find(s => s.value === stage) || PRODUCTION_STAGES[0];
  };

  if (authLoading || !user) {
    return null;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-6 lg:grid-cols-3">
            <Skeleton className="h-96 lg:col-span-2" />
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

  const stageConfig = getStageConfig(order.current_stage);
  const priorityConfig = PRIORITY_CONFIG.find(p => p.value === order.priority) || PRIORITY_CONFIG[1];
  const progress = getStageProgress(order.current_stage);
  const isOverdue = order.delivery_date && new Date(order.delivery_date) < new Date() && order.current_stage !== 'delivered';
  const canUpdateStage = role === 'admin' || role === 'team';

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/orders')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-bold tracking-tight">{order.product_name}</h1>
                <Badge variant="secondary" className={priorityConfig.color + ' text-white'}>
                  {priorityConfig.label}
                </Badge>
              </div>
              <p className="text-muted-foreground">{order.order_number}</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={stageConfig.color + ' text-white'}>
                    {stageConfig.label}
                  </Badge>
                  {order.current_stage === 'delivered' && (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  )}
                </div>
                <span className="text-sm font-medium">{progress}% Complete</span>
              </div>
              <Progress value={progress} className="h-2" />
              <div className="flex gap-1 overflow-x-auto pb-2">
                {PRODUCTION_STAGES.map((stage, index) => {
                  const isActive = order.current_stage === stage.value;
                  const isPast = PRODUCTION_STAGES.findIndex(s => s.value === order.current_stage) > index;
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
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Info */}
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Order Details</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex items-center gap-3">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Client</p>
                      <p className="font-medium">
                        {(order.client as any)?.brand_name || (order.client as any)?.name || 'N/A'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Hash className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Quantity</p>
                      <p className="font-medium">{order.quantity}</p>
                    </div>
                  </div>

                  {order.collection && (
                    <div className="flex items-center gap-3">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Collection</p>
                        <p className="font-medium">{order.collection}</p>
                      </div>
                    </div>
                  )}

                  {order.size && (
                    <div className="flex items-center gap-3">
                      <Ruler className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Size</p>
                        <p className="font-medium">{order.size}</p>
                      </div>
                    </div>
                  )}

                  {order.fabric && (
                    <div className="flex items-center gap-3">
                      <Shirt className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Fabric</p>
                        <p className="font-medium">{order.fabric}</p>
                      </div>
                    </div>
                  )}

                  {order.supplier && (
                    <div className="flex items-center gap-3">
                      <Truck className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Supplier</p>
                        <p className="font-medium">{order.supplier}</p>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Delivery Date</p>
                      <p className={`font-medium ${isOverdue ? 'text-destructive' : ''}`}>
                        {order.delivery_date
                          ? format(new Date(order.delivery_date), 'MMM d, yyyy')
                          : 'Not set'}
                        {isOverdue && ' (Overdue)'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">
                        {format(new Date(order.created_at), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Stage History */}
            <Card>
              <CardHeader>
                <CardTitle>Stage History</CardTitle>
                <CardDescription>Track of all production stage changes</CardDescription>
              </CardHeader>
              <CardContent>
                {stageHistory.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No stage changes recorded yet.</p>
                ) : (
                  <div className="space-y-4">
                    {stageHistory.map((history) => {
                      const toStageConfig = getStageConfig(history.to_stage);
                      const fromStageConfig = history.from_stage
                        ? getStageConfig(history.from_stage)
                        : null;
                      return (
                        <div key={history.id} className="flex items-start gap-3">
                          <div className={`mt-1 h-3 w-3 rounded-full ${toStageConfig.color}`} />
                          <div className="flex-1">
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
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Update Stage */}
            {canUpdateStage && (
              <Card>
                <CardHeader>
                  <CardTitle>Update Stage</CardTitle>
                  <CardDescription>Move order to next production stage</CardDescription>
                </CardHeader>
                <CardContent>
                  <Select
                    value={order.current_stage}
                    onValueChange={(value) => handleStageChange(value as ProductionStage)}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRODUCTION_STAGES.map((stage) => (
                        <SelectItem key={stage.value} value={stage.value}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                            {stage.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            )}

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {format(new Date(order.updated_at), 'MMM d, yyyy h:mm a')}
                  </p>
                </div>
                {order.stage_updated_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Stage Updated</p>
                    <p className="font-medium">
                      {format(new Date(order.stage_updated_at), 'MMM d, yyyy h:mm a')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
