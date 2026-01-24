import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import {
  FolderOpen,
  Folder,
  FileText,
  Download,
  Search,
  ArrowLeft,
  Calendar,
  Package,
  Building2,
  ChevronRight,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import type { Client } from '@/lib/types';

interface ArchivedFile {
  id: string;
  client_id: string;
  order_id: string | null;
  original_file_id: string | null;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  archived_at: string;
  order_number: string | null;
  delivery_month: string | null;
}

interface MonthGroup {
  month: string;
  label: string;
  files: ArchivedFile[];
  orders: Set<string>;
}

export default function ClientFiles() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [archivedFiles, setArchivedFiles] = useState<ArchivedFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && role) {
      fetchClients();
    }
  }, [user, role]);

  useEffect(() => {
    if (selectedClient) {
      fetchArchivedFiles(selectedClient.id);
    }
  }, [selectedClient]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('brand_name');

      if (error) throw error;
      setClients((data || []) as Client[]);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast({
        title: 'Error',
        description: 'Failed to load clients.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchArchivedFiles = async (clientId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_archive_files')
        .select('*')
        .eq('client_id', clientId)
        .order('archived_at', { ascending: false });

      if (error) throw error;
      setArchivedFiles((data || []) as ArchivedFile[]);
    } catch (error) {
      console.error('Error fetching archived files:', error);
      toast({
        title: 'Error',
        description: 'Failed to load archived files.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (file: ArchivedFile) => {
    setDownloadingFile(file.id);
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

      toast({
        title: 'Download started',
        description: `Downloading ${file.file_name}`,
      });
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: 'Download failed',
        description: 'Could not download the file.',
        variant: 'destructive',
      });
    } finally {
      setDownloadingFile(null);
    }
  };

  const getFileCountForClient = (clientId: string) => {
    return archivedFiles.filter((f) => f.client_id === clientId).length;
  };

  const getMonthGroups = (): MonthGroup[] => {
    const groups = new Map<string, MonthGroup>();

    archivedFiles.forEach((file) => {
      const month = file.delivery_month || 'unknown';
      if (!groups.has(month)) {
        let label = 'Unknown';
        if (month !== 'unknown') {
          try {
            label = format(parseISO(`${month}-01`), 'MMMM yyyy');
          } catch {
            label = month;
          }
        }
        groups.set(month, {
          month,
          label,
          files: [],
          orders: new Set(),
        });
      }
      const group = groups.get(month)!;
      group.files.push(file);
      if (file.order_number) {
        group.orders.add(file.order_number);
      }
    });

    return Array.from(groups.values()).sort((a, b) =>
      b.month.localeCompare(a.month)
    );
  };

  const getFilesForMonth = (month: string) => {
    return archivedFiles.filter((f) => f.delivery_month === month);
  };

  const getOrdersInMonth = (month: string) => {
    const files = getFilesForMonth(month);
    const orders = new Map<string, ArchivedFile[]>();
    files.forEach((file) => {
      const orderNum = file.order_number || 'No Order';
      if (!orders.has(orderNum)) {
        orders.set(orderNum, []);
      }
      orders.get(orderNum)!.push(file);
    });
    return orders;
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.brand_name?.toLowerCase().includes(searchLower)
    );
  });

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return 'Unknown size';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getCategoryColor = (category: string | null) => {
    switch (category) {
      case 'invoice_1':
        return 'bg-blue-500/10 text-blue-500';
      case 'invoice_2':
        return 'bg-green-500/10 text-green-500';
      case 'tech_pack':
        return 'bg-purple-500/10 text-purple-500';
      case 'design':
        return 'bg-orange-500/10 text-orange-500';
      case 'photo':
        return 'bg-pink-500/10 text-pink-500';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case 'invoice_1':
        return 'Cost Invoice';
      case 'invoice_2':
        return 'Client Invoice';
      case 'tech_pack':
        return 'Tech Pack';
      case 'design':
        return 'Design';
      case 'photo':
        return 'Photo';
      default:
        return category || 'Other';
    }
  };

  const handleBackClick = () => {
    if (selectedMonth) {
      setSelectedMonth(null);
    } else {
      setSelectedClient(null);
      setArchivedFiles([]);
    }
  };

  if (authLoading || !user) {
    return null;
  }

  const monthGroups = getMonthGroups();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            {(selectedClient || selectedMonth) && (
              <Button variant="ghost" size="icon" onClick={handleBackClick}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {selectedClient && selectedMonth
                  ? `${selectedClient.brand_name || selectedClient.name} - ${
                      monthGroups.find((m) => m.month === selectedMonth)?.label ||
                      selectedMonth
                    }`
                  : selectedClient
                  ? selectedClient.brand_name || selectedClient.name
                  : 'Client Files'}
              </h1>
              <p className="text-muted-foreground">
                {selectedClient && selectedMonth
                  ? `${getFilesForMonth(selectedMonth).length} files`
                  : selectedClient
                  ? 'Select a month to view archived files'
                  : 'Archived files organized by client'}
              </p>
            </div>
          </div>
        </div>

        {/* Search - only show on client list */}
        {!selectedClient && (
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        )}

        {/* Client list view */}
        {!isLoading && !selectedClient && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredClients.map((client) => (
              <Card
                key={client.id}
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                onClick={() => setSelectedClient(client)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    {client.logo_url ? (
                      <img
                        src={client.logo_url}
                        alt={client.brand_name || client.name}
                        className="h-10 w-10 rounded-md object-contain"
                      />
                    ) : (
                      <Building2 className="h-6 w-6 text-primary" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">
                      {client.brand_name || client.name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Click to view archived files
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}

            {filteredClients.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No clients found</h3>
                <p className="text-muted-foreground">
                  {searchQuery
                    ? 'Try adjusting your search'
                    : 'No clients have been created yet'}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Month list view */}
        {!isLoading && selectedClient && !selectedMonth && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {monthGroups.map((group) => (
              <Card
                key={group.month}
                className="cursor-pointer transition-all hover:border-primary/50 hover:shadow-md"
                onClick={() => setSelectedMonth(group.month)}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Calendar className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold">{group.label}</h3>
                    <p className="text-sm text-muted-foreground">
                      {group.files.length} files · {group.orders.size} orders
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}

            {monthGroups.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No archived files</h3>
                <p className="text-muted-foreground">
                  Files will appear here when orders are marked as delivered
                </p>
              </div>
            )}
          </div>
        )}

        {/* Files view - grouped by order */}
        {!isLoading && selectedClient && selectedMonth && (
          <div className="space-y-6">
            {Array.from(getOrdersInMonth(selectedMonth).entries()).map(
              ([orderNumber, files]) => (
                <Card key={orderNumber}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{orderNumber}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {files.length} files
                        </p>
                      </div>
                      {files[0]?.order_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="ml-auto"
                          onClick={() => navigate(`/orders/${files[0].order_id}`)}
                        >
                          View Order
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <ScrollArea className="max-h-[300px]">
                      <div className="space-y-2">
                        {files.map((file) => (
                          <div
                            key={file.id}
                            className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50"
                          >
                            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                              <FileText className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">
                                {file.file_name}
                              </p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{formatFileSize(file.file_size)}</span>
                                <span>·</span>
                                <span>
                                  {format(
                                    new Date(file.archived_at),
                                    'MMM d, yyyy'
                                  )}
                                </span>
                              </div>
                            </div>
                            <Badge
                              variant="secondary"
                              className={getCategoryColor(file.category)}
                            >
                              {getCategoryLabel(file.category)}
                            </Badge>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDownload(file)}
                              disabled={downloadingFile === file.id}
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </CardContent>
                </Card>
              )
            )}

            {getFilesForMonth(selectedMonth).length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FolderOpen className="h-12 w-12 text-muted-foreground/50" />
                <h3 className="mt-4 text-lg font-semibold">No files</h3>
                <p className="text-muted-foreground">
                  No files were archived for this month
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
