import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { format, isAfter, isToday, parseISO } from 'date-fns';
import {
  ListTodo,
  Search,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Package,
  ArrowLeft,
  ChevronRight,
  X,
} from 'lucide-react';
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

interface ProductGroup {
  orderId: string;
  orderNumber: string;
  productName: string;
  clientId: string;
  clientName: string;
  todos: TodoRow[];
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

const isOverdue = (dueDate: string | null, status: TodoRow['status']) => {
  if (!dueDate || status === 'done') return false;
  const date = parseISO(dueDate);
  return isAfter(new Date(), date) && !isToday(date);
};

const isDueToday = (dueDate: string | null, status: TodoRow['status']) => {
  if (!dueDate || status === 'done') return false;
  return isToday(parseISO(dueDate));
};

export default function Todos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [todos, setTodos] = useState<TodoRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  // Date filter: 'day' shows only tasks whose due_date matches the picked day;
  // 'month' shows tasks whose due_date falls in the picked month (YYYY-MM).
  const [filterMode, setFilterMode] = useState<'day' | 'month'>('day');
  const [filterDate, setFilterDate] = useState('');

  const selectedOrderId = searchParams.get('order');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && role === 'client') navigate('/portal');
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client') {
      fetchTodos();
    }
  }, [user, role]);

  // Reset search when switching between levels
  useEffect(() => {
    setSearchQuery('');
  }, [selectedOrderId]);

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

  // Apply the date filter (if any) to the raw todo list. All downstream
  // calculations (stats, product groups, task view) operate on this list.
  const dateFilteredTodos = useMemo(() => {
    if (!filterDate) return todos;
    if (filterMode === 'day') {
      return todos.filter((t) => t.due_date === filterDate);
    }
    // month mode: filterDate is YYYY-MM
    return todos.filter((t) => t.due_date && t.due_date.startsWith(filterDate));
  }, [todos, filterDate, filterMode]);

  // Build product groups (each order = a product)
  const productGroups = useMemo<ProductGroup[]>(() => {
    const map = new Map<string, ProductGroup>();
    for (const todo of dateFilteredTodos) {
      if (!todo.order) continue;
      const orderId = todo.order.id;
      if (!map.has(orderId)) {
        map.set(orderId, {
          orderId,
          orderNumber: todo.order.order_number,
          productName: todo.order.product_name,
          clientId: todo.order.client?.id || 'unassigned',
          clientName:
            todo.order.client?.brand_name ||
            todo.order.client?.name ||
            'No Client',
          todos: [],
        });
      }
      map.get(orderId)!.todos.push(todo);
    }
    return Array.from(map.values());
  }, [dateFilteredTodos]);

  const selectedProduct = useMemo(
    () => productGroups.find((p) => p.orderId === selectedOrderId) || null,
    [productGroups, selectedOrderId]
  );

  // Global stats (level 1) — reflect the date filter when one is applied.
  const globalStats = useMemo(
    () => ({
      total: dateFilteredTodos.length,
      overdue: dateFilteredTodos.filter((t) => isOverdue(t.due_date, t.status)).length,
      dueToday: dateFilteredTodos.filter((t) => isDueToday(t.due_date, t.status)).length,
      done: dateFilteredTodos.filter((t) => t.status === 'done').length,
    }),
    [dateFilteredTodos]
  );

  // Product-specific stats (level 2)
  const productStats = useMemo(() => {
    if (!selectedProduct) return null;
    const t = selectedProduct.todos;
    return {
      total: t.length,
      overdue: t.filter((x) => isOverdue(x.due_date, x.status)).length,
      dueToday: t.filter((x) => isDueToday(x.due_date, x.status)).length,
      done: t.filter((x) => x.status === 'done').length,
    };
  }, [selectedProduct]);

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

  const openProduct = (orderId: string) => {
    setSearchParams({ order: orderId });
  };

  const backToProducts = () => {
    setSearchParams({});
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

  // ---------- LEVEL 2: TASK VIEW FOR SELECTED PRODUCT ----------
  if (selectedProduct && productStats) {
    const filteredTasks = selectedProduct.todos.filter((t) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    });

    return (
      <DashboardLayout>
        <div className="p-6 space-y-6">
          {/* Breadcrumb + Header */}
          <div className="space-y-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={backToProducts}
              className="-ml-2 h-8 px-2 text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to products
            </Button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>{selectedProduct.clientName}</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">
                {selectedProduct.productName}
              </span>
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <ListTodo className="h-6 w-6 text-orange-500" />
                {selectedProduct.productName}
              </h1>
              <p className="text-muted-foreground">
                {selectedProduct.orderNumber} · Tasks for this product
              </p>
            </div>
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
                    <p className="text-2xl font-bold">{productStats.total}</p>
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
                    <p className="text-2xl font-bold">{productStats.overdue}</p>
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
                    <p className="text-2xl font-bold">{productStats.dueToday}</p>
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
                    <p className="text-2xl font-bold">{productStats.done}</p>
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
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Task list */}
          {filteredTasks.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <ListTodo className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-muted-foreground">
                  {searchQuery ? 'No tasks match your search' : 'No tasks for this product yet'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredTasks.map((todo) => (
                <Card
                  key={todo.id}
                  className="cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => todo.order_id && navigate(`/orders/${todo.order_id}`)}
                >
                  <CardContent className="p-3 space-y-2">
                    <p className="text-sm font-medium line-clamp-2">{todo.title}</p>
                    {todo.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {todo.description}
                      </p>
                    )}
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <Badge
                        className={cn('text-xs', STATUS_STYLES[todo.status])}
                        variant="outline"
                      >
                        {STATUS_LABELS[todo.status]}
                      </Badge>
                      {getDueDateBadge(todo.due_date, todo.status)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DashboardLayout>
    );
  }

  // ---------- LEVEL 1: PRODUCT SELECTION VIEW ----------
  const filteredProducts = productGroups.filter((p) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.productName.toLowerCase().includes(q) ||
      p.orderNumber.toLowerCase().includes(q) ||
      p.clientName.toLowerCase().includes(q)
    );
  });

  // Group products by client for columns
  const productsByClient = filteredProducts.reduce(
    (acc, p) => {
      if (!acc[p.clientId]) {
        acc[p.clientId] = { clientName: p.clientName, products: [] };
      }
      acc[p.clientId].products.push(p);
      return acc;
    },
    {} as Record<string, { clientName: string; products: ProductGroup[] }>
  );

  const columns = Object.entries(productsByClient).sort(([, a], [, b]) =>
    a.clientName.localeCompare(b.clientName)
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-orange-500" />
            To Do List
          </h1>
          <p className="text-muted-foreground">
            Select a product to view its tasks
          </p>
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
                  <p className="text-2xl font-bold">{globalStats.total}</p>
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
                  <p className="text-2xl font-bold">{globalStats.overdue}</p>
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
                  <p className="text-2xl font-bold">{globalStats.dueToday}</p>
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
                  <p className="text-2xl font-bold">{globalStats.done}</p>
                  <p className="text-sm text-muted-foreground">Done</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search + date filter */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search products or clients..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <select
              value={filterMode}
              onChange={(e) => {
                const next = e.target.value as 'day' | 'month';
                setFilterMode(next);
                setFilterDate('');
              }}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            >
              <option value="day">Day</option>
              <option value="month">Month</option>
            </select>
            <Input
              type={filterMode === 'day' ? 'date' : 'month'}
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 w-44"
            />
            {filterDate && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setFilterDate('')}
                className="h-9 px-2"
              >
                <X className="h-4 w-4 mr-1" />
                Clear
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const yyyy = today.getFullYear();
                const mm = String(today.getMonth() + 1).padStart(2, '0');
                const dd = String(today.getDate()).padStart(2, '0');
                setFilterMode('day');
                setFilterDate(`${yyyy}-${mm}-${dd}`);
              }}
              className="h-9"
            >
              Today
            </Button>
          </div>
        </div>

        {/* Kanban columns: one per client, cards are products */}
        {columns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">
                {searchQuery ? 'No products match your search' : 'No products with tasks yet'}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-4">
            {columns.map(([clientId, { clientName, products }]) => (
              <div key={clientId} className="flex-shrink-0 w-80">
                <div className="bg-muted/50 rounded-lg p-3 h-full">
                  <div className="flex items-center justify-between mb-3 px-1">
                    <h3 className="font-semibold text-sm truncate">{clientName}</h3>
                    <Badge variant="secondary" className="ml-2">
                      {products.length}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    {products.map((product) => {
                      const overdueCount = product.todos.filter((t) =>
                        isOverdue(t.due_date, t.status)
                      ).length;
                      const dueTodayCount = product.todos.filter((t) =>
                        isDueToday(t.due_date, t.status)
                      ).length;
                      const doneCount = product.todos.filter(
                        (t) => t.status === 'done'
                      ).length;
                      const openCount = product.todos.length - doneCount;

                      return (
                        <Card
                          key={product.orderId}
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => openProduct(product.orderId)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-start gap-2">
                              <Package className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium line-clamp-2">
                                  {product.productName}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {product.orderNumber}
                                </p>
                              </div>
                              <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                            </div>
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <Badge variant="outline" className="text-xs">
                                {openCount} open · {doneCount} done
                              </Badge>
                              <div className="flex items-center gap-1">
                                {overdueCount > 0 && (
                                  <div className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                                    <AlertCircle className="h-3 w-3" />
                                    {overdueCount}
                                  </div>
                                )}
                                {dueTodayCount > 0 && (
                                  <div className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300">
                                    <Clock className="h-3 w-3" />
                                    {dueTodayCount}
                                  </div>
                                )}
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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
