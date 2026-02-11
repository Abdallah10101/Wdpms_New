import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { OrderKanban } from './OrderKanban';
import { type Order } from '@/lib/types';
import { Package, Clock, CheckCircle2 } from 'lucide-react';

interface OrderMonthViewProps {
  orders: Order[];
  clientId: string;
  month: Date;
  onOrderUpdated?: () => void;
}

export function OrderMonthView({ orders, onOrderUpdated }: OrderMonthViewProps) {
  const navigate = useNavigate();

  const activeOrders = orders.filter((o) => o.current_stage !== 'delivered');
  const completedOrders = orders.filter((o) => o.current_stage === 'delivered');

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
        <TabsTrigger value="completed" className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          Completed
          {completedOrders.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {completedOrders.length}
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

      <TabsContent value="completed" className="space-y-4">
        {completedOrders.length > 0 ? (
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
                  <Badge className="bg-emerald-500 text-white shrink-0">Delivered</Badge>
                </div>
                <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Qty: {order.quantity}</span>
                  {order.pieces_sent && <span>Sent: {order.pieces_sent}</span>}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-8">
            <div className="flex flex-col items-center justify-center text-center">
              <CheckCircle2 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                No completed orders for this month yet
              </p>
              <p className="text-sm text-muted-foreground">
                Orders will appear here when they are marked as delivered
              </p>
            </div>
          </Card>
        )}
      </TabsContent>
    </Tabs>
  );
}
