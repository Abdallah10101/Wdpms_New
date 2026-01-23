import { format, startOfMonth, subMonths, addMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import type { Order } from '@/lib/types';

interface MonthSelectorProps {
  orders: Order[];
  onSelectMonth: (month: Date) => void;
}

export function MonthSelector({ orders, onSelectMonth }: MonthSelectorProps) {
  // Get unique months from orders
  const getOrderMonths = () => {
    const monthsMap = new Map<string, { date: Date; count: number }>();
    
    orders.forEach(order => {
      const orderDate = new Date(order.created_at);
      const monthKey = format(startOfMonth(orderDate), 'yyyy-MM');
      const existing = monthsMap.get(monthKey);
      
      if (existing) {
        existing.count += 1;
      } else {
        monthsMap.set(monthKey, {
          date: startOfMonth(orderDate),
          count: 1
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
      {months.map(({ date, count }) => (
        <Card
          key={format(date, 'yyyy-MM')}
          className="p-6 cursor-pointer hover:shadow-md hover:border-primary/50 transition-all"
          onClick={() => onSelectMonth(date)}
        >
          <div className="flex flex-col items-center text-center space-y-2">
            <Calendar className="h-8 w-8 text-primary" />
            <div>
              <p className="font-semibold text-lg">
                {format(date, 'MMMM yyyy')}
              </p>
              <p className="text-sm text-muted-foreground">
                {count} {count === 1 ? 'order' : 'orders'}
              </p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
