import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  History, ExternalLink, Download, UserX, UserCheck, UserPlus,
  ShieldAlert, ArrowRightLeft, Building2, Pencil, Trash2, Truck, FileText, MessageSquare,
} from 'lucide-react';
import { PRODUCTION_STAGES } from '@/lib/types';
import { format } from 'date-fns';

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
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && role === 'client') navigate('/dashboard');
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client') {
      fetchAuditLog();
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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <History className="h-6 w-6" />
              Audit Log
            </h1>
            <p className="text-muted-foreground">Full history of all system actions</p>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

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

                  // Activity log entry
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
      </div>
    </DashboardLayout>
  );
}
