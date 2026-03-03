import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceViewer, Invoice, InvoiceStatus } from '@/components/invoices/InvoiceViewer';
import {
  Package,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  Eye,
  Image as ImageIcon,
  ArrowRight,
  Truck,
  Printer,
  Sparkles,
  Waves,
  Send,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { PRODUCTION_STAGES, getClientVisibleStagesForOrder, getClientStageProgressForOrder, normalizeStage, type Order, type OrderNote } from '@/lib/types';

const STAGE_SHORT_LABELS: Record<string, string> = {
  cutting: 'Cutting',
  printing: 'Printing',
  embroidery: 'Embroidery',
  sewing: 'Sewing',
  wash_house: 'Wash House',
  qc: 'QC & Pack',
  packaging: 'QC & Pack',
  shipping: 'Shipping',
  delivered: 'Delivered',
};
import {
  CLIENT_STAGE_IMAGE_STAGES,
  STAGE_IMAGE_LABELS,
  STAGE_IMAGE_CATEGORIES,
  categoryToStage,
  type ClientStageImageStage,
} from '@/lib/stage-images';

interface ClientData {
  id: string;
  name: string;
  brand_name: string | null;
}

const INVOICE_STATUS_COLORS: Record<InvoiceStatus, string> = {
  draft: 'bg-gray-100 text-gray-800',
  sent: 'bg-blue-100 text-blue-800',
  viewed: 'bg-purple-100 text-purple-800',
  partially_paid: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-green-100 text-green-800',
  overdue: 'bg-red-100 text-red-800',
};

const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: 'Draft',
  sent: 'Sent',
  viewed: 'Viewed',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
};

