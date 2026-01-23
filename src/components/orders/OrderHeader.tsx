import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, ArrowLeft, Calendar, Flag } from 'lucide-react';
import { format } from 'date-fns';
import {
  PRODUCTION_STAGES,
  PRIORITY_CONFIG,
  type Order,
  type ProductionStage,
  type OrderPriority,
} from '@/lib/types';

interface OrderHeaderProps {
  order: Order;
  canEdit: boolean;
  isUpdating: boolean;
  onBack: () => void;
  onStageChange: (stage: ProductionStage) => void;
  onPriorityChange: (priority: OrderPriority) => void;
}

export function OrderHeader({
  order,
  canEdit,
  isUpdating,
  onBack,
  onStageChange,
  onPriorityChange,
}: OrderHeaderProps) {
  const stageConfig = PRODUCTION_STAGES.find(s => s.value === order.current_stage) || PRODUCTION_STAGES[0];
  const priorityConfig = PRIORITY_CONFIG.find(p => p.value === order.priority) || PRIORITY_CONFIG[1];

  return (
    <div className="space-y-4">
      {/* Back Button */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
        <ArrowLeft className="h-4 w-4" />
        Back to Orders
      </Button>

      {/* Title */}
      <div className="flex items-start gap-3">
        <Package className="h-8 w-8 text-primary mt-1" />
        <div className="flex-1">
          <h1 className="text-3xl font-bold tracking-tight">{order.product_name}</h1>
          <p className="text-muted-foreground mt-1">{order.order_number}</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex flex-wrap items-center gap-4 py-3 border-b">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Package className="h-4 w-4" />
            Status
          </span>
          {canEdit ? (
            <Select
              value={order.current_stage}
              onValueChange={(value) => onStageChange(value as ProductionStage)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-auto h-8 gap-2">
                <Badge className={`${stageConfig.color} text-white`}>
                  {stageConfig.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {PRODUCTION_STAGES.map((stage) => (
                  <SelectItem key={stage.value} value={stage.value}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${stage.color}`} />
                      {stage.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge className={`${stageConfig.color} text-white`}>
              {stageConfig.label}
            </Badge>
          )}
        </div>

        {/* Priority */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Flag className="h-4 w-4" />
            Priority
          </span>
          {canEdit ? (
            <Select
              value={order.priority}
              onValueChange={(value) => onPriorityChange(value as OrderPriority)}
              disabled={isUpdating}
            >
              <SelectTrigger className="w-auto h-8 gap-2">
                <Badge className={`${priorityConfig.color} text-white`}>
                  {priorityConfig.label}
                </Badge>
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_CONFIG.map((priority) => (
                  <SelectItem key={priority.value} value={priority.value}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${priority.color}`} />
                      {priority.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge className={`${priorityConfig.color} text-white`}>
              {priorityConfig.label}
            </Badge>
          )}
        </div>

        {/* Due Date */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground flex items-center gap-1">
            <Calendar className="h-4 w-4" />
            Due Date
          </span>
          <span className="text-sm font-medium">
            {order.delivery_date
              ? format(new Date(order.delivery_date), 'MMM d, yyyy')
              : 'Empty'}
          </span>
        </div>
      </div>
    </div>
  );
}
