import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ListTodo, Plus, Trash2, GripVertical } from 'lucide-react';
import type { OrderTask, TaskStatus } from '@/lib/types';

interface OrderTasksProps {
  orderId: string;
}

export function OrderTasks({ orderId }: OrderTasksProps) {
  const { user, role } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<OrderTask[]>([]);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchTasks();
  }, [orderId]);

  const fetchTasks = async () => {
    try {
      const { data, error } = await supabase
        .from('order_tasks')
        .select('*')
        .eq('order_id', orderId)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setTasks((data || []) as OrderTask[]);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTask = async () => {
    if (!newTaskTitle.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const maxSortOrder = tasks.length > 0 ? Math.max(...tasks.map(t => t.sort_order)) : 0;
      
      const { error } = await supabase
        .from('order_tasks')
        .insert({
          order_id: orderId,
          title: newTaskTitle.trim(),
          created_by: user?.id,
          sort_order: maxSortOrder + 1,
        });

      if (error) throw error;

      setNewTaskTitle('');
      fetchTasks();
      
      toast({
        title: 'Task Added',
        description: 'New task has been added to the list.',
      });
    } catch (error) {
      console.error('Error adding task:', error);
      toast({
        title: 'Error',
        description: 'Failed to add task.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleTask = async (task: OrderTask) => {
    const newStatus: TaskStatus = task.status === 'done' ? 'pending' : 'done';
    
    try {
      const { error } = await supabase
        .from('order_tasks')
        .update({
          status: newStatus,
          completed_at: newStatus === 'done' ? new Date().toISOString() : null,
          completed_by: newStatus === 'done' ? user?.id : null,
        })
        .eq('id', task.id);

      if (error) throw error;
      
      setTasks(prev => 
        prev.map(t => 
          t.id === task.id 
            ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
            : t
        )
      );
    } catch (error) {
      console.error('Error updating task:', error);
      toast({
        title: 'Error',
        description: 'Failed to update task.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('order_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      fetchTasks();
      
      toast({
        title: 'Task Deleted',
        description: 'The task has been removed.',
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete task.',
        variant: 'destructive',
      });
    }
  };

  const canManageTasks = role === 'admin' || role === 'team';
  const completedCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <ListTodo className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">To Do List</h3>
        <Badge variant="secondary" className="text-xs">
          {completedCount}/{tasks.length}
        </Badge>
      </div>

      {/* Add Task Form */}
      {canManageTasks && (
        <div className="flex gap-2">
          <Input
            placeholder="Add a new task..."
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            disabled={isSubmitting}
          />
          <Button
            size="icon"
            onClick={handleAddTask}
            disabled={!newTaskTitle.trim() || isSubmitting}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-2">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading tasks...</p>
        ) : tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No tasks yet. Add one above!
          </p>
        ) : (
          tasks.map((task) => (
            <div
              key={task.id}
              className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                task.status === 'done' ? 'bg-muted/30' : 'bg-card hover:bg-muted/20'
              }`}
            >
              <div className="flex items-center gap-2 pt-0.5">
                <GripVertical className="h-4 w-4 text-muted-foreground/50 cursor-grab" />
                <Checkbox
                  checked={task.status === 'done'}
                  onCheckedChange={() => handleToggleTask(task)}
                  disabled={!canManageTasks}
                  className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm ${
                    task.status === 'done' ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-muted-foreground mt-1">{task.description}</p>
                )}
              </div>
              {canManageTasks && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive flex-shrink-0"
                  onClick={() => handleDeleteTask(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
