import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { MessageSquare, Send, Eye, EyeOff, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import type { OrderNote } from '@/lib/types';

interface OrderNotesProps {
  orderId: string;
  isClientView?: boolean;
}

export function OrderNotes({ orderId, isClientView = false }: OrderNotesProps) {
  const { user, role, profile } = useAuth();
  const { toast } = useToast();
  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState('');
  const [isClientVisible, setIsClientVisible] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchNotes();
  }, [orderId]);

  const fetchNotes = async () => {
    try {
      const { data, error } = await supabase
        .from('order_notes')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch author profiles separately
      const authorIds = [...new Set(data?.map(n => n.author_id).filter(Boolean) || [])];
      let profilesMap: Record<string, any> = {};
      
      if (authorIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', authorIds);
        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', authorIds);

        profiles?.forEach(p => {
          profilesMap[p.user_id] = p;
        });
        rolesData?.forEach(r => {
          if (profilesMap[r.user_id]) profilesMap[r.user_id].role = r.role;
        });
      }

      const notesWithAuthors = (data || []).map(note => ({
        ...note,
        author: note.author_id ? profilesMap[note.author_id] : null,
      }));
      
      setNotes(notesWithAuthors as OrderNote[]);
    } catch (error) {
      console.error('Error fetching notes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!newNote.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabase
        .from('order_notes')
        .insert({
          order_id: orderId,
          content: newNote.trim(),
          author_id: user?.id,
          is_client_visible: isClientVisible,
          author_name: profile?.full_name || user?.email || 'Unknown',
          author_role: role || 'team',
        } as any);

      if (error) throw error;

      setNewNote('');
      setIsClientVisible(false);
      fetchNotes();
      
      toast({
        title: 'Note Added',
        description: 'Your note has been added successfully.',
      });
    } catch (error) {
      console.error('Error adding note:', error);
      toast({
        title: 'Error',
        description: 'Failed to add note.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const logActivity = async (actionType: string, targetName: string, details: Record<string, any> = {}) => {
    try {
      const { error } = await (supabase.from as any)('activity_log').insert({
        action_type: actionType,
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email || 'Unknown',
        target_name: targetName,
        details,
      });
      if (error) console.error('Activity log insert error:', error);
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
  };

  const handleDelete = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    try {
      const { error } = await supabase
        .from('order_notes')
        .delete()
        .eq('id', noteId);

      if (error) throw error;

      await logActivity('note_deleted', orderId, {
        content_preview: note?.content?.slice(0, 100) || '',
        was_client_visible: note?.is_client_visible || false,
        author: (note?.author as any)?.full_name || 'Unknown',
      });

      fetchNotes();

      toast({
        title: 'Note Deleted',
        description: 'The note has been removed.',
      });
    } catch (error) {
      console.error('Error deleting note:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete note.',
        variant: 'destructive',
      });
    }
  };

  const canAddNotes = role === 'admin' || role === 'team';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-primary" />
        <h3 className="font-semibold">Comments</h3>
        <Badge variant="secondary" className="text-xs">
          {notes.length}
        </Badge>
      </div>

      {/* Add Note Form */}
      {canAddNotes && (
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
              <Textarea
                placeholder="Add a comment..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[80px] resize-none"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="client-visible"
                    checked={isClientVisible}
                    onCheckedChange={(checked) => setIsClientVisible(checked as boolean)}
                  />
                  <label
                    htmlFor="client-visible"
                    className="flex items-center gap-1 text-sm text-muted-foreground cursor-pointer"
                  >
                    {isClientVisible ? (
                      <Eye className="h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                    Visible to client
                  </label>
                </div>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!newNote.trim() || isSubmitting}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {isSubmitting ? 'Sending...' : 'Send'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notes List */}
      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading comments...</p>
        ) : notes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No comments yet. Add one above!
          </p>
        ) : (
          notes.map((note) => (
            <Card key={note.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs">
                    {(note.author as any)?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">
                      {(note.author as any)?.full_name || 'Unknown'}
                    </span>
                    {(note.author as any)?.role === 'admin' && (
                      <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">Admin</Badge>
                    )}
                    {(note.author as any)?.role === 'team' && (
                      <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Team</Badge>
                    )}
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(note.created_at), 'MMM d, yyyy h:mm a')}
                    </span>
                    {note.is_client_visible ? (
                      <Badge variant="outline" className="text-xs text-green-600 border-green-300">
                        <Eye className="h-3 w-3 mr-1" />
                        Client visible
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        <EyeOff className="h-3 w-3 mr-1" />
                        Internal
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{note.content}</p>
                </div>
                {(role === 'admin' || note.author_id === user?.id) && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(note.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
