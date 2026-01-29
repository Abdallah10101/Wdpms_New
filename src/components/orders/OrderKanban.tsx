import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
// NOTE: Avoid nested scroll containers with @hello-pangea/dnd
import { useNavigate } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PRODUCTION_STAGES, type Order, type ProductionStage } from '@/lib/types';
import { Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OrderKanbanProps {
  orders: Order[];
  onOrderUpdated?: () => void;
}

export function OrderKanban({ orders, onOrderUpdated }: OrderKanbanProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

    const newStageValue = destination.droppableId;
    const orderId = draggableId;

    // Validate the stage is a valid production stage value.
    // Some drag/drop edge-cases can surface the *label* (e.g. "Not Started");
    // map it back to the enum value to keep the action reliable.
    const validStage =
      PRODUCTION_STAGES.find(s => s.value === newStageValue) ||
      PRODUCTION_STAGES.find(s => s.label === newStageValue) ||
      PRODUCTION_STAGES.find(s => s.label.toLowerCase() === String(newStageValue).toLowerCase());
    if (!validStage) {
      console.error('Invalid stage value:', newStageValue);
      toast({
        title: 'Error',
        description: 'Invalid stage value.',
        variant: 'destructive',
      });
      return;
    }

    const newStage = validStage.value;

    try {
      const { error } = await supabase
        .from('orders')
        .update({ current_stage: newStage })
        .eq('id', orderId);

      if (error) throw error;

      toast({
        title: 'Stage Updated',
        description: `Order moved to ${validStage.label}`,
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

  const handleDeleteOrder = async () => {
    if (!orderToDelete || isDeleting) return;
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from('orders')
        .delete()
        .eq('id', orderToDelete.id);

      if (error) throw error;

      toast({
        title: 'Order Deleted',
        description: `${orderToDelete.product_name} has been removed.`,
      });

      setDeleteDialogOpen(false);
      setOrderToDelete(null);
      onOrderUpdated?.();
    } catch (error) {
      console.error('Error deleting order:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete order.',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (e: React.MouseEvent, order: Order) => {
    e.stopPropagation();
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  return (
    <>
      <div className="w-full overflow-x-auto">
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
                                  className={`group p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/50 transition-all bg-card ${
                                    snapshot.isDragging ? 'shadow-lg ring-2 ring-primary/30' : ''
                                  }`}
                                  onClick={() => !snapshot.isDragging && navigate(`/orders/${order.id}`)}
                                >
                                  <div className="space-y-1 relative">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className="font-medium text-sm truncate flex-1">
                                        {order.product_name}
                                      </p>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-opacity flex-shrink-0 -mr-1 -mt-1"
                                        onClick={(e) => confirmDelete(e, order)}
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
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
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Order</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{orderToDelete?.product_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
