import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import {
  Package,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Download,
  Eye,
  ArrowRight,
  Truck,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { PRODUCTION_STAGES, getStageProgress, type Order, type OrderNote, type OrderFile } from '@/lib/types';

interface ClientData {
  id: string;
  name: string;
  brand_name: string | null;
}

export default function ClientPortal() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  
  const [client, setClient] = useState<ClientData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentNotes, setRecentNotes] = useState<(OrderNote & { order?: Order })[]>([]);
  const [archivedFiles, setArchivedFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Redirect non-clients to dashboard
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role && role !== 'client') {
      navigate('/dashboard');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role === 'client') {
      fetchClientData();
    }
  }, [user, role]);

  const fetchClientData = async () => {
    try {
      // Get client record linked to this user
      const { data: clientData, error: clientError } = await supabase
        .from('clients')
        .select('id, name, brand_name')
        .eq('user_id', user?.id)
        .single();

      if (clientError) throw clientError;
      setClient(clientData);

      // Fetch orders for this client
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select('*')
        .eq('client_id', clientData.id)
        .order('updated_at', { ascending: false });

      if (ordersError) throw ordersError;
      setOrders((ordersData || []) as Order[]);

      // Fetch client-visible notes across all orders
      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map(o => o.id);
        
        const { data: notesData, error: notesError } = await supabase
          .from('order_notes')
          .select('*')
          .in('order_id', orderIds)
          .eq('is_client_visible', true)
          .order('created_at', { ascending: false })
          .limit(10);

        if (!notesError && notesData) {
          // Attach order info to notes
          const notesWithOrders = notesData.map(note => ({
            ...note,
            order: ordersData.find(o => o.id === note.order_id),
          }));
          setRecentNotes(notesWithOrders as any);
        }
      }

      // Fetch archived files
      const { data: filesData, error: filesError } = await supabase
        .from('client_archive_files')
        .select('*')
        .eq('client_id', clientData.id)
        .order('archived_at', { ascending: false })
        .limit(20);

      if (!filesError) {
        setArchivedFiles(filesData || []);
      }

    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStageConfig = (stage: string) => {
    return PRODUCTION_STAGES.find(s => s.value === stage) || PRODUCTION_STAGES[0];
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-files')
        .download(filePath);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const activeOrders = orders.filter(o => o.current_stage !== 'delivered');
  const completedOrders = orders.filter(o => o.current_stage === 'delivered');

  if (authLoading || !user) {
    return null;
  }

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
          <Skeleton className="h-64" />
        </div>
      </DashboardLayout>
    );
  }

  if (!client) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-12">
          <Package className="h-16 w-16 text-muted-foreground/50" />
          <h2 className="mt-4 text-xl font-semibold">Account Not Linked</h2>
          <p className="mt-2 text-muted-foreground text-center max-w-md">
            Your account hasn't been linked to a client profile yet. Please contact your account manager.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Welcome Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Welcome, {client.brand_name || client.name}
          </h1>
          <p className="text-muted-foreground">
            Track your orders and view production updates
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                {activeOrders.length === 1 ? 'Order' : 'Orders'} in production
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{completedOrders.length}</div>
              <p className="text-xs text-muted-foreground">
                Orders delivered
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Documents</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{archivedFiles.length}</div>
              <p className="text-xs text-muted-foreground">
                Archived files
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Tabs */}
        <Tabs defaultValue="active" className="space-y-4">
          <TabsList>
            <TabsTrigger value="active" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Active Orders ({activeOrders.length})
            </TabsTrigger>
            <TabsTrigger value="completed" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Completed ({completedOrders.length})
            </TabsTrigger>
            <TabsTrigger value="updates" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Updates ({recentNotes.length})
            </TabsTrigger>
            <TabsTrigger value="files" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Files
            </TabsTrigger>
          </TabsList>

          {/* Active Orders Tab */}
          <TabsContent value="active" className="space-y-4">
            {activeOrders.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No active orders at the moment</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {activeOrders.map((order) => {
                  const stageConfig = getStageConfig(order.current_stage);
                  const progress = getStageProgress(order.current_stage);
                  
                  return (
                    <Card key={order.id} className="overflow-hidden">
                      <CardContent className="p-6">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg truncate">{order.product_name}</h3>
                              <Badge variant="secondary" className={`${stageConfig.color} text-white`}>
                                {stageConfig.label}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Order #{order.order_number}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                              <span>Qty: {order.quantity}</span>
                              {order.pieces_sent ? (
                                <span className="flex items-center gap-1">
                                  <Truck className="h-3 w-3" />
                                  {order.pieces_sent} sent
                                </span>
                              ) : null}
                              {order.stage_updated_at && (
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Updated {formatDistanceToNow(new Date(order.stage_updated_at), { addSuffix: true })}
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="lg:w-48">
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>Progress</span>
                              <span>{Math.round(progress)}%</span>
                            </div>
                            <Progress value={progress} className="h-2" />
                          </div>
                          
                          <Button variant="outline" size="sm" asChild>
                            <Link to={`/orders/${order.id}`}>
                              View Details
                              <ArrowRight className="ml-2 h-4 w-4" />
                            </Link>
                          </Button>
                        </div>

                        {/* Stage Progress Visualization */}
                        <div className="mt-6 overflow-x-auto">
                          <div className="flex items-center gap-1 min-w-max">
                            {PRODUCTION_STAGES.map((stage, index) => {
                              const isActive = order.current_stage === stage.value;
                              const isPast = PRODUCTION_STAGES.findIndex(s => s.value === order.current_stage) > index;
                              
                              return (
                                <div key={stage.value} className="flex items-center">
                                  <div
                                    className={`
                                      flex items-center justify-center w-8 h-8 rounded-full text-xs font-medium
                                      ${isActive ? `${stage.color} text-white ring-2 ring-offset-2 ring-primary` : ''}
                                      ${isPast ? 'bg-primary text-primary-foreground' : ''}
                                      ${!isActive && !isPast ? 'bg-muted text-muted-foreground' : ''}
                                    `}
                                  >
                                    {isPast ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                                  </div>
                                  {index < PRODUCTION_STAGES.length - 1 && (
                                    <div className={`w-6 h-0.5 ${isPast ? 'bg-primary' : 'bg-muted'}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          <div className="flex items-center gap-1 min-w-max mt-1">
                            {PRODUCTION_STAGES.map((stage, index) => (
                              <div key={stage.value} className="flex items-center">
                                <div className="w-8 text-center">
                                  <span className="text-[10px] text-muted-foreground leading-none">
                                    {stage.label.slice(0, 3)}
                                  </span>
                                </div>
                                {index < PRODUCTION_STAGES.length - 1 && <div className="w-6" />}
                              </div>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
                          <h3 className="font-medium">{order.product_name}</h3>
                          <p className="text-sm text-muted-foreground">{order.order_number}</p>
                        </div>
                        <Badge className="bg-emerald-500 text-white">Delivered</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
                        <span>Qty: {order.quantity}</span>
                        {order.delivery_date && (
                          <span>
                            {format(new Date(order.delivery_date), 'MMM d, yyyy')}
                          </span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Updates/Notes Tab */}
          <TabsContent value="updates">
            {recentNotes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No updates yet</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Recent Updates
                  </CardTitle>
                  <CardDescription>
                    Latest messages from your production team
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[400px] pr-4">
                    <div className="space-y-4">
                      {recentNotes.map((note) => (
                        <div key={note.id} className="border-b pb-4 last:border-0">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline" className="text-xs">
                              {(note.order as any)?.product_name || 'Order'}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Files Tab */}
          <TabsContent value="files">
            {archivedFiles.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No files archived yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {archivedFiles.map((file) => (
                  <Card key={file.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-muted p-2">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{file.file_name}</p>
                          {file.order_number && (
                            <p className="text-xs text-muted-foreground">{file.order_number}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            {file.category && (
                              <Badge variant="secondary" className="text-xs">
                                {file.category}
                              </Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {file.delivery_month}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDownload(file.file_path, file.file_name)}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
