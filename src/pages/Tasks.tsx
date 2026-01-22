import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ClipboardList, Calendar, Package } from 'lucide-react';
import { TASK_STATUS_CONFIG, type OrderTask, type TaskStatus } from '@/lib/types';
import { format } from 'date-fns';

interface TaskWithOrder extends OrderTask {
  order?: {
    id: string;
    product_name: string;
    order_number: string;
  };
}

export default function Tasks() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [tasks, setTasks] = useState<TaskWithOrder[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role === 'client') {
      navigate('/dashboard');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client') {
      fetchTasks();
    }
  }, [user, role]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('order_tasks')
        .select('*, order:orders(id, product_name, order_number)')
        .in('status', ['pending', 'in_progress'])
        .order('due_date', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setTasks((data || []) as TaskWithOrder[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tasks.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTaskComplete = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('order_tasks')
        .update({
          status: 'done',
          completed_at: new Date().toISOString(),
          completed_by: user?.id,
        })
        .eq('id', taskId);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Task marked as complete.',
      });

      fetchTasks();
    } catch (error) {
      console.error('Error completing task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task.',
        variant: 'destructive',
      });
    }
  };

  const getStatusConfig = (status: TaskStatus) => {
    return TASK_STATUS_CONFIG.find(s => s.value === status) || TASK_STATUS_CONFIG[0];
  };

  const isOverdue = (dueDate?: string) => {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  };

  if (authLoading || !user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tasks</h1>
          <p className="text-muted-foreground">
            View and manage your pending tasks
          </p>
        </div>

        {/* Tasks List */}
        <Card>
          <CardHeader>
            <CardTitle>Pending Tasks</CardTitle>
            <CardDescription>
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} to complete
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <ClipboardList className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  No pending tasks. You're all caught up!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => {
                  const statusConfig = getStatusConfig(task.status);
                  const overdue = isOverdue(task.due_date);

                  return (
                    <div
                      key={task.id}
                      className={`flex items-start gap-4 rounded-lg border p-4 transition-colors ${
                        overdue ? 'border-destructive bg-destructive/5' : 'border-border'
                      }`}
                    >
                      <Checkbox
                        checked={task.status === 'done'}
                        onCheckedChange={() => handleTaskComplete(task.id)}
                        className="mt-1"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{task.title}</p>
                          <Badge
                            variant="secondary"
                            className={statusConfig.color + ' text-white text-xs'}
                          >
                            {statusConfig.label}
                          </Badge>
                        </div>
                        {task.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                            {task.description}
                          </p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                          {task.order && (
                            <span
                              className="flex items-center gap-1 cursor-pointer hover:text-foreground"
                              onClick={() => navigate(`/orders/${task.order!.id}`)}
                            >
                              <Package className="h-3 w-3" />
                              {task.order.product_name}
                            </span>
                          )}
                          {task.due_date && (
                            <span
                              className={`flex items-center gap-1 ${
                                overdue ? 'text-destructive' : ''
                              }`}
                            >
                              <Calendar className="h-3 w-3" />
                              {overdue ? 'Overdue: ' : 'Due: '}
                              {format(new Date(task.due_date), 'MMM d, yyyy')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
