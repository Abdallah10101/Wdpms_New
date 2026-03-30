import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  ArrowLeft,
  Building2,
  Mail,
  Phone,
  MapPin,
  Package,
  FileText,
  Clock,
  CheckCircle2,
  Trash2,
  BarChart3,
  CalendarDays,
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
import { PRODUCTION_STAGES, normalizeStage, type Client, type Order, type OrderFile } from '@/lib/types';
import { format } from 'date-fns';
import OrderAnalysisTab from '@/components/order-analysis/OrderAnalysisTab';

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [receipts, setReceipts] = useState<OrderFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role === 'client') {
      navigate('/dashboard');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client' && id) {
      fetchClientData();
    }
  }, [user, role, id]);

  const fetchClientData = async () => {
    try {
      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('*')
        .eq('id', id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData as Client);

      // Fetch orders for this client
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', id)
        .order('created_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders((ordersData || []) as Order[]);

      // Fetch receipts (invoices) for orders of this client
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        const { data: filesData, error: filesError } = await supabase
          .from('order_files')
          .select('*')
          .in('order_id', orderIds)
          .eq('category', 'invoice')
          .order('created_at', { ascending: false });

        if (filesError) throw filesError;
        setReceipts((filesData || []) as OrderFile[]);
      }
    } catch (error) {
      console.error('Error fetching client data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load client details.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStageConfig = (stage: string) => {
    return PRODUCTION_STAGES.find(s => s.value === normalizeStage(stage as any)) || PRODUCTION_STAGES[0];
  };

  const handleDeleteClient = async () => {
    if (!client || isDeleting) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', client.id);

      if (error) throw error;

      toast({
        title: 'Client Deleted',
        description: 'The client has been permanently deleted.',
      });

      navigate('/clients');
    } catch (error) {
      console.error('Error deleting client:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete client. Make sure all orders are deleted first.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const activeOrders = orders.filter(o => o.current_stage !== 'delivered');
  const completedOrders = orders.filter(o => o.current_stage === 'delivered');

  // Group active orders by stage for kanban-like view
  const ordersByStage = PRODUCTION_STAGES.reduce((acc, stage) => {
    acc[stage.value] = activeOrders.filter(o => normalizeStage(o.current_stage) === stage.value);
    return acc;
  }, {} as Record<string, Order[]>);

  // Group orders by month for overview
  const ordersByMonth = orders.reduce((acc, order) => {
    const monthKey = format(new Date(order.created_at), 'yyyy-MM');
    const monthLabel = format(new Date(order.created_at), 'MMMM yyyy');
    if (!acc[monthKey]) acc[monthKey] = { label: monthLabel, orders: [], totalQty: 0, bulkQty: 0, sampleQty: 0 };
    acc[monthKey].orders.push(order);
    acc[monthKey].totalQty += order.quantity || 0;
    if (order.current_stage === 'sample' || order.size?.toLowerCase().includes('sample')) {
      acc[monthKey].sampleQty += order.quantity || 0;
    } else {
      acc[monthKey].bulkQty += order.quantity || 0;
    }
    return acc;
  }, {} as Record<string, { label: string; orders: Order[]; totalQty: number; bulkQty: number; sampleQty: number }>);

  const sortedMonths = Object.entries(ordersByMonth).sort(([a], [b]) => b.localeCompare(a));

  if (authLoading || !user) {
    return null;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <p className="text-muted-foreground">Client not found</p>
          <Button className="mt-4" onClick={() => navigate('/clients')}>
            Back to Clients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/clients')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{client.name}</h1>
            {client.brand_name && (
              <p className="text-muted-foreground">{client.brand_name}</p>
            )}
          </div>
        </div>

        {/* Client Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Client Information
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {client.contact_person && (
              <div>
                <p className="text-sm text-muted-foreground">Contact Person</p>
                <p className="font-medium">{client.contact_person}</p>
              </div>
            )}
            {client.contact_email && (
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <a
                  href={`mailto:${client.contact_email}`}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  <Mail className="h-3 w-3" />
                  {client.contact_email}
                </a>
              </div>
            )}
            {client.contact_phone && (
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <a
                  href={`tel:${client.contact_phone}`}
                  className="flex items-center gap-1 font-medium hover:underline"
                >
                  <Phone className="h-3 w-3" />
                  {client.contact_phone}
                </a>
              </div>
            )}
            {client.address && (
              <div>
                <p className="text-sm text-muted-foreground">Address</p>
                <p className="flex items-start gap-1 font-medium">
                  <MapPin className="h-3 w-3 mt-1" />
                  {client.address}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Tabs for Orders and Receipts */}
        <Tabs defaultValue="production" className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="production" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Production ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed ({completedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="receipts" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Receipts ({receipts.length})
            </TabsTrigger>
            {role === 'admin' && (
              <TabsTrigger value="analysis" className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4" />
                Analysis
              </TabsTrigger>
            )}
          </TabsList>

          {/* Overview Tab - Monthly summary */}
          <TabsContent value="overview" className="space-y-4">
            {/* Total summary */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold">{orders.length}</p>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-orange-500">
                    {orders.reduce((s, o) => s + (o.quantity || 0), 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">Total Products</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4 text-center">
                  <p className="text-3xl font-bold text-green-500">{completedOrders.length}</p>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                </CardContent>
              </Card>
            </div>

            {/* Monthly breakdown */}
            {sortedMonths.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CalendarDays className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No orders yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {sortedMonths.map(([key, data]) => (
                  <Card key={key} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-orange-500" />
                        {data.label}
                      </CardTitle>
                      <CardDescription>{data.orders.length} order{data.orders.length !== 1 ? 's' : ''}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {data.bulkQty > 0 && (
                        <p className="text-sm">
                          <span className="text-orange-500 font-semibold">Bulk:</span>{' '}
                          <span className="font-medium">{data.bulkQty.toLocaleString()} products</span>
                        </p>
                      )}
                      {data.sampleQty > 0 && (
                        <p className="text-sm">
                          <span className="text-green-500 font-semibold">Samples:</span>{' '}
                          <span className="font-medium">{data.sampleQty.toLocaleString()} products</span>
                        </p>
                      )}
                      <div className="pt-2 border-t">
                        {data.orders.map((order) => (
                          <div
                            key={order.id}
                            className="flex items-center justify-between py-1 text-sm cursor-pointer hover:text-primary"
                            onClick={() => navigate(`/orders/${order.id}`)}
                          >
                            <span className="truncate mr-2">{order.product_name}</span>
                            <span className="text-muted-foreground whitespace-nowrap">x{order.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Production Tab - Kanban-like view */}
          <TabsContent value="production" className="space-y-4">
            {activeOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No active orders</p>
                </CardContent>
              </Card>
            ) : (
              <div className="overflow-x-auto pb-4">
                <div className="flex gap-4 min-w-max">
                  {PRODUCTION_STAGES.filter(stage => stage.value !== 'delivered').map((stage) => {
                    const stageOrders = ordersByStage[stage.value] || [];
                    if (stageOrders.length === 0) return null;
                    
                    return (
                      <Card key={stage.value} className="w-72 flex-shrink-0">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                            {stage.label}
                            <Badge variant="secondary" className="ml-auto">
                              {stageOrders.length}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          {stageOrders.map((order) => (
                            <Card
                              key={order.id}
                              className="cursor-pointer hover:bg-accent transition-colors"
                              onClick={() => navigate(`/orders/${order.id}`)}
                            >
                              <CardContent className="p-3 space-y-1">
                                <p className="font-medium text-sm">{order.product_name}</p>
                                <p className="text-xs text-muted-foreground">
                                  {order.order_number}
                                </p>
                                <div className="flex items-center justify-between text-xs">
                                  <span>Qty: {order.quantity}</span>
                                  {order.stage_updated_at && (
                                    <span className="flex items-center gap-1 text-muted-foreground">
                                      <Clock className="h-3 w-3" />
                                      {new Date(order.stage_updated_at).toLocaleDateString()}
                                    </span>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          {/* Completed Orders Tab */}
          <TabsContent value="completed">
            {completedOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle2 className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No completed orders yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {completedOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => navigate(`/orders/${order.id}`)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{order.product_name}</p>
                          <p className="text-sm text-muted-foreground">{order.order_number}</p>
                        </div>
                        <Badge className="bg-emerald-500 text-white">Delivered</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm">
                        <span>Qty: {order.quantity}</span>
                        {order.delivery_date && (
                          <span className="text-muted-foreground">
                            Delivered: {new Date(order.delivery_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Receipts Tab */}
          <TabsContent value="receipts">
            {receipts.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No receipts/invoices yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {receipts.map((file) => {
                  const order = orders.find(o => o.id === file.order_id);
                  return (
                    <Card key={file.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className="rounded-lg bg-muted p-2">
                            <FileText className="h-5 w-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{file.file_name}</p>
                            {order && (
                              <p className="text-sm text-muted-foreground">
                                {order.product_name}
                              </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(file.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {role === 'admin' && (
            <TabsContent value="analysis">
              <OrderAnalysisTab clientId={id!} client={client} />
            </TabsContent>
          )}
        </Tabs>

        {/* Notes Section */}
        {client.notes && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Notes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                {client.notes}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Delete Client - Admin Only */}
        {role === 'admin' && (
          <Card className="border-destructive/50">
            <CardHeader>
              <CardTitle className="text-destructive flex items-center gap-2">
                <Trash2 className="h-5 w-5" />
                Danger Zone
              </CardTitle>
              <CardDescription>Permanently delete this client and all associated data</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full" disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    {isDeleting ? 'Deleting...' : 'Delete Client'}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Client</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete "{client.name}"?
                      This action cannot be undone and will permanently remove all associated data.
                      {orders.length > 0 && (
                        <span className="block mt-2 text-destructive font-medium">
                          Warning: This client has {orders.length} order(s). Delete orders first.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteClient}
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
    </DashboardLayout>
  );
}
