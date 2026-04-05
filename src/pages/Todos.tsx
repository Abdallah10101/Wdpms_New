import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isToday, parseISO } from 'date-fns';
import { ListTodo, Search, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TodoRow {
  id: string;
  order_id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  status: 'pending' | 'in_progress' | 'done' | 'blocked';
  created_at: string;
  order: {
    id: string;
    order_number: string;
    product_name: string;
    client_id: string;
    client: { id: string; name: string; brand_name: string | null } | null;
  } | null;
}

const STATUS_STYLES: Record<TodoRow['status'], string> = {
  pending: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  blocked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const STATUS_LABELS: Record<TodoRow['status'], string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  done: 'Done',
  blocked: 'Blocked',
};

export default function Todos() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && role === 'client') navigate('/portal');
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client') {
      fetchTodos();
    }
  }, [user, role]);

  const fetchTodos = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_tasks')
        .select(`
          id, order_id, title, description, due_date, status, created_at,
          order:orders(id, order_number, product_name, client_id, client:clients(id, name, brand_name))
        `)
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTodos((data || []) as unknown as TodoRow[]);
    } catch (err) {
      console.error('Error fetching todos:', err);
      toast({ title: 'Error', description: 'Failed to load to do list.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  // Filter by search
  const filteredTodos = todos.filter((t) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      t.order?.product_name?.toLowerCase().includes(q) ||
      t.order?.order_number?.toLowerCase().includes(q) ||
      t.order?.client?.name?.toLowerCase().includes(q) ||
      t.order?.client?.brand_name?.toLowerCase().includes(q)
    );
  });

  // Group by client
  const grouped = filteredTodos.reduce((acc, todo) => {
    const clientId = todo.order?.client?.id || 'unassigned';
    const clientName = todo.order?.client?.brand_name || todo.order?.client?.name || 'No Client';
    if (!acc[clientId]) {
      acc[clientId] = { clientName, todos: [] };
    }
    acc[clientId].todos.push(todo);
    return acc;
  }, {} as Record<string, { clientName: string; todos: TodoRow[] }>);

  const columns = Object.entries(grouped).sort(([, a], [, b]) => a.clientName.localeCompare(b.clientName));

  const stats = {
    total: todos.length,
    overdue: todos.filter((t) => t.due_date && t.status !== 'done' && isAfter(new Date(), parseISO(t.due_date)) && !isToday(parseISO(t.due_date))).length,
    dueToday: todos.filter((t) => t.due_date && t.status !== 'done' && isToday(parseISO(t.due_date))).length,
    done: todos.filter((t) => t.status === 'done').length,
  };

  const getDueDateBadge = (dueDate: string | null, status: TodoRow['status']) => {
    if (!dueDate || status === 'done') return null;
    const date = parseISO(dueDate);
    const overdue = isAfter(new Date(), date) && !isToday(date);
    const today = isToday(date);
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
          overdue
            ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
            : today
            ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
            : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
        )}
      >
        {overdue ? <AlertCircle className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
        {overdue ? 'Overdue' : today ? 'Due today' : format(date, 'MMM d')}
      </div>
    );
  };

  if (authLoading || isLoading) {
    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
          <Skeleton className="h-96" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-orange-500" />
            To Do List
          </h1>
          <p className="text-muted-foreground">All tasks across all orders, grouped by client</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
                  <ListTodo className="h-5 w-5 text-gray-600 dark:text-gray-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total Tasks</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/40 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.overdue}</p>
                  <p className="text-sm text-muted-foreground">Overdue</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/40 rounded-lg">
                  <Clock className="h-5 w-5 text-orange-600 dark:text-orange-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.dueToday}</p>
                  <p className="text-sm text-muted-foreground">Due Today</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/40 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-300" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.done}</p>
                  <p className="text-sm text-muted-foreground">Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tasks, orders, or clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Kanban Columns */}
        {columns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <ListTodo className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No tasks yet</p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map(([clientId, { clientName, todos: clientTodos }]) => (
              <div key={clientId} className="flex-shrink-0 w-80">
                <div className="bg-muted/50 rounded-lg p-3 h-full">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-sm truncate">{clientName}</h3>
                    <Badge variant="secondary" className="ml-2">{clientTodos.length}</Badge>
                  </div>
                  <div className="space-y-2">
                    {clientTodos.map((todo) => (
                      <Card
                        key={todo.id}
                        className="cursor-pointer hover:border-primary/50 transition-colors"
                        onClick={() => todo.order_id && navigate(`/orders/${todo.order_id}`)}
                      >
                        <CardContent className="p-3 space-y-2">
                          <p className="text-sm font-medium line-clamp-2">{todo.title}</p>
                          {todo.order && (
                            <p className="text-xs text-muted-foreground truncate">
                              {todo.order.order_number} · {todo.order.product_name}
                            </p>
                          )}
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <Badge className={cn('text-xs', STATUS_STYLES[todo.status])} variant="outline">
                              {STATUS_LABELS[todo.status]}
                            </Badge>
                            {getDueDateBadge(todo.due_date, todo.status)}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
