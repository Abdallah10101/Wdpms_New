import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Plus, BarChart3, Trash2, Calendar } from 'lucide-react';
import type { OrderAnalysis } from '@/lib/types';
import { OrderAnalysisDialog } from './OrderAnalysisDialog';

interface Props {
  clientId: string;
  client: { name: string; brand_name?: string } | null;
}

function formatCurrency(value: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(0)}`;
  }
}

export default function OrderAnalysisTab({ clientId, client }: Props) {
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<OrderAnalysis[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<OrderAnalysis | null>(null);

  const fetchAnalyses = async () => {
    try {
      const { data, error } = await (supabase
        .from('order_analyses' as any)
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setAnalyses((data || []) as OrderAnalysis[]);
    } catch (err) {
      console.error('Error fetching analyses:', err);
      toast({
        title: 'Error',
        description: 'Failed to load analyses.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyses();
  }, [clientId]);

  const handleDelete = async (id: string) => {
    try {
      const { error } = await (supabase
        .from('order_analyses' as any)
        .delete()
        .eq('id', id) as any);

      if (error) throw error;

      setAnalyses((prev) => prev.filter((a) => a.id !== id));
      toast({ title: 'Deleted', description: 'Analysis has been removed.' });
    } catch (err) {
      console.error('Error deleting analysis:', err);
      toast({
        title: 'Error',
        description: 'Failed to delete analysis.',
        variant: 'destructive',
      });
    }
  };

  const handleOpenCreate = () => {
    setSelectedAnalysis(null);
    setDialogOpen(true);
  };

  const handleOpenView = (analysis: OrderAnalysis) => {
    setSelectedAnalysis(analysis);
    setDialogOpen(true);
  };

  const clientName = client?.brand_name || client?.name || 'Client';

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    if (margin >= 15) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    return 'bg-red-100 text-red-800 border-red-200';
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {analyses.length} analysis{analyses.length !== 1 ? 'es' : ''} saved
          </p>
          <Button onClick={handleOpenCreate} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Analysis
          </Button>
        </div>

        {analyses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BarChart3 className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-muted-foreground">No analyses yet</p>
              <p className="text-sm text-muted-foreground">
                Create your first order analysis to track profitability.
              </p>
              <Button onClick={handleOpenCreate} className="mt-4" variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                New Analysis
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {analyses.map((analysis) => (
              <Card
                key={analysis.id}
                className="cursor-pointer transition-colors hover:bg-accent"
                onClick={() => handleOpenView(analysis)}
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{analysis.analysis_title}</p>
                      {analysis.invoice_ref && (
                        <p className="text-xs text-muted-foreground truncate">
                          Ref: {analysis.invoice_ref}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-xs ${getMarginColor(analysis.margin_pct)}`}
                    >
                      {analysis.margin_pct.toFixed(1)}%
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Revenue</p>
                      <p className="text-sm font-semibold">
                        {formatCurrency(analysis.total_revenue, analysis.display_currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Costs</p>
                      <p className="text-sm font-semibold">
                        {formatCurrency(analysis.total_costs, analysis.display_currency)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase text-muted-foreground font-medium">Profit</p>
                      <p className="text-sm font-semibold text-emerald-600">
                        {formatCurrency(analysis.total_profit, analysis.display_currency)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(analysis.analysis_date).toLocaleDateString()}
                    </span>
                    {analysis.supplier && (
                      <span className="truncate max-w-[120px]">{analysis.supplier}</span>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent onClick={(e) => e.stopPropagation()}>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Analysis</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete "{analysis.analysis_title}"?
                            This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDelete(analysis.id);
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <OrderAnalysisDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        clientId={clientId}
        clientName={clientName}
        existing={selectedAnalysis}
        onSaved={fetchAnalyses}
      />
    </>
  );
}