export default function ClientPortal() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, role, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [client, setClient] = useState<ClientData | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentNotes, setRecentNotes] = useState<(OrderNote & { order?: Order })[]>([]);
  const [clientInvoices, setClientInvoices] = useState<Invoice[]>([]);
  const [stageImagesByOrder, setStageImagesByOrder] = useState<
    Record<string, Partial<Record<ClientStageImageStage, { signedUrl: string; createdAt: string }>>>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceViewerOpen, setInvoiceViewerOpen] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);

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
          // Attach order info to notes (author_name and author_role are stored directly on the note)
          const notesWithOrders = notesData.map(note => ({
            ...note,
            order: ordersData.find(o => o.id === note.order_id),
          }));
          setRecentNotes(notesWithOrders as any);
        }

        // Fetch client invoices from the invoices table
        const { data: invoicesData, error: invoicesError } = await supabase
          .from('invoices')
          .select(`
            *,
            order:orders(order_number, product_name)
          `)
          .eq('client_id', clientData.id)
          .neq('status', 'draft')
          .order('created_at', { ascending: false });

        if (!invoicesError && invoicesData) {
          // Mark invoice as viewed when client fetches it
          const unviewedInvoices = invoicesData.filter(inv => inv.status === 'sent');
          if (unviewedInvoices.length > 0) {
            await supabase
              .from('invoices')
              .update({ status: 'viewed', viewed_at: new Date().toISOString() })
              .in('id', unviewedInvoices.map(i => i.id));
          }
          setClientInvoices(invoicesData as Invoice[]);
        }

        const { data: stageImageFiles, error: stageImagesError } = await supabase
          .from('order_files')
          .select('order_id, category, file_path, created_at')
          .in('order_id', orderIds)
          .eq('is_client_visible', true)
          .in('category', STAGE_IMAGE_CATEGORIES)
          .order('created_at', { ascending: false });

        if (!stageImagesError && stageImageFiles) {
          const latestByOrderAndStage: Record<
            string,
            Partial<Record<ClientStageImageStage, { filePath: string; createdAt: string }>>
          > = {};

          for (const file of stageImageFiles) {
            const stage = categoryToStage(file.category);
            if (!stage) continue;

            if (!latestByOrderAndStage[file.order_id]) {
              latestByOrderAndStage[file.order_id] = {};
            }

            if (!latestByOrderAndStage[file.order_id][stage]) {
              latestByOrderAndStage[file.order_id][stage] = {
                filePath: file.file_path,
                createdAt: file.created_at,
              };
            }
          }

          const signedByOrder: Record<
            string,
            Partial<Record<ClientStageImageStage, { signedUrl: string; createdAt: string }>>
          > = {};

          await Promise.all(
            Object.entries(latestByOrderAndStage).map(async ([orderId, stages]) => {
              signedByOrder[orderId] = {};
              await Promise.all(
                CLIENT_STAGE_IMAGE_STAGES.map(async (stage) => {
                  const file = stages[stage];
                  if (!file) return;
                  const { data: signedData } = await supabase.storage
                    .from('order-files')
                    .createSignedUrl(file.filePath, 60 * 60);
                  if (signedData?.signedUrl) {
                    signedByOrder[orderId][stage] = {
                      signedUrl: signedData.signedUrl,
                      createdAt: file.createdAt,
                    };
                  }
                }),
              );
            }),
          );

          setStageImagesByOrder(signedByOrder);
        }
      }

    } catch (error) {
      console.error('Error fetching client data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStageConfig = (stage: string) => {
    return PRODUCTION_STAGES.find(s => s.value === normalizeStage(stage as any)) || PRODUCTION_STAGES[0];
  };

  const activeOrders = orders.filter(o => o.current_stage !== 'delivered');
  const completedOrders = orders.filter(o => o.current_stage === 'delivered');
  const activeTab = searchParams.get('tab') || 'dashboard';

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedOrderId || isSendingMessage) return;
    setIsSendingMessage(true);

    try {
      const { error } = await supabase
        .from('order_notes')
        .insert({
          order_id: selectedOrderId,
          content: newMessage.trim(),
          author_id: user?.id,
          is_client_visible: true,
          author_name: profile?.full_name || client?.name || user?.email || 'Client',
          author_role: 'client',
        } as any);

      if (error) throw error;

      setNewMessage('');
      toast({ title: 'Message Sent', description: 'Your message has been sent to the team.' });
      // Refresh notes
      fetchClientData();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({ title: 'Error', description: 'Failed to send message.', variant: 'destructive' });
    } finally {
      setIsSendingMessage(false);
    }
  };

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
        {/* Active Orders - dedicated clean page */}
        {activeTab === 'active' && (
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Active Orders</h1>
            <p className="text-muted-foreground">
              {activeOrders.length} {activeOrders.length === 1 ? 'order' : 'orders'} currently in production
            </p>
          </div>
        )}

        {/* Dashboard - overview of everything */}
        {activeTab === 'dashboard' && (
          <>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Welcome, {client.brand_name || client.name}
              </h1>
              <p className="text-muted-foreground">
                Here's an overview of your orders and activity
              </p>
            </div>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
                  <Package className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{activeOrders.length}</div>
                  <p className="text-xs text-muted-foreground">In production</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Completed</CardTitle>
                  <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{completedOrders.length}</div>
                  <p className="text-xs text-muted-foreground">Delivered</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">Invoices</CardTitle>
                  <FileText className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{clientInvoices.length}</div>
                  <p className="text-xs text-muted-foreground">Total invoices</p>
                </CardContent>
              </Card>
            </div>

            {/* Active Orders - same layout as Active Orders tab */}
            {activeOrders.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Active Orders
                  </h2>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/portal?tab=active">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </div>
                <div className="grid gap-4">
                  {activeOrders.slice(0, 5).map((order) => {
                    const stageConfig = getStageConfig(order.current_stage);
                    const progress = getClientStageProgressForOrder(order.current_stage, order);
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
                              {(order.has_printing || order.has_embroidery || order.has_wash_house) && (
                                <div className="flex flex-wrap gap-1.5 mt-2">
                                  {order.has_printing && (
                                    <Badge variant="outline" className="text-xs flex items-center gap-1 px-2 py-0.5">
                                      <Printer className="h-3 w-3 text-blue-500" />
                                      Printing
                                    </Badge>
                                  )}
                                  {order.has_embroidery && (
                                    <Badge variant="outline" className="text-xs flex items-center gap-1 px-2 py-0.5">
                                      <Sparkles className="h-3 w-3 text-purple-500" />
                                      Embroidery
                                    </Badge>
                                  )}
                                  {order.has_wash_house && (
                                    <Badge variant="outline" className="text-xs flex items-center gap-1 px-2 py-0.5">
                                      <Waves className="h-3 w-3 text-cyan-500" />
                                      Wash House
                                    </Badge>
                                  )}
                                </div>
                              )}
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
                          {(() => {
                            const filteredStages = getClientVisibleStagesForOrder(order);
                            return (
                          <div className="mt-6 overflow-x-auto py-1">
                            <div className="flex items-center min-w-max px-1">
                              {filteredStages.map((stage, index) => {
                                const normalizedCurrent = normalizeStage(order.current_stage);
                                const isActive = normalizedCurrent === stage.value;
                                const currentIndex = filteredStages.findIndex(s => s.value === normalizedCurrent);
                                const isPast = currentIndex > index;
                                const isInInternalStage = order.current_stage === 'not_started' || order.current_stage === 'sample';

                                return (
                                  <div key={stage.value} className="flex items-center">
                                    <div className="flex flex-col items-center gap-1.5">
                                      <div
                                        className={`
                                          flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold shrink-0
                                          ${isActive ? `${stage.color} text-white ring-2 ring-offset-2 ring-offset-background ring-primary` : ''}
                                          ${isPast && !isInInternalStage ? 'bg-primary text-primary-foreground' : ''}
                                          ${!isActive && (!isPast || isInInternalStage) ? 'bg-muted text-muted-foreground' : ''}
                                        `}
                                      >
                                        {isPast && !isInInternalStage ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                                      </div>
                                      <span className={`text-[10px] leading-none ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                        {STAGE_SHORT_LABELS[stage.value] || stage.label}
                                      </span>
                                    </div>
                                    {index < filteredStages.length - 1 && (
                                      <div className={`w-5 h-0.5 mx-0.5 mt-[-18px] ${isPast && !isInInternalStage ? 'bg-primary' : 'bg-muted'}`} />
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                            );
                          })()}

                          {/* Stage Images */}
                          {stageImagesByOrder[order.id] && (
                            <div className="mt-5 space-y-2">
                              <p className="text-sm font-medium">Stage Images</p>
                              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                                {CLIENT_STAGE_IMAGE_STAGES.filter((stage) => {
                                  if (stage === 'printing' && !order.has_printing) return false;
                                  if (stage === 'embroidery' && !order.has_embroidery) return false;
                                  if (stage === 'wash_house' && !order.has_wash_house) return false;
                                  return true;
                                }).map((stage) => {
                                  const image = stageImagesByOrder[order.id]?.[stage];
                                  return (
                                    <div key={stage} className="rounded-md border p-2">
                                      <p className="text-[11px] text-muted-foreground mb-1">
                                        {STAGE_IMAGE_LABELS[stage]}
                                      </p>
                                      {image?.signedUrl ? (
                                        <a href={image.signedUrl} target="_blank" rel="noreferrer">
                                          <img
                                            src={image.signedUrl}
                                            alt={`${STAGE_IMAGE_LABELS[stage]} update`}
                                            className="h-20 w-full rounded object-contain border bg-muted/30"
                                          />
                                        </a>
                                      ) : (
                                        <div className="h-20 w-full rounded border border-dashed flex items-center justify-center text-muted-foreground">
                                          <ImageIcon className="h-4 w-4" />
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recent Updates Preview */}
            {recentNotes.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Recent Updates
                    </CardTitle>
                    <CardDescription>Latest messages from your team</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/portal?tab=updates">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {recentNotes.slice(0, 4).map((note) => (
                      <div key={note.id} className="border-b pb-3 last:border-0 last:pb-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className="text-xs">
                            {(note.order as any)?.product_name || 'Order'}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(note.created_at), { addSuffix: true })}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-medium">
                            {(note as any).author_name || 'Team'}
                          </span>
                          {(note as any).author_role === 'admin' && (
                            <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">Admin</Badge>
                          )}
                          {(note as any).author_role === 'team' && (
                            <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Team</Badge>
                          )}
                          {(note as any).author_role === 'client' && (
                            <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">Client</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{note.content}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Recent Invoices Preview */}
            {clientInvoices.length > 0 && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      Recent Invoices
                    </CardTitle>
                    <CardDescription>Your latest invoices</CardDescription>
                  </div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/portal?tab=invoices">View All <ArrowRight className="ml-1 h-4 w-4" /></Link>
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {clientInvoices.slice(0, 3).map((invoice) => (
                      <div
                        key={invoice.id}
                        className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                        onClick={() => {
                          setSelectedInvoice(invoice);
                          setInvoiceViewerOpen(true);
                        }}
                      >
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-sm font-medium">{invoice.invoice_number}</p>
                            <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                              {INVOICE_STATUS_LABELS[invoice.status]}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{invoice.order_name}</p>
                        </div>
                        <span className="text-sm font-semibold shrink-0">
                          €{(invoice.wholesale_price * invoice.quantity).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeTab === 'active' && (
          <div className="space-y-4">
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
                  const progress = getClientStageProgressForOrder(order.current_stage, order);
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
                            {/* Process Types */}
                            {(order.has_printing || order.has_embroidery || order.has_wash_house) && (
                              <div className="flex flex-wrap gap-1.5 mt-2">
                                {order.has_printing && (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1 px-2 py-0.5">
                                    <Printer className="h-3 w-3 text-blue-500" />
                                    Printing
                                  </Badge>
                                )}
                                {order.has_embroidery && (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1 px-2 py-0.5">
                                    <Sparkles className="h-3 w-3 text-purple-500" />
                                    Embroidery
                                  </Badge>
                                )}
                                {order.has_wash_house && (
                                  <Badge variant="outline" className="text-xs flex items-center gap-1 px-2 py-0.5">
                                    <Waves className="h-3 w-3 text-cyan-500" />
                                    Wash House
                                  </Badge>
                                )}
                              </div>
                            )}
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

                        {/* Stage Progress Visualization - Client View */}
                        {(() => {
                          const filteredStages = getClientVisibleStagesForOrder(order);
                          return (
                        <div className="mt-6 overflow-x-auto py-1">
                          <div className="flex items-center min-w-max px-1">
                            {filteredStages.map((stage, index) => {
                              const normalizedCurrent = normalizeStage(order.current_stage);
                              const isActive = normalizedCurrent === stage.value;
                              const currentIndex = filteredStages.findIndex(s => s.value === normalizedCurrent);
                              const isPast = currentIndex > index;
                              const isInInternalStage = order.current_stage === 'not_started' || order.current_stage === 'sample';

                              return (
                                <div key={stage.value} className="flex items-center">
                                  <div className="flex flex-col items-center gap-1.5">
                                    <div
                                      className={`
                                        flex items-center justify-center w-9 h-9 rounded-full text-xs font-semibold shrink-0
                                        ${isActive ? `${stage.color} text-white ring-2 ring-offset-2 ring-offset-background ring-primary` : ''}
                                        ${isPast && !isInInternalStage ? 'bg-primary text-primary-foreground' : ''}
                                        ${!isActive && (!isPast || isInInternalStage) ? 'bg-muted text-muted-foreground' : ''}
                                      `}
                                    >
                                      {isPast && !isInInternalStage ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                                    </div>
                                    <span className={`text-[10px] leading-none ${isActive ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                                      {STAGE_SHORT_LABELS[stage.value] || stage.label}
                                    </span>
                                  </div>
                                  {index < filteredStages.length - 1 && (
                                    <div className={`w-5 h-0.5 mx-0.5 mt-[-18px] ${isPast && !isInInternalStage ? 'bg-primary' : 'bg-muted'}`} />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                          );
                        })()}

                        {stageImagesByOrder[order.id] && (
                          <div className="mt-5 space-y-2">
                            <p className="text-sm font-medium">Stage Images</p>
                            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                              {CLIENT_STAGE_IMAGE_STAGES.filter((stage) => {
                                if (stage === 'printing' && !order.has_printing) return false;
                                if (stage === 'embroidery' && !order.has_embroidery) return false;
                                if (stage === 'wash_house' && !order.has_wash_house) return false;
                                return true;
                              }).map((stage) => {
                                const image = stageImagesByOrder[order.id]?.[stage];
                                return (
                                  <div key={stage} className="rounded-md border p-2">
                                    <p className="text-[11px] text-muted-foreground mb-1">
                                      {STAGE_IMAGE_LABELS[stage]}
                                    </p>
                                    {image?.signedUrl ? (
                                      <a href={image.signedUrl} target="_blank" rel="noreferrer">
                                        <img
                                          src={image.signedUrl}
                                          alt={`${STAGE_IMAGE_LABELS[stage]} update`}
                                          className="h-20 w-full rounded object-contain border bg-muted/30"
                                        />
                                      </a>
                                    ) : (
                                      <div className="h-20 w-full rounded border border-dashed flex items-center justify-center text-muted-foreground">
                                        <ImageIcon className="h-4 w-4" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div>
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
          </div>
        )}

        {activeTab === 'updates' && (
          <div className="space-y-4">
            {/* Send Message Form */}
            {orders.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Send className="h-4 w-4" />
                    Send a Message
                  </CardTitle>
                  <CardDescription>
                    Send a message to your production team about an order
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Select value={selectedOrderId} onValueChange={setSelectedOrderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select an order..." />
                    </SelectTrigger>
                    <SelectContent>
                      {orders.map((order) => (
                        <SelectItem key={order.id} value={order.id}>
                          {order.order_number} — {(order as any).product_name || 'Order'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Textarea
                    placeholder="Type your message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="min-h-[80px] resize-none"
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim() || !selectedOrderId || isSendingMessage}
                    >
                      <Send className="mr-2 h-4 w-4" />
                      {isSendingMessage ? 'Sending...' : 'Send Message'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Messages List */}
            {recentNotes.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No messages yet. Send one above!</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5" />
                    Messages
                  </CardTitle>
                  <CardDescription>
                    Conversations with your production team
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
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium">
                              {(note as any).author_name || 'Team'}
                            </span>
                            {(note as any).author_role === 'admin' && (
                              <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">Admin</Badge>
                            )}
                            {(note as any).author_role === 'team' && (
                              <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Team</Badge>
                            )}
                            {(note as any).author_role === 'client' && (
                              <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">Client</Badge>
                            )}
                          </div>
                          <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'invoices' && (
          <div>
            {clientInvoices.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">No invoices available yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {clientInvoices.map((invoice) => (
                  <Card 
                    key={invoice.id} 
                    className="cursor-pointer hover:bg-accent/50 transition-colors"
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setInvoiceViewerOpen(true);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-medium text-sm">{invoice.invoice_number}</p>
                            <Badge className={INVOICE_STATUS_COLORS[invoice.status]}>
                              {INVOICE_STATUS_LABELS[invoice.status]}
                            </Badge>
                          </div>
                          {invoice.order && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {invoice.order.product_name}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(invoice.created_at), 'MMM d, yyyy')}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-sm font-semibold">
                              ₺{(invoice.wholesale_price * invoice.quantity).toLocaleString()}
                            </span>
                            <Button variant="ghost" size="sm">
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Invoice Viewer Dialog */}
      <InvoiceViewer
        invoice={selectedInvoice}
        open={invoiceViewerOpen}
        onOpenChange={setInvoiceViewerOpen}
        isClientView={true}
      />
    </DashboardLayout>
  );
}
