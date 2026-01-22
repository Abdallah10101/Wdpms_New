import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PRODUCTION_STAGES, type Order, type ProductionStage } from '@/lib/types';

interface OrderKanbanProps {
  orders: Order[];
  onOrderUpdated?: () => void;
}

export function OrderKanban({ orders, onOrderUpdated }: OrderKanbanProps) {
  const navigate = useNavigate();
  const { toast } = useToast();

  const getOrdersByStage = (stage: ProductionStage) => {
    return orders.filter(order => order.current_stage === stage);
  };

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a droppable area
    if (!destination) return;

    // Dropped in the same position
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    const newStage = destination.droppableId as ProductionStage;
    const orderId = draggableId;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ current_stage: newStage })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Stage Updated',
        description: `Order moved to ${PRODUCTION_STAGES.find(s => s.value === newStage)?.label}`,
      });

      onOrderUpdated?.();
    } catch (error) {
      console.error('Error updating order stage:', error);
      toast({
        title: 'Error',
        description: 'Failed to update order stage.',
        variant: 'destructive',
      });
    }
  };

  return (
    <ScrollArea className="w-full">
      <DragDropContext onDragEnd={handleDragEnd}>
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

                {/* Orders Column - Droppable */}
                <Droppable droppableId={stage.value}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-1 space-y-2 min-h-[200px] rounded-lg p-2 transition-colors ${
                        snapshot.isDraggingOver ? 'bg-primary/10 border-2 border-dashed border-primary/30' : 'bg-muted/20'
                      }`}
                    >
                      {stageOrders.length === 0 && !snapshot.isDraggingOver ? (
                        <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
                          No orders
                        </div>
                      ) : (
                        stageOrders.map((order, index) => (
                          <Draggable key={order.id} draggableId={order.id} index={index}>
                            {(provided, snapshot) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/50 transition-all bg-card ${
                                  snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''
                                }`}
                                onClick={() => !snapshot.isDragging && navigate(`/orders/${order.id}`)}
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
                            )}
                          </Draggable>
                        ))
                      )}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  );
}
