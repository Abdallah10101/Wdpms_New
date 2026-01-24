import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { FileText, Upload, X, Download, Loader2 } from 'lucide-react';

interface OrderFile {
  id: string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  created_at: string;
}

interface OrderInvoicesProps {
  orderId: string;
}

export function OrderInvoices({ orderId }: OrderInvoicesProps) {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<OrderFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploading, setUploading] = useState<{ [key: string]: boolean }>({
    invoice_1: false,
    invoice_2: false,
  });

  useEffect(() => {
    fetchInvoices();
  }, [orderId]);

  const fetchInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('order_files')
        .select('*')
        .eq('order_id', orderId)
        .in('category', ['invoice_1', 'invoice_2'])
        .order('created_at', { ascending: true });

      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      console.error('Error fetching invoices:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getInvoice = (slot: 'invoice_1' | 'invoice_2') => {
    return invoices.find((inv) => inv.category === slot);
  };

  const handleUpload = async (
    slot: 'invoice_1' | 'invoice_2',
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading((prev) => ({ ...prev, [slot]: true }));

    try {
      // Check if there's an existing invoice in this slot
      const existingInvoice = getInvoice(slot);
      if (existingInvoice) {
        // Delete the old file from storage
        await supabase.storage
          .from('order-files')
          .remove([existingInvoice.file_path]);

        // Delete the old record
        await supabase.from('order_files').delete().eq('id', existingInvoice.id);
      }

      // Upload new file
      const fileExt = file.name.split('.').pop();
      const filePath = `${orderId}/${slot}_${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Create file record
      const { error: dbError } = await supabase.from('order_files').insert({
        order_id: orderId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        category: slot,
        is_client_visible: true,
      });

      if (dbError) throw dbError;

      toast({
        title: 'Invoice uploaded',
        description: `${slot === 'invoice_1' ? 'Cost Invoice' : 'Client Invoice'} has been uploaded successfully.`,
      });

      fetchInvoices();
    } catch (error) {
      console.error('Error uploading invoice:', error);
      toast({
        title: 'Upload failed',
        description: 'Failed to upload invoice. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading((prev) => ({ ...prev, [slot]: false }));
      // Reset the input
      event.target.value = '';
    }
  };

  const handleDelete = async (slot: 'invoice_1' | 'invoice_2') => {
    const invoice = getInvoice(slot);
    if (!invoice) return;

    try {
      // Delete from storage
      await supabase.storage.from('order-files').remove([invoice.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('order_files')
        .delete()
        .eq('id', invoice.id);

      if (error) throw error;

      toast({
        title: 'Invoice removed',
        description: 'Invoice has been removed successfully.',
      });

      fetchInvoices();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to remove invoice. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = async (invoice: OrderFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-files')
        .download(invoice.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = invoice.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading invoice:', error);
      toast({
        title: 'Download failed',
        description: 'Failed to download invoice. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const renderSlot = (slot: 'invoice_1' | 'invoice_2', label: string) => {
    const invoice = getInvoice(slot);
    const isUploading = uploading[slot];

    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      );
    }

    if (invoice) {
      return (
        <div className="relative p-4 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors group">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{invoice.file_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFileSize(invoice.file_size)}
              </p>
            </div>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8"
                onClick={() => handleDownload(invoice)}
              >
                <Download className="h-4 w-4" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleDelete(slot)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <label className="flex flex-col items-center justify-center h-24 border-2 border-dashed border-muted-foreground/25 rounded-lg hover:border-primary/50 hover:bg-muted/30 transition-colors cursor-pointer">
        <input
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={(e) => handleUpload(slot, e)}
          disabled={isUploading}
        />
        {isUploading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <>
            <Upload className="h-6 w-6 text-muted-foreground mb-2" />
            <span className="text-sm text-muted-foreground">Upload {label}</span>
          </>
        )}
      </label>
    );
  };

  return (
    <div className="space-y-4">
      <h3 className="font-semibold flex items-center gap-2">
        <FileText className="h-5 w-5" />
        Invoices
      </h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Cost Invoice</label>
          {renderSlot('invoice_1', 'Cost Invoice')}
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Client Invoice</label>
          {renderSlot('invoice_2', 'Client Invoice')}
        </div>
      </div>
    </div>
  );
}
