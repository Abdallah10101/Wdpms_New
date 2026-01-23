import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Order } from '@/lib/types';
import { PRODUCTION_STAGES } from '@/lib/types';

interface OrderUpdate {
  id: string;
  order_number: string;
  product_name: string;
  old_stage?: string;
  new_stage: string;
  timestamp: Date;
}

export function useRealtimeOrders(clientId?: string) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [recentUpdates, setRecentUpdates] = useState<OrderUpdate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrders = useCallback(async () => {
    try {
      let query = supabase
        .from('orders')
        .select('*, client:clients(id, name, brand_name)')
        .order('created_at', { ascending: false });
      
      if (clientId) {
        query = query.eq('client_id', clientId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      setOrders((data || []) as Order[]);
    } catch (error) {
      console.error('Error fetching orders:', error);
      toast({
        title: 'Error',
        description: 'Failed to load orders.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => {
    fetchOrders();

    // Subscribe to realtime changes
    const channel = supabase
      .channel(`orders-${clientId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders',
          ...(clientId ? { filter: `client_id=eq.${clientId}` } : {}),
        },
        (payload) => {
          const eventType = payload.eventType;
          
          if (eventType === 'INSERT') {
            const newOrder = payload.new as Order;
            setOrders(prev => [newOrder, ...prev]);
            
            // Add to recent updates
            setRecentUpdates(prev => [{
              id: newOrder.id,
              order_number: newOrder.order_number,
              product_name: newOrder.product_name,
              new_stage: newOrder.current_stage,
              timestamp: new Date(),
            }, ...prev].slice(0, 10));
            
            toast({
              title: 'New Order',
              description: `Order ${newOrder.order_number} has been created`,
            });
          } 
          else if (eventType === 'UPDATE') {
            const updatedOrder = payload.new as Order;
            const oldOrder = payload.old as Partial<Order>;
            
            setOrders(prev => 
              prev.map(o => o.id === updatedOrder.id ? { ...o, ...updatedOrder } : o)
            );
            
            // Track stage changes
            if (oldOrder.current_stage !== updatedOrder.current_stage) {
              const stageName = PRODUCTION_STAGES.find(s => s.value === updatedOrder.current_stage)?.label;
              
              setRecentUpdates(prev => [{
                id: updatedOrder.id,
                order_number: updatedOrder.order_number,
                product_name: updatedOrder.product_name,
                old_stage: oldOrder.current_stage,
                new_stage: updatedOrder.current_stage,
                timestamp: new Date(),
              }, ...prev].slice(0, 10));
              
              toast({
                title: 'Order Updated',
                description: `${updatedOrder.product_name} moved to ${stageName}`,
              });
            }
          } 
          else if (eventType === 'DELETE') {
            const deletedOrder = payload.old as Order;
            setOrders(prev => prev.filter(o => o.id !== deletedOrder.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [clientId, fetchOrders, toast]);

  return {
    orders,
    recentUpdates,
    isLoading,
    refetch: fetchOrders,
  };
}
