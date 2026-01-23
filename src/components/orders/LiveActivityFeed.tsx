import { formatDistanceToNow } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Activity, ArrowRight, Package } from 'lucide-react';
import { PRODUCTION_STAGES } from '@/lib/types';

interface OrderUpdate {
  id: string;
  order_number: string;
  product_name: string;
  old_stage?: string;
  new_stage: string;
  timestamp: Date;
}

interface LiveActivityFeedProps {
  updates: OrderUpdate[];
}

export function LiveActivityFeed({ updates }: LiveActivityFeedProps) {
  const getStageLabel = (stage: string) => {
    return PRODUCTION_STAGES.find(s => s.value === stage)?.label || stage;
  };

  const getStageColor = (stage: string) => {
    return PRODUCTION_STAGES.find(s => s.value === stage)?.color || 'bg-muted';
  };

  if (updates.length === 0) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">Live Activity</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">
          No recent updates
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-4 w-4 text-primary animate-pulse" />
        <h3 className="font-semibold text-sm">Live Activity</h3>
        <Badge variant="secondary" className="text-xs">
          {updates.length} updates
        </Badge>
      </div>
      <ScrollArea className="h-[200px]">
        <div className="space-y-3">
          {updates.map((update, index) => (
            <div 
              key={`${update.id}-${index}`}
              className="flex items-start gap-3 p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <Package className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {update.product_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {update.order_number}
                </p>
                <div className="flex items-center gap-1 mt-1 flex-wrap">
                  {update.old_stage && (
                    <>
                      <Badge variant="outline" className="text-xs">
                        {getStageLabel(update.old_stage)}
                      </Badge>
                      <ArrowRight className="h-3 w-3 text-muted-foreground" />
                    </>
                  )}
                  <Badge className={`${getStageColor(update.new_stage)} text-white text-xs`}>
                    {getStageLabel(update.new_stage)}
                  </Badge>
                </div>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(update.timestamp, { addSuffix: true })}
              </span>
            </div>
          ))}
        </div>
      </ScrollArea>
    </Card>
  );
}
