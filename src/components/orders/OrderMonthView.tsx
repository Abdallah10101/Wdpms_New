import { useState, useEffect } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { OrderKanban } from './OrderKanban';
import { PRODUCTION_STAGES, type Order } from '@/lib/types';
import { format } from 'date-fns';
import { Package, Clock, CheckCircle2, FileText, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface ArchivedFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  archived_at: string;
  order_number: string | null;
  order_id: string | null;
}

interface ArchivedOrder {
  order_id: string;
  order_number: string;
  files: ArchivedFile[];
}

interface OrderMonthViewProps {
  orders: Order[];
  clientId: string;
  month: Date;
  onOrderUpdated?: () => void;
}

export function OrderMonthView({ orders, clientId, month, onOrderUpdated }: OrderMonthViewProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [archivedFiles, setArchivedFiles] = useState<ArchivedFile[]>([]);
  const [isLoadingArchive, setIsLoadingArchive] = useState(true);

  // Split orders into active (production) and completed
  const activeOrders = orders.filter(o => o.current_stage !== 'delivered');
  const completedOrders = orders.filter(o => o.current_stage === 'delivered');

  const deliveryMonth = format(month, 'yyyy-MM');

  useEffect(() => {
    fetchArchivedFiles();
  }, [clientId, deliveryMonth]);

  const fetchArchivedFiles = async () => {
    setIsLoadingArchive(true);
    try {
      const { data, error } = await supabase
        .from('client_archive_files')
        .select('*')
        .eq('client_id', clientId)
        .eq('delivery_month', deliveryMonth)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      setArchivedFiles(data || []);
    } catch (error) {
      console.error('Error fetching archived files:', error);
    } finally {
      setIsLoadingArchive(false);
    }
  };

  // Group archived files by order
  const archivedByOrder = archivedFiles.reduce<Record<string, ArchivedOrder>>((acc, file) => {
    const key = file.order_id || 'unknown';
    if (!acc[key]) {
      acc[key] = {
        order_id: file.order_id || '',
        order_number: file.order_number || 'Unknown Order',
        files: []
      };
    }
    acc[key].files.push(file);
    return acc;
  }, {});

  const handleDownload = async (file: ArchivedFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-files')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: 'Download Error',
        description: 'Failed to download file.',
        variant: 'destructive',
      });
    }
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'design': return 'bg-purple-500';
      case 'tech_pack': return 'bg-blue-500';
      case 'photo': return 'bg-pink-500';
      case 'invoice': return 'bg-emerald-500';
      case 'shipping': return 'bg-orange-500';
      default: return 'bg-muted-foreground';
    }
  };

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'design': return 'Design';
      case 'tech_pack': return 'Tech Pack';
      case 'photo': return 'Photo';
      case 'invoice': return 'Invoice';
      case 'shipping': return 'Shipping';
      default: return 'Other';
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Tabs defaultValue="production" className="space-y-4">
      <TabsList className="grid w-full max-w-md grid-cols-2">
        <TabsTrigger value="production" className="flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Production
          {activeOrders.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeOrders.length}
            </Badge>
          )}
        </TabsTrigger>
        <TabsTrigger value="previous" className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Previous Work
          {(completedOrders.length > 0 || Object.keys(archivedByOrder).length > 0) && (
            <Badge variant="secondary" className="ml-1">
              {completedOrders.length + Object.keys(archivedByOrder).length}
            </Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="production" className="space-y-4">
        {activeOrders.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No active orders in production for this month
              </p>
            </div>
          </Card>
        ) : (
          <OrderKanban orders={activeOrders} onOrderUpdated={onOrderUpdated} />
        )}
      </TabsContent>

      <TabsContent value="previous" className="space-y-4">
        {/* Completed orders still in current view (not yet archived or recently delivered) */}
        {completedOrders.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Recently Completed</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {completedOrders.map((order) => (
                <Card
                  key={order.id}
                  className="p-4 cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => navigate(`/orders/${order.id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{order.product_name}</p>
                      <p className="text-sm text-muted-foreground">{order.order_number}</p>
                    </div>
                    <Badge className="bg-emerald-500 text-white shrink-0">
                      Delivered
                    </Badge>
                  </div>
                  <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Qty: {order.quantity}</span>
                    {order.pieces_sent && <span>Sent: {order.pieces_sent}</span>}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Archived files grouped by order */}
        {isLoadingArchive ? (
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          </div>
        ) : Object.keys(archivedByOrder).length > 0 ? (
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground">Archived Orders</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              {Object.values(archivedByOrder).map((archivedOrder) => (
                <Card key={archivedOrder.order_id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-medium">{archivedOrder.order_number}</p>
                      <p className="text-sm text-muted-foreground">
                        {archivedOrder.files.length} file{archivedOrder.files.length !== 1 ? 's' : ''} archived
                      </p>
                    </div>
                    {archivedOrder.order_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/orders/${archivedOrder.order_id}`)}
                      >
                        View Order
                      </Button>
                    )}
                  </div>
                  <ScrollArea className="h-32">
                    <div className="space-y-2">
                      {archivedOrder.files.map((file) => (
                        <div
                          key={file.id}
                          className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm truncate">{file.file_name}</p>
                              <div className="flex items-center gap-2">
                                <Badge className={`${getCategoryColor(file.category)} text-white text-xs`}>
                                  {getCategoryLabel(file.category)}
                                </Badge>
                                {file.file_size && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatFileSize(file.file_size)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownload(file);
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </Card>
              ))}
            </div>
          </div>
        ) : completedOrders.length === 0 ? (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No completed orders for this month yet
              </p>
              <p className="text-sm text-muted-foreground">
                Orders will appear here when they're marked as delivered
              </p>
            </div>
          </Card>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
