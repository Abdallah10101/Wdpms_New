import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Package, ArrowLeft, Calendar, Flag, Pencil, Check, X, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import {
  PRODUCTION_STAGES,
  PRIORITY_CONFIG,
  type Order,
  type ProductionStage,
  type OrderPriority,
} from '@/lib/types';
import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrderHeaderProps {
  order: Order;
  canEdit: boolean;
  isUpdating: boolean;
  onBack: () => void;
  onStageChange: (stage: ProductionStage) => void;
  onPriorityChange: (priority: OrderPriority) => void;
  onNameChange?: (newName: string) => void;
}

export function OrderHeader({
  order,
  canEdit,
  isUpdating,
  onBack,
  onStageChange,
  onPriorityChange,
  onNameChange,
}: OrderHeaderProps) {
  const stageConfig = PRODUCTION_STAGES.find(s => s.value === order.current_stage) || PRODUCTION_STAGES[0];
  const priorityConfig = PRIORITY_CONFIG.find(p => p.value === order.priority) || PRIORITY_CONFIG[1];

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(order.product_name);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditingName]);

  useEffect(() => {
    setEditName(order.product_name);
  }, [order.product_name]);

  const handleStartEditing = () => {
    if (!canEdit) return;
    setEditName(order.product_name);
    setIsEditingName(true);
  };

  const handleCancelEdit = () => {
    setEditName(order.product_name);
    setIsEditingName(false);
  };

  const handleSaveName = async () => {
    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error("Order name cannot be empty");
      return;
    }

    if (trimmedName === order.product_name) {
      setIsEditingName(false);
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ product_name: trimmedName })
        .eq('id', order.id);

      if (error) throw error;

      toast.success("Order name updated");
      onNameChange?.(trimmedName);
      setIsEditingName(false);
    } catch (error: any) {
      console.error('Error updating order name:', error);
      toast.error("Failed to update order name");
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSaveName();
    } else if (e.key === 'Escape') {
      handleCancelEdit();
    }
  };

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
          {isEditingName ? (
            <div className="flex items-center gap-2">
              <Input
                ref={inputRef}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleSaveName}
                disabled={isSaving}
                className="text-3xl font-bold h-auto py-1 px-2 max-w-md"
              />
              {isSaving ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleSaveName}
                  >
                    <Check className="h-4 w-4 text-green-600" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={handleCancelEdit}
                  >
                    <X className="h-4 w-4 text-red-600" />
                  </Button>
                </>
              )}
            </div>
          ) : (
            <h1 
              className={`text-3xl font-bold tracking-tight group flex items-center gap-2 ${canEdit ? 'cursor-pointer hover:text-primary transition-colors' : ''}`}
              onClick={handleStartEditing}
              title={canEdit ? "Click to edit order name" : undefined}
            >
              {order.product_name}
              {canEdit && <Pencil className="h-4 w-4 opacity-0 group-hover:opacity-50 transition-opacity" />}
            </h1>
          )}
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
              onValueChange={(value) => {
                // Validate it's a valid stage value before calling
                const validStage = PRODUCTION_STAGES.find(s => s.value === value);
                if (validStage) {
                  onStageChange(validStage.value);
                }
              }}
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
              onValueChange={(value) => {
                // Validate it's a valid priority value before calling
                const validPriority = PRIORITY_CONFIG.find(p => p.value === value);
                if (validPriority) {
                  onPriorityChange(validPriority.value);
                }
              }}
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
