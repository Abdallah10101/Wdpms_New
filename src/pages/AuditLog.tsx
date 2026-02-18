import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { History, ExternalLink, Download } from 'lucide-react';
import { PRODUCTION_STAGES, type OrderStageHistory } from '@/lib/types';
import { format } from 'date-fns';

interface AuditEntry extends OrderStageHistory {
  order?: { order_number: string; product_name: string };
  changer?: { full_name: string };
}

export default function AuditLog() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      const { data, error } = await supabase
        .from('order_stage_history')
        .select(`
          *,
          order:orders(order_number, product_name),
          changer:profiles!order_stage_history_changed_by_fkey(full_name)
        `)
        .order('changed_at', { ascending: false })
        .limit(200);

      if (error) throw error;
      setEntries((data || []) as AuditEntry[]);
    } catch (error) {
      console.error('Error fetching audit log:', error);
      toast({ title: 'Error', description: 'Failed to load audit log.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const getStageConfig = (stage: string) =>
    PRODUCTION_STAGES.find(s => s.value === stage);

  const exportCSV = () => {
    const headers = ['Timestamp', 'Order #', 'Product', 'From Stage', 'To Stage', 'Changed By'];
    const rows = entries.map(e => [
      format(new Date(e.changed_at), 'yyyy-MM-dd HH:mm:ss'),
      e.order?.order_number || '',
      e.order?.product_name || '',
      e.from_stage || '',
      e.to_stage,
      e.changer?.full_name || 'System',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'audit-log.csv'; a.click();
    URL.revokeObjectURL(url);
  };

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
            <p className="text-muted-foreground">Full history of order stage changes</p>
          </div>
          <Button variant="outline" onClick={exportCSV}>
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">{entries.length} stage changes recorded</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="space-y-3 p-6">
                {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : entries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <History className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No stage changes recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {entries.map((entry) => {
                  const fromCfg = entry.from_stage ? getStageConfig(entry.from_stage) : null;
                  const toCfg = getStageConfig(entry.to_stage);
                  return (
                    <div key={entry.id} className="flex items-center gap-4 px-6 py-3 hover:bg-muted/30 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-medium text-primary">
                            {entry.order?.order_number || 'Unknown Order'}
                          </span>
                          <span className="text-sm text-muted-foreground truncate">
                            {entry.order?.product_name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          {fromCfg && (
                            <>
                              <Badge variant="outline" className="text-xs">
                                {fromCfg.label}
                              </Badge>
                              <span className="text-muted-foreground text-xs">→</span>
                            </>
                          )}
                          <Badge className={`${toCfg?.color || 'bg-gray-500'} text-white text-xs`}>
                            {toCfg?.label || entry.to_stage}
                          </Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">
                          {entry.changer?.full_name || 'System'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(entry.changed_at), 'MMM d, yyyy h:mm a')}
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
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
