import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  History, ExternalLink, Download, UserX, UserCheck, UserPlus,
  ShieldAlert, ArrowRightLeft, Building2, Pencil, Trash2, Truck, FileText, MessageSquare, Eye, EyeOff,
} from 'lucide-react';
import { PRODUCTION_STAGES } from '@/lib/types';
import { format } from 'date-fns';

type MessageLogEntry = {
  id: string;
  event_type: string;
  note_id: string;
  order_id: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  content: string;
  is_client_visible: boolean;
  deleted_by_name: string | null;
  order_number: string | null;
  product_name: string | null;
  created_at: string;
  original_created_at: string;
};

type UnifiedEntry = {
  id: string;
  created_at: string;
  entry_type: 'stage_change' | 'activity';
  actor_name?: string;
  // stage_change
  order?: { order_number: string; product_name: string };
  order_id?: string;
  from_stage?: string;
  to_stage?: string;
  // activity
  action_type?: string;
  target_name?: string;
  details?: Record<string, any>;
};

const ACTION_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  user_created:       { label: 'Created user',      icon: <UserPlus className="h-4 w-4" />,    color: 'text-blue-500' },
  user_suspended:     { label: 'Suspended user',    icon: <UserX className="h-4 w-4" />,       color: 'text-red-500' },
  user_reactivated:   { label: 'Reactivated user',  icon: <UserCheck className="h-4 w-4" />,   color: 'text-green-500' },
  role_changed:       { label: 'Changed role',      icon: <ShieldAlert className="h-4 w-4" />,  color: 'text-amber-500' },
  client_created:     { label: 'Created client',    icon: <Building2 className="h-4 w-4" />,    color: 'text-blue-500' },
  client_updated:     { label: 'Updated client',    icon: <Pencil className="h-4 w-4" />,       color: 'text-amber-500' },
  client_deleted:     { label: 'Deleted client',    icon: <Trash2 className="h-4 w-4" />,       color: 'text-red-500' },
  client_bulk_deleted:{ label: 'Bulk deleted clients', icon: <Trash2 className="h-4 w-4" />,    color: 'text-red-500' },
  supplier_created:     { label: 'Created supplier',    icon: <Truck className="h-4 w-4" />,      color: 'text-blue-500' },
  supplier_updated:     { label: 'Updated supplier',    icon: <Pencil className="h-4 w-4" />,     color: 'text-amber-500' },
  supplier_deleted:     { label: 'Deleted supplier',    icon: <Trash2 className="h-4 w-4" />,     color: 'text-red-500' },
  supplier_bulk_deleted:{ label: 'Bulk deleted suppliers', icon: <Trash2 className="h-4 w-4" />,  color: 'text-red-500' },
  csv_exported:         { label: 'Exported CSV',           icon: <Download className="h-4 w-4" />,   color: 'text-emerald-500' },
  invoice_created:      { label: 'Created invoice',        icon: <FileText className="h-4 w-4" />,   color: 'text-blue-500' },
  invoice_deleted:      { label: 'Deleted invoice',        icon: <Trash2 className="h-4 w-4" />,     color: 'text-red-500' },
  note_deleted:         { label: 'Deleted note',           icon: <MessageSquare className="h-4 w-4" />, color: 'text-red-500' },
};

function describeActivity(entry: UnifiedEntry): string {
  const t = entry.target_name || 'Unknown';
  switch (entry.action_type) {
    case 'user_created':
      return `Created user ${t}${entry.details?.role ? ` as ${entry.details.role}` : ''}`;
    case 'user_suspended':
      return `Suspended ${t}`;
    case 'user_reactivated':
      return `Reactivated ${t}`;
    case 'role_changed': {
      const from = entry.details?.from_role ? ` from ${entry.details.from_role}` : '';
      const to = entry.details?.to_role ? ` to ${entry.details.to_role}` : '';
      return `Changed ${t}'s role${from}${to}`;
    }
    case 'client_created':
      return `Created client ${t}`;
    case 'client_updated':
      return `Updated client ${t}`;
    case 'client_deleted':
      return `Deleted client ${t}`;
    case 'client_bulk_deleted':
      return `Bulk deleted ${t}${entry.details?.names ? `: ${entry.details.names.join(', ')}` : ''}`;
    case 'supplier_created':
      return `Created supplier ${t}`;
    case 'supplier_updated':
      return `Updated supplier ${t}`;
    case 'supplier_deleted':
      return `Deleted supplier ${t}`;
    case 'supplier_bulk_deleted':
      return `Bulk deleted ${t}${entry.details?.names ? `: ${entry.details.names.join(', ')}` : ''}`;
    case 'csv_exported':
      return `Exported ${t} CSV (${entry.details?.count || 0} records)`;
    case 'invoice_created':
      return `Created invoice ${t}${entry.details?.client ? ` for ${entry.details.client}` : ''}`;
    case 'invoice_deleted':
      return `Deleted invoice ${t}${entry.details?.client ? ` (${entry.details.client})` : ''}`;
    case 'note_deleted':
      return `Deleted note on order${entry.details?.was_client_visible ? ' (was client-visible)' : ''}${entry.details?.content_preview ? `: "${entry.details.content_preview}"` : ''}`;
    default:
      return entry.action_type || 'Unknown action';
  }
}

