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
  Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { escapeHtml } from '@/lib/html-escape';

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

  // Build a human-readable label for the active date filter, used in the
  // print header so the printed page is self-describing.
  const filterDescription = useMemo(() => {
    if (!filterDate) return 'All tasks';
    if (filterMode === 'day') {
      return format(parseISO(filterDate), "EEEE, d MMMM yyyy");
    }
    // filterDate is YYYY-MM in month mode; pad to a real date so parseISO works.
    return format(parseISO(`${filterDate}-01`), 'MMMM yyyy');
  }, [filterDate, filterMode]);

  const handlePrintTodos = (scope: 'filter' | 'product', tasks: TodoRow[], heading: string, subheading: string, stats: { total: number; overdue: number; dueToday: number; done: number }) => {
    if (tasks.length === 0) {
      toast({
        title: 'Nothing to print',
        description: 'No tasks match the current filter.',
        variant: 'destructive',
      });
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Pop-up blocked',
        description: 'Allow pop-ups for this site to print the to-do list.',
        variant: 'destructive',
      });
      return;
    }

    // Group tasks by client → product so the printed list mirrors the on-screen kanban.
    const byClient = new Map<string, { clientName: string; products: Map<string, { productName: string; orderNumber: string; tasks: TodoRow[] }> }>();
    for (const t of tasks) {
      const clientId = t.order?.client?.id || 'unassigned';
      const clientName = t.order?.client?.brand_name || t.order?.client?.name || 'No Client';
      const orderId = t.order?.id || 'unassigned';
      const orderNumber = t.order?.order_number || '';
      const productName = t.order?.product_name || 'Unassigned task';
      if (!byClient.has(clientId)) {
        byClient.set(clientId, { clientName, products: new Map() });
      }
      const clientGroup = byClient.get(clientId)!;
      if (!clientGroup.products.has(orderId)) {
        clientGroup.products.set(orderId, { productName, orderNumber, tasks: [] });
      }
      clientGroup.products.get(orderId)!.tasks.push(t);
    }

    const statusBadgeStyle = (s: TodoRow['status']): string => {
      switch (s) {
        case 'done':
          return 'background:#dcfce7;color:#166534';
        case 'in_progress':
          return 'background:#dbeafe;color:#1e40af';
        case 'blocked':
          return 'background:#fee2e2;color:#991b1b';
        default:
          return 'background:#f5f5f4;color:#57534e';
      }
    };

    const dueBadge = (dueDate: string | null, status: TodoRow['status']) => {
      if (!dueDate) return '';
      if (status === 'done') {
        return `<span class="due-badge done">${escapeHtml(format(parseISO(dueDate), 'd MMM yyyy'))}</span>`;
      }
      if (isOverdue(dueDate, status)) {
        return `<span class="due-badge overdue">Overdue · ${escapeHtml(format(parseISO(dueDate), 'd MMM'))}</span>`;
      }
      if (isDueToday(dueDate, status)) {
        return `<span class="due-badge today">Due today</span>`;
      }
      return `<span class="due-badge">${escapeHtml(format(parseISO(dueDate), 'd MMM yyyy'))}</span>`;
    };

    const clientSectionsHtml = Array.from(byClient.values())
      .sort((a, b) => a.clientName.localeCompare(b.clientName))
      .map((clientGroup) => {
        const productsHtml = Array.from(clientGroup.products.values())
          .map((product) => {
            const taskRows = product.tasks
              .map((task) => `
                <tr>
                  <td class="task-checkbox"><span class="checkbox ${task.status === 'done' ? 'checked' : ''}"></span></td>
                  <td>
                    <div class="task-title ${task.status === 'done' ? 'done' : ''}">${escapeHtml(task.title)}</div>
                    ${task.description ? `<div class="task-desc">${escapeHtml(task.description)}</div>` : ''}
                  </td>
                  <td class="status-cell">
                    <span class="status-badge" style="${statusBadgeStyle(task.status)}">${STATUS_LABELS[task.status]}</span>
                  </td>
                  <td class="due-cell">${dueBadge(task.due_date, task.status)}</td>
                </tr>`)
              .join('');
            return `
              <div class="product-section">
                <div class="product-header">
                  <div class="product-name">${escapeHtml(product.productName)}</div>
                  ${product.orderNumber ? `<div class="product-meta">${escapeHtml(product.orderNumber)}</div>` : ''}
                </div>
                <table class="task-table">
                  <tbody>${taskRows}</tbody>
                </table>
              </div>`;
          })
          .join('');
        return `
          <section class="client-section">
            <div class="client-header">
              <div class="client-name">${escapeHtml(clientGroup.clientName)}</div>
              <div class="client-count">${clientGroup.products.size} product${clientGroup.products.size === 1 ? '' : 's'}</div>
            </div>
            ${productsHtml}
          </section>`;
      })
      .join('');

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>${escapeHtml(heading)}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { height: 100%; }
    body { font-family: 'Inter', -apple-system, sans-serif; background: white; color: #1c1917; font-size: 13px; min-height: 100vh; }
    .page-wrapper { padding: 48px 56px 100px 56px; min-height: 100vh; position: relative; }

    /* WDS Logo */
    .logo-section { position: absolute; top: 40px; right: 56px; text-align: right; }
    .logo-text { font-weight: 800; font-size: 52px; color: #1c1917; letter-spacing: 4px; line-height: 1; }
    .logo-dots { position: relative; top: -38px; left: 2px; }
    .logo-dots span { display: inline-block; width: 6px; height: 6px; background: #D4511E; border-radius: 1.5px; margin: 0 1px; }

    /* Company Info */
    .company-section { margin-bottom: 36px; max-width: 65%; }
    .company-name { font-weight: 700; font-size: 16px; color: #1c1917; margin-bottom: 2px; }
    .company-brand { font-weight: 600; font-size: 13px; color: #D4511E; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px; }
    .company-detail { font-size: 11.5px; line-height: 1.7; color: #57534e; }

    /* Title */
    .report-title-section { margin-bottom: 12px; }
    .report-title { font-weight: 800; font-size: 32px; color: #D4511E; text-transform: uppercase; letter-spacing: 3px; }
    .report-subtitle { font-size: 14px; color: #57534e; margin-top: 4px; font-weight: 500; }

    /* Stats */
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
    .stat-card { padding: 14px 16px; border: 1px solid #e7e5e4; border-radius: 6px; background: #fafaf9; }
    .stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #78716c; font-weight: 600; }
    .stat-value { font-size: 24px; font-weight: 700; color: #1c1917; margin-top: 4px; }
    .stat-card.overdue .stat-value { color: #b91c1c; }
    .stat-card.due-today .stat-value { color: #c2410c; }
    .stat-card.done .stat-value { color: #15803d; }

    /* Divider */
    .divider { height: 3px; background: #D4511E; margin-bottom: 18px; }

    /* Client section */
    .client-section { margin-bottom: 28px; page-break-inside: avoid; }
    .client-header { display: flex; justify-content: space-between; align-items: baseline; padding: 8px 0 6px; border-bottom: 2px solid #1c1917; margin-bottom: 12px; }
    .client-name { font-size: 16px; font-weight: 700; color: #1c1917; text-transform: uppercase; letter-spacing: 1px; }
    .client-count { font-size: 11px; color: #78716c; font-weight: 500; }

    /* Product section */
    .product-section { margin-bottom: 14px; page-break-inside: avoid; }
    .product-header { display: flex; justify-content: space-between; align-items: baseline; padding: 6px 12px; background: #f5f5f4; border-radius: 4px 4px 0 0; }
    .product-name { font-size: 13px; font-weight: 600; color: #1c1917; }
    .product-meta { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: #78716c; }

    /* Task table */
    .task-table { width: 100%; border-collapse: collapse; }
    .task-table td { padding: 10px 12px; border-bottom: 1px solid #f0eeec; vertical-align: top; font-size: 12.5px; }
    .task-checkbox { width: 28px; }
    .checkbox { display: inline-block; width: 14px; height: 14px; border: 1.5px solid #a8a29e; border-radius: 3px; vertical-align: middle; }
    .checkbox.checked { background: #D4511E; border-color: #D4511E; position: relative; }
    .checkbox.checked::after { content: ''; position: absolute; left: 3px; top: 0px; width: 4px; height: 8px; border: solid white; border-width: 0 1.5px 1.5px 0; transform: rotate(45deg); }
    .task-title { font-weight: 500; color: #1c1917; }
    .task-title.done { text-decoration: line-through; color: #a8a29e; }
    .task-desc { font-size: 11px; color: #78716c; margin-top: 3px; }
    .status-cell { width: 110px; }
    .due-cell { width: 130px; text-align: right; }
    .status-badge, .due-badge { display: inline-block; font-size: 10.5px; font-weight: 600; padding: 3px 8px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px; }
    .due-badge { background: #f5f5f4; color: #57534e; }
    .due-badge.overdue { background: #fee2e2; color: #991b1b; }
    .due-badge.today { background: #ffedd5; color: #9a3412; }
    .due-badge.done { background: #dcfce7; color: #166534; }

    /* Footer */
    .footer-bar { position: fixed; bottom: 0; left: 0; right: 0; height: 36px; background: #D4511E; }
    .footer-content { height: 100%; display: flex; align-items: center; justify-content: space-between; padding: 0 56px; color: rgba(255,255,255,0.9); font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; }

    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .page-wrapper { padding: 36px 44px 70px 44px; }
      @page { margin: 0; size: A4; }
      .client-section { page-break-inside: avoid; }
      .product-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page-wrapper">
    <div class="logo-section">
      <div><span class="logo-dots"><span></span><span></span><span></span></span></div>
      <div class="logo-text">WDS</div>
    </div>

    <div class="company-section">
      <div class="company-name">MOHAMMAD AL SAYED</div>
      <div class="company-brand">WorkDuShop</div>
      <div class="company-detail">
        ROSEVELT TEKSTİL İÇ VE DIŞ TİCARET LİMİTED ŞİRKETİ<br>
        ŞEHREMİNİ MAH. VELET ÇELEBİ SK. NO:9/A FAİTH/İST<br>
        FAİTH V.D: 7352021157 &nbsp;|&nbsp; MERSİS NO: 0735202115700001
      </div>
    </div>

    <div class="report-title-section">
      <div class="report-title">${escapeHtml(heading)}</div>
      <div class="report-subtitle">${escapeHtml(subheading)}</div>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Total Tasks</div>
        <div class="stat-value">${stats.total}</div>
      </div>
      <div class="stat-card overdue">
        <div class="stat-label">Overdue</div>
        <div class="stat-value">${stats.overdue}</div>
      </div>
      <div class="stat-card due-today">
        <div class="stat-label">Due Today</div>
        <div class="stat-value">${stats.dueToday}</div>
      </div>
      <div class="stat-card done">
        <div class="stat-label">Done</div>
        <div class="stat-value">${stats.done}</div>
      </div>
    </div>

    <div class="divider"></div>

    ${clientSectionsHtml}
  </div>

  <div class="footer-bar">
    <div class="footer-content">
      <span>WorkDuShop · Production Tracking</span>
      <span>Generated ${escapeHtml(format(new Date(), "d MMM yyyy 'at' HH:mm"))}</span>
    </div>
  </div>
  <script>
    window.addEventListener('load', () => { setTimeout(() => window.print(), 250); });
  </script>
</body>
</html>`;

    printWindow.document.write(html);
    printWindow.document.close();

    // suppress unused-variable lint when scope is only used for naming
    void scope;
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
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <ListTodo className="h-6 w-6 text-orange-500" />
                    {selectedProduct.productName}
                  </h1>
                  <p className="text-muted-foreground">
                    {selectedProduct.orderNumber} · Tasks for this product
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() =>
                    handlePrintTodos(
                      'product',
                      selectedProduct.todos,
                      selectedProduct.productName,
                      `${selectedProduct.clientName} · ${selectedProduct.orderNumber}`,
                      productStats,
                    )
                  }
                  disabled={selectedProduct.todos.length === 0}
                >
                  <Printer className="h-4 w-4 mr-1" />
                  Print
                </Button>
              </div>
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
            <Button
              variant="default"
              size="sm"
              onClick={() => {
                const heading = filterDate
                  ? (filterMode === 'day' ? "Today's To Do List" : 'Monthly To Do List')
                  : 'To Do List';
                handlePrintTodos(
                  'filter',
                  dateFilteredTodos,
                  heading,
                  filterDescription,
                  globalStats,
                );
              }}
              className="h-9"
              disabled={dateFilteredTodos.length === 0}
            >
              <Printer className="h-4 w-4 mr-1" />
              Print
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
