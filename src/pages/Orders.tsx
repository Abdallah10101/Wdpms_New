import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, ArrowLeft, Package } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameMonth } from 'date-fns';
import type { Order, Client } from '@/lib/types';
import { ClientCard } from '@/components/orders/ClientCard';
import { OrderKanban } from '@/components/orders/OrderKanban';
import { ClientLogoUpload } from '@/components/orders/ClientLogoUpload';
import { MonthSelector } from '@/components/orders/MonthSelector';
import { LiveActivityFeed } from '@/components/orders/LiveActivityFeed';
import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';

export default function Orders() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<Date | null>(null);
  const [logoUploadClient, setLogoUploadClient] = useState<Client | null>(null);

  // Use realtime hook for orders
  const { orders, recentUpdates, isLoading: ordersLoading, refetch } = useRealtimeOrders(
    selectedClient?.id
  );

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

  const getOrderCountForClient = (clientId: string) => {
    return orders.filter(o => o.client_id === clientId).length;
  };

  const getOrdersForClient = (clientId: string) => {
    return orders.filter(o => o.client_id === clientId);
  };

  const getOrdersForMonth = (month: Date) => {
    return orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return isSameMonth(orderDate, month);
    });
  };

  const filteredClients = clients.filter((client) => {
    const searchLower = searchQuery.toLowerCase();
    return (
      client.name.toLowerCase().includes(searchLower) ||
      client.brand_name?.toLowerCase().includes(searchLower)
    );
  });

  const handleLogoClick = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setLogoUploadClient(client);
  };

  const handleBackClick = () => {
    if (selectedMonth) {
      setSelectedMonth(null);
    } else {
      setSelectedClient(null);
    }
  };

  const getHeaderTitle = () => {
    if (selectedClient && selectedMonth) {
      return `${selectedClient.brand_name || selectedClient.name} - ${format(selectedMonth, 'MMMM yyyy')}`;
    }
    if (selectedClient) {
      return selectedClient.brand_name || selectedClient.name;
    }
    return 'Orders';
  };

  const getHeaderSubtitle = () => {
    if (selectedClient && selectedMonth) {
      const monthOrders = getOrdersForMonth(selectedMonth);
      return `${monthOrders.length} orders`;
    }
    if (selectedClient) {
      const clientOrders = getOrdersForClient(selectedClient.id);
      return `${clientOrders.length} orders total - Select a month`;
    }
    return 'Select a client to view orders';
  };

  if (authLoading || !user) {
    return null;
  }

  const clientOrders = selectedClient ? getOrdersForClient(selectedClient.id) : [];
  const monthOrders = selectedMonth ? getOrdersForMonth(selectedMonth) : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            {(selectedClient || selectedMonth) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleBackClick}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
            )}
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                {getHeaderTitle()}
              </h1>
              <p className="text-muted-foreground">
                {getHeaderSubtitle()}
              </p>
            </div>
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

        {/* Live Activity Feed - Show when client is selected */}
        {selectedClient && recentUpdates.length > 0 && (
          <LiveActivityFeed updates={recentUpdates} />
        )}

        {/* Search - Only show on client selection view */}
        {!selectedClient && (
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {/* Content */}
        {isLoading || ordersLoading ? (
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {[...Array(8)].map((_, i) => (
              <Skeleton key={i} className="aspect-[4/3]" />
            ))}
          </div>
        ) : selectedClient && selectedMonth ? (
          /* Kanban Board View - Filtered by month */
          <OrderKanban orders={monthOrders} onOrderUpdated={refetch} />
        ) : selectedClient ? (
          /* Month Selection View */
          <MonthSelector orders={clientOrders} onSelectMonth={setSelectedMonth} />
        ) : filteredClients.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center py-12">
            <Package className="h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              {searchQuery ? 'No clients match your search' : 'No clients found'}
            </p>
          </div>
        ) : (
          /* Client Cards Grid */
          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                orderCount={getOrderCountForClient(client.id)}
                onClick={() => setSelectedClient(client)}
                onLogoClick={(e) => handleLogoClick(e, client)}
                isAdmin={role === 'admin'}
              />
            ))}
          </div>
        )}
      </div>

      {/* Logo Upload Dialog */}
      <ClientLogoUpload
        client={logoUploadClient}
        open={!!logoUploadClient}
        onOpenChange={(open) => !open && setLogoUploadClient(null)}
        onSuccess={fetchClients}
      />
    </DashboardLayout>
  );
}