export default function AuditLog() {
  const navigate = useNavigate();
  const { user, role, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [entries, setEntries] = useState<UnifiedEntry[]>([]);
  const [messageLog, setMessageLog] = useState<MessageLogEntry[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [orderClientMap, setOrderClientMap] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [filter, setFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('audit');
  const [msgFilter, setMsgFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && role === 'client') navigate('/dashboard');
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client') {
      fetchAuditLog();
      fetchMessageLog();
      fetchClients();
    }
  }, [user, role]);

  const fetchAuditLog = async () => {
    try {
      // Fetch order stage history
      const { data: stageData, error: stageError } = await supabase
        .from('order_stage_history')
        .select(`*, order:orders(order_number, product_name)`)
        .order('changed_at', { ascending: false })
        .limit(200);

      if (stageError) throw stageError;

      // Separately fetch profiles for changed_by IDs
      const changerIds = [...new Set((stageData || []).map((e: any) => e.changed_by).filter(Boolean))];
      let profilesMap: Record<string, string> = {};
      if (changerIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', changerIds);
        (profiles || []).forEach((p: any) => { profilesMap[p.id] = p.full_name; });
      }

      const stageEntries: UnifiedEntry[] = (stageData || []).map((e: any) => ({
        id: `stage-${e.id}`,
        created_at: e.changed_at,
        entry_type: 'stage_change',
        actor_name: e.changed_by && profilesMap[e.changed_by] ? profilesMap[e.changed_by] : 'System',
        order: e.order,
        order_id: e.order_id,
        from_stage: e.from_stage,
        to_stage: e.to_stage,
      }));

      // Fetch activity log
      const { data: activityData } = await (supabase.from as any)('activity_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      const activityEntries: UnifiedEntry[] = (activityData || []).map((e: any) => ({
        id: `activity-${e.id}`,
        created_at: e.created_at,
        entry_type: 'activity',
        actor_name: e.actor_name || 'Unknown',
        action_type: e.action_type,
        target_name: e.target_name,
        details: e.details,
      }));

      // Merge and sort newest first
      const merged = [...stageEntries, ...activityEntries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setEntries(merged);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      toast({ title: 'Error', description: 'Failed to load audit log.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMessageLog = async () => {
    try {
      const { data, error } = await (supabase.from as any)('message_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (error) throw error;
      setMessageLog((data || []) as MessageLogEntry[]);

      // Build order_id → client_id map for filtering
      const orderIds = [...new Set((data || []).map((m: any) => m.order_id).filter(Boolean))];
      if (orderIds.length > 0) {
        const { data: orders } = await supabase
          .from('orders')
          .select('id, client_id')
          .in('id', orderIds);
        const map: Record<string, string> = {};
        (orders || []).forEach((o: any) => { map[o.id] = o.client_id; });
        setOrderClientMap(map);
      }
    } catch (error) {
      console.error('Error fetching message log:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const fetchClients = async () => {
    try {
      const { data } = await supabase
        .from('clients')
        .select('id, name')
        .order('name');
      setClients((data || []) as { id: string; name: string }[]);
    } catch (error) {
      console.error('Error fetching clients:', error);
    }
  };

  const getStageConfig = (stage: string) => PRODUCTION_STAGES.find(s => s.value === stage);

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
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const exportCSV = () => {
    const headers = ['Timestamp', 'Type', 'Actor', 'Description', 'Order #'];
    const rows = entries.map(e => {
      if (e.entry_type === 'stage_change') {
        const from = e.from_stage ? getStageConfig(e.from_stage)?.label || e.from_stage : '';
        const to = getStageConfig(e.to_stage || '')?.label || e.to_stage || '';
        return [
          format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss'),
          'Stage Change',
          e.actor_name || '',
          `${e.order?.product_name || ''}: ${from} → ${to}`,
          e.order?.order_number || '',
        ];
      }
      return [
        format(new Date(e.created_at), 'yyyy-MM-dd HH:mm:ss'),
        'Activity',
        e.actor_name || '',
        describeActivity(e),
        '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
    logActivity('csv_exported', 'audit_log', { count: entries.length });
  };

  const exportMessageCSV = () => {
    const headers = ['Timestamp', 'Event', 'Author', 'Role', 'Order #', 'Product', 'Client Visible', 'Content', 'Deleted By'];
    const rows = filteredMessages.map(m => [
      format(new Date(m.created_at), 'yyyy-MM-dd HH:mm:ss'),
      m.event_type === 'message_sent' ? 'Sent' : 'Deleted',
      m.author_name,
      m.author_role,
      m.order_number || '',
      m.product_name || '',
      m.is_client_visible ? 'Yes' : 'No',
      m.content,
      m.deleted_by_name || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'message-log.csv'; a.click();
    URL.revokeObjectURL(url);
    logActivity('csv_exported', 'message_log', { count: filteredMessages.length });
  };

  const filteredMessages = messageLog.filter((m) => {
    // Role/type filter
    if (msgFilter === 'sent' && m.event_type !== 'message_sent') return false;
    if (msgFilter === 'deleted' && m.event_type !== 'message_deleted') return false;
    if (msgFilter === 'client' && m.author_role !== 'client') return false;
    if (msgFilter === 'admin' && m.author_role !== 'admin') return false;
    if (msgFilter === 'team' && m.author_role !== 'team') return false;
    // Client filter
    if (clientFilter !== 'all') {
      const msgClientId = orderClientMap[m.order_id];
      if (msgClientId !== clientFilter) return false;
    }
    return true;
  });

  const filteredEntries = entries.filter((entry) => {
    if (filter === 'all') return true;
    if (filter === 'stage_changes') return entry.entry_type === 'stage_change';
    if (filter === 'users') return ['user_created', 'user_suspended', 'user_reactivated', 'role_changed'].includes(entry.action_type || '');
    if (filter === 'clients') return ['client_created', 'client_updated', 'client_deleted', 'client_bulk_deleted'].includes(entry.action_type || '');
    if (filter === 'suppliers') return ['supplier_created', 'supplier_updated', 'supplier_deleted', 'supplier_bulk_deleted'].includes(entry.action_type || '');
    if (filter === 'invoices') return ['invoice_created', 'invoice_deleted'].includes(entry.action_type || '');
    if (filter === 'exports') return entry.action_type === 'csv_exported';
    return true;
  });

  if (authLoading || !user) return null;

  const getRoleBadge = (r: string) => {
    if (r === 'admin') return <Badge className="bg-red-500 text-white text-[10px] px-1.5 py-0">Admin</Badge>;
    if (r === 'team') return <Badge className="bg-blue-500 text-white text-[10px] px-1.5 py-0">Team</Badge>;
    if (r === 'client') return <Badge className="bg-yellow-500 text-white text-[10px] px-1.5 py-0">Client</Badge>;
    return null;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <History className="h-6 w-6" />
            Audit Log
          </h1>
          <p className="text-muted-foreground">Full history of all system actions and communications</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="audit">
              <History className="mr-2 h-4 w-4" />
              System Log
            </TabsTrigger>
            <TabsTrigger value="messages">
              <MessageSquare className="mr-2 h-4 w-4" />
              Message Log
              <Badge variant="secondary" className="ml-2 text-xs">{messageLog.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* System Audit Log Tab */}
          <TabsContent value="audit" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Select value={filter} onValueChange={setFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Events</SelectItem>
                    <SelectItem value="stage_changes">Stage Changes</SelectItem>
                    <SelectItem value="users">User Actions</SelectItem>
                    <SelectItem value="clients">Client Actions</SelectItem>
                    <SelectItem value="suppliers">Supplier Actions</SelectItem>
                    <SelectItem value="invoices">Invoice Actions</SelectItem>
                    <SelectItem value="exports">CSV Exports</SelectItem>
                  </SelectContent>
                </Select>
                {filter !== 'all' && (
                  <span className="text-sm text-muted-foreground">
                    {filteredEntries.length} of {entries.length} events
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={exportCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">{filteredEntries.length} events {filter !== 'all' ? 'matching filter' : 'recorded'}</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="space-y-3 p-6">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : filteredEntries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <History className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      {filter !== 'all' ? 'No events match this filter' : 'No events recorded yet'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredEntries.map((entry) => {
                      if (entry.entry_type === 'stage_change') {
                        const fromCfg = entry.from_stage ? getStageConfig(entry.from_stage) : null;
                        const toCfg = getStageConfig(entry.to_stage || '');
                        return (
                          <div key={entry.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                            <div className="shrink-0 text-muted-foreground">
                              <ArrowRightLeft className="h-4 w-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                {entry.order_id ? (
                                  <Link to={`/orders/${entry.order_id}`} className="font-mono text-sm font-medium text-primary hover:underline">
                                    {entry.order?.order_number || 'Unknown Order'}
                                  </Link>
                                ) : (
                                  <span className="font-mono text-sm font-medium text-primary">
                                    {entry.order?.order_number || 'Unknown Order'}
                                  </span>
                                )}
                                <span className="text-sm text-muted-foreground truncate">
                                  {entry.order?.product_name}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1">
                                {fromCfg && (
                                  <>
                                    <Badge variant="outline" className="text-xs">{fromCfg.label}</Badge>
                                    <span className="text-muted-foreground text-xs">→</span>
                                  </>
                                )}
                                <Badge className={`${toCfg?.color || 'bg-gray-500'} text-white text-xs`}>
                                  {toCfg?.label || entry.to_stage}
                                </Badge>
                              </div>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-xs text-muted-foreground">{entry.actor_name}</p>
                              <p className="text-xs text-muted-foreground">
                                {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                              </p>
                            </div>
                            {entry.order_id && (
                              <Link to={`/orders/${entry.order_id}`}>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          </div>
                        );
                      }

                      const cfg = ACTION_CONFIG[entry.action_type || ''];
                      const isInvoiceAction = entry.action_type === 'invoice_created' || entry.action_type === 'invoice_deleted';
                      return (
                        <div key={entry.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                          <div className={`shrink-0 ${cfg?.color || 'text-muted-foreground'}`}>
                            {cfg?.icon || <History className="h-4 w-4" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">{describeActivity(entry)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {cfg?.label || entry.action_type}
                              {entry.details?.total != null && (
                                <span className="ml-2 font-medium">
                                  — Total: {Number(entry.details.total).toFixed(2)}
                                </span>
                              )}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">{entry.actor_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(entry.created_at), 'MMM d, yyyy h:mm a')}
                            </p>
                          </div>
                          {isInvoiceAction && entry.action_type === 'invoice_created' && (
                            <Link to="/invoices">
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="View in Invoices">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Message Log Tab */}
          <TabsContent value="messages" className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Select value={msgFilter} onValueChange={setMsgFilter}>
                  <SelectTrigger className="w-44">
                    <SelectValue placeholder="Filter messages" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Messages</SelectItem>
                    <SelectItem value="sent">Sent Only</SelectItem>
                    <SelectItem value="deleted">Deleted Only</SelectItem>
                    <SelectItem value="admin">From Admin</SelectItem>
                    <SelectItem value="team">From Team</SelectItem>
                    <SelectItem value="client">From Client</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={clientFilter} onValueChange={setClientFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by client" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Clients</SelectItem>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(msgFilter !== 'all' || clientFilter !== 'all') && (
                  <span className="text-sm text-muted-foreground">
                    {filteredMessages.length} of {messageLog.length} messages
                  </span>
                )}
              </div>
              <Button variant="outline" onClick={exportMessageCSV}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {filteredMessages.length} messages logged
                </CardTitle>
                <CardDescription>
                  Permanent record of all communications. Messages cannot be erased from this log.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingMessages ? (
                  <div className="space-y-3 p-6">
                    {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
                  </div>
                ) : filteredMessages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare className="h-12 w-12 text-muted-foreground/50" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      {msgFilter !== 'all' ? 'No messages match this filter' : 'No messages logged yet'}
                    </p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {filteredMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`px-6 py-3 hover:bg-muted/30 transition-colors ${
                          msg.event_type === 'message_deleted' ? 'bg-red-500/5' : ''
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          <div className={`shrink-0 mt-1 ${msg.event_type === 'message_deleted' ? 'text-red-500' : 'text-yellow-500'}`}>
                            {msg.event_type === 'message_deleted' ? (
                              <Trash2 className="h-4 w-4" />
                            ) : (
                              <MessageSquare className="h-4 w-4" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium">{msg.author_name}</span>
                              {getRoleBadge(msg.author_role)}
                              {msg.event_type === 'message_deleted' && (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0">DELETED</Badge>
                              )}
                              {msg.is_client_visible ? (
                                <Eye className="h-3 w-3 text-green-500" />
                              ) : (
                                <EyeOff className="h-3 w-3 text-muted-foreground" />
                              )}
                              {msg.order_number && (
                                <Link
                                  to={`/orders/${msg.order_id}`}
                                  className="text-xs font-mono text-primary hover:underline"
                                >
                                  {msg.order_number}
                                </Link>
                              )}
                              {msg.product_name && (
                                <span className="text-xs text-muted-foreground">{msg.product_name}</span>
                              )}
                            </div>
                            <p className={`text-sm mt-1 whitespace-pre-wrap ${msg.event_type === 'message_deleted' ? 'line-through text-muted-foreground' : ''}`}>
                              {msg.content}
                            </p>
                            {msg.event_type === 'message_deleted' && msg.deleted_by_name && (
                              <p className="text-xs text-red-500 mt-1">
                                Deleted by {msg.deleted_by_name}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(msg.original_created_at || msg.created_at), 'MMM d, yyyy')}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {format(new Date(msg.original_created_at || msg.created_at), 'h:mm a')}
                            </p>
                          </div>
                          {msg.order_id && (
                            <Link to={`/orders/${msg.order_id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
