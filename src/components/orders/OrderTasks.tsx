import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { ListTodo, Plus, Trash2, X, CheckSquare } from 'lucide-react';
import type { OrderTask, TaskStatus } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

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
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);

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
    
    // Optimistic update
    setTasks(prev => 
      prev.map(t => 
        t.id === task.id 
          ? { ...t, status: newStatus, completed_at: newStatus === 'done' ? new Date().toISOString() : null }
          : t
      )
    );

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
    } catch (error) {
      console.error('Error updating task:', error);
      fetchTasks(); // Revert on error
      toast({
        title: 'Error',
        description: 'Failed to update task.',
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    // Optimistic update
    setTasks(prev => prev.filter(t => t.id !== taskId));
    setTaskToDelete(null);
    setDeleteDialogOpen(false);

    try {
      const { error } = await supabase
        .from('order_tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;
      
      toast({
        title: 'Task Deleted',
        description: 'The task has been removed.',
      });
    } catch (error) {
      console.error('Error deleting task:', error);
      fetchTasks(); // Revert on error
      toast({
        title: 'Error',
        description: 'Failed to delete task.',
        variant: 'destructive',
      });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTasks.size === 0) return;

    const tasksToDelete = Array.from(selectedTasks);
    
    // Optimistic update
    setTasks(prev => prev.filter(t => !selectedTasks.has(t.id)));
    setSelectedTasks(new Set());
    setIsSelectionMode(false);
    setDeleteDialogOpen(false);

    try {
      const { error } = await supabase
        .from('order_tasks')
        .delete()
        .in('id', tasksToDelete);

      if (error) throw error;
      
      toast({
        title: 'Tasks Deleted',
        description: `${tasksToDelete.length} task(s) have been removed.`,
      });
    } catch (error) {
      console.error('Error deleting tasks:', error);
      fetchTasks(); // Revert on error
      toast({
        title: 'Error',
        description: 'Failed to delete tasks.',
        variant: 'destructive',
      });
    }
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev);
      if (next.has(taskId)) {
        next.delete(taskId);
      } else {
        next.add(taskId);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedTasks.size === tasks.length) {
      setSelectedTasks(new Set());
    } else {
      setSelectedTasks(new Set(tasks.map(t => t.id)));
    }
  };

  const confirmDelete = (taskId: string) => {
    setTaskToDelete(taskId);
    setDeleteDialogOpen(true);
  };

  const confirmBulkDelete = () => {
    setTaskToDelete(null);
    setDeleteDialogOpen(true);
  };

  const canManageTasks = role === 'admin' || role === 'team';
  const completedCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ListTodo className="h-5 w-5 text-primary" />
          <h3 className="font-semibold">To Do List</h3>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{tasks.length}
          </Badge>
        </div>

        {/* Bulk Actions */}
        {canManageTasks && tasks.length > 0 && (
          <div className="flex items-center gap-2">
            {isSelectionMode ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="h-7 text-xs"
                >
                  <CheckSquare className="h-3.5 w-3.5 mr-1" />
                  {selectedTasks.size === tasks.length ? 'Deselect All' : 'Select All'}
                </Button>
                {selectedTasks.size > 0 && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={confirmBulkDelete}
                    className="h-7 text-xs"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    Delete ({selectedTasks.size})
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedTasks(new Set());
                  }}
                  className="h-7 text-xs"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsSelectionMode(true)}
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
              >
                <CheckSquare className="h-3.5 w-3.5 mr-1" />
                Select
              </Button>
            )}
          </div>
        )}
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
              className={`group flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                task.status === 'done' ? 'bg-muted/30' : 'bg-card hover:bg-muted/20'
              } ${selectedTasks.has(task.id) ? 'ring-2 ring-primary/50 bg-primary/5' : ''}`}
            >
              <div className="flex items-center gap-2 pt-0.5">
                {isSelectionMode ? (
                  <Checkbox
                    checked={selectedTasks.has(task.id)}
                    onCheckedChange={() => toggleTaskSelection(task.id)}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                ) : (
                  <Checkbox
                    checked={task.status === 'done'}
                    onCheckedChange={() => handleToggleTask(task)}
                    disabled={!canManageTasks}
                    className="border-primary data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                  />
                )}
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
              {canManageTasks && !isSelectionMode && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 flex-shrink-0 transition-opacity"
                  onClick={() => confirmDelete(task.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {taskToDelete ? 'Delete Task' : `Delete ${selectedTasks.size} Task(s)`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {taskToDelete 
                ? 'This will permanently remove this task. This action cannot be undone.'
                : `This will permanently remove ${selectedTasks.size} selected task(s). This action cannot be undone.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => taskToDelete ? handleDeleteTask(taskToDelete) : handleBulkDelete()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
