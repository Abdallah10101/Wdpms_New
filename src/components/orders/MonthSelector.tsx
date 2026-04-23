import { format, startOfMonth } from 'date-fns';
import { Card } from '@/components/ui/card';
import { Calendar, Layers, FlaskConical } from 'lucide-react';
import type { Order } from '@/lib/types';

interface MonthSelectorProps {
  orders: Order[];
  onSelectMonth: (month: Date) => void;
}

export function MonthSelector({ orders, onSelectMonth }: MonthSelectorProps) {
  // Get unique months from orders with bulk/sample breakdown
  const getOrderMonths = () => {
    const monthsMap = new Map<string, {
      date: Date;
      count: number;
      bulkQty: number;
      sampleQty: number;
    }>();

    orders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const monthKey = format(startOfMonth(orderDate), 'yyyy-MM');
      const existing = monthsMap.get(monthKey);
      const qty = order.quantity || 0;
      const isSample = order.supplier === 'sample';

      if (existing) {
        existing.count += 1;
        if (isSample) {
          existing.sampleQty += qty;
        } else {
          existing.bulkQty += qty;
        }
      } else {
        monthsMap.set(monthKey, {
          date: startOfMonth(orderDate),
          count: 1,
          bulkQty: isSample ? 0 : qty,
          sampleQty: isSample ? qty : 0,
        });
      }
    });

    // Sort by date descending (most recent first)
    return Array.from(monthsMap.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
  };

  const months = getOrderMonths();

  if (months.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Calendar className="h-12 w-12 text-muted-foreground/50" />
        <p className="mt-4 text-sm text-muted-foreground">
          No orders found for this client
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {months.map(({ date, count, bulkQty, sampleQty }) => (
        <Card
          key={format(date, 'yyyy-MM')}
          className="p-6 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          onClick={() => onSelectMonth(date)}
        >
          <div className="flex flex-col items-center text-center space-y-3">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold text-lg">
                {format(date, 'MMMM yyyy')}
              </p>
              <p className="text-sm text-muted-foreground">
                {count} {count === 1 ? 'order' : 'orders'}
              </p>
            </div>
            <div className="w-full space-y-1 pt-2 border-t">
              {bulkQty > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-blue-500">
                    <Layers className="h-3.5 w-3.5" />
                    Bulk
                  </span>
                  <span className="font-semibold">{bulkQty.toLocaleString()}</span>
                </div>
              )}
              {sampleQty > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-purple-500">
                    <FlaskConical className="h-3.5 w-3.5" />
                    Samples
                  </span>
                  <span className="font-semibold">{sampleQty.toLocaleString()}</span>
                </div>
              )}
              {bulkQty === 0 && sampleQty === 0 && (
                <p className="text-xs text-muted-foreground">No quantities set</p>
              )}
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
