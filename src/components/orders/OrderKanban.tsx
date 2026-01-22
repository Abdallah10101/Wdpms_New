import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { PRODUCTION_STAGES, type Order, type ProductionStage } from '@/lib/types';

interface OrderKanbanProps {
  orders: Order[];
}

export function OrderKanban({ orders }: OrderKanbanProps) {
  const navigate = useNavigate();

  const getOrdersByStage = (stage: ProductionStage) => {
    return orders.filter(order => order.current_stage === stage);
  };

  return (
    <ScrollArea className="w-full">
      <div className="flex gap-4 pb-4 min-w-max">
        {PRODUCTION_STAGES.map((stage) => {
          const stageOrders = getOrdersByStage(stage.value);
          
          return (
            <div
              key={stage.value}
              className="flex-shrink-0 w-[280px] flex flex-col"
            >
              {/* Stage Header */}
              <div className="flex items-center gap-2 mb-3">
                <Badge className={`${stage.color} text-white`}>
                  {stage.label}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {stageOrders.length}
                </span>
              </div>

              {/* Orders Column */}
              <div className="flex-1 space-y-2 min-h-[200px] bg-muted/20 rounded-lg p-2">
                {stageOrders.length === 0 ? (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                    No orders
                  </div>
                ) : (
                  stageOrders.map((order) => (
                    <Card
                      key={order.id}
                      className="p-3 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all bg-card"
                      onClick={() => navigate(`/orders/${order.id}`)}
                    >
                      <div className="space-y-1">
                        <p className="font-medium text-sm truncate">
                          {order.product_name}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {order.order_number}
                        </p>
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-xs text-muted-foreground">
                            Qty: {order.quantity}
                          </span>
                          {order.pieces_sent && order.pieces_sent > 0 && (
                            <span className="text-xs text-emerald-500">
                              Sent: {order.pieces_sent}
                            </span>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
