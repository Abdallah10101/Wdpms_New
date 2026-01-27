import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import {
  File,
  FileText,
  Image,
  Trash2,
  Upload,
  Download,
  FolderOpen,
  CheckSquare,
  Square,
  X,
} from 'lucide-react';
import { format } from 'date-fns';

interface OrderFile {
  id: string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  category: string | null;
  is_client_visible: boolean;
  uploaded_by: string | null;
  created_at: string;
}

const FILE_CATEGORIES = [
  { value: 'techpack', label: 'Tech Pack' },
  { value: 'design', label: 'Design' },
  { value: 'photo', label: 'Photo' },
  { value: 'shipping', label: 'Shipping' },
  { value: 'invoice_1', label: 'Invoice (Internal)' },
  { value: 'invoice_2', label: 'Invoice (Client)' },
  { value: 'other', label: 'Other' },
];

interface OrderFilesProps {
  orderId: string;
}

export function OrderFiles({ orderId }: OrderFilesProps) {
  const { toast } = useToast();
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('other');
  const [isClientVisible, setIsClientVisible] = useState(false);
  
  // Selection mode
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<OrderFile | null>(null);

  useEffect(() => {
    fetchFiles();
  }, [orderId]);

  const fetchFiles = async () => {
    try {
      const { data, error } = await supabase
        .from('order_files')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const timestamp = Date.now();
      const ext = file.name.split('.').pop();
      const filePath = `${orderId}/${selectedCategory}_${timestamp}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase.from('order_files').insert({
        order_id: orderId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        category: selectedCategory,
        is_client_visible: isClientVisible,
      });

      if (dbError) throw dbError;

      toast({ title: 'Success', description: 'File uploaded successfully.' });
      fetchFiles();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload file.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDeleteFile = async (file: OrderFile) => {
    try {
      // Delete from storage
      await supabase.storage.from('order-files').remove([file.file_path]);

      // Delete from database
      const { error } = await supabase
        .from('order_files')
        .delete()
        .eq('id', file.id);

      if (error) throw error;

      // Optimistic update
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      toast({ title: 'Deleted', description: 'File deleted successfully.' });
    } catch (error) {
      console.error('Error deleting file:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete file.',
        variant: 'destructive',
      });
      fetchFiles();
    }
  };

  const handleBulkDelete = async () => {
    const filesToDelete = files.filter((f) => selectedFiles.has(f.id));
    
    try {
      // Delete from storage
      const paths = filesToDelete.map((f) => f.file_path);
      await supabase.storage.from('order-files').remove(paths);

      // Delete from database
      const { error } = await supabase
        .from('order_files')
        .delete()
        .in('id', Array.from(selectedFiles));

      if (error) throw error;

      // Optimistic update
      setFiles((prev) => prev.filter((f) => !selectedFiles.has(f.id)));
      setSelectedFiles(new Set());
      setSelectionMode(false);
      
      toast({
        title: 'Deleted',
        description: `${filesToDelete.length} file(s) deleted successfully.`,
      });
    } catch (error) {
      console.error('Error deleting files:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete files.',
        variant: 'destructive',
      });
      fetchFiles();
    }
  };

  const handleDownload = async (file: OrderFile) => {
    try {
      const { data, error } = await supabase.storage
        .from('order-files')
        .download(file.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = file.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading file:', error);
      toast({
        title: 'Error',
        description: 'Failed to download file.',
        variant: 'destructive',
      });
    }
  };

  const toggleFileSelection = (fileId: string) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(fileId)) {
        newSet.delete(fileId);
      } else {
        newSet.add(fileId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === files.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(files.map((f) => f.id)));
    }
  };

  const getFileIcon = (fileType: string | null) => {
    if (!fileType) return <File className="h-4 w-4" />;
    if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
    return <FileText className="h-4 w-4" />;
  };

  const getCategoryLabel = (category: string | null) => {
    const cat = FILE_CATEGORIES.find((c) => c.value === category);
    return cat?.label || 'Other';
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <FolderOpen className="h-5 w-5" />
          Files
          {files.length > 0 && (
            <span className="text-sm text-muted-foreground">({files.length})</span>
          )}
        </h3>
        <div className="flex gap-2">
          {files.length > 0 && (
            <Button
              variant={selectionMode ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => {
                setSelectionMode(!selectionMode);
                setSelectedFiles(new Set());
              }}
            >
              {selectionMode ? (
                <>
                  <X className="h-4 w-4 mr-1" />
                  Cancel
                </>
              ) : (
                <>
                  <CheckSquare className="h-4 w-4 mr-1" />
                  Select
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Upload Section */}
      <div className="border rounded-lg p-4 space-y-3 bg-muted/30">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label className="text-xs">Category</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILE_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.value} value={cat.value}>
                    {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Visibility</Label>
            <div className="flex items-center h-9 gap-2">
              <Checkbox
                id="client-visible"
                checked={isClientVisible}
                onCheckedChange={(checked) => setIsClientVisible(!!checked)}
              />
              <Label htmlFor="client-visible" className="text-sm font-normal cursor-pointer">
                Visible to client
              </Label>
            </div>
          </div>
        </div>
        <div className="relative">
          <Input
            type="file"
            onChange={handleUpload}
            disabled={isUploading}
            className="cursor-pointer file:mr-4 file:py-1 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
          />
          {isUploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80">
              <span className="text-sm">Uploading...</span>
            </div>
          )}
        </div>
      </div>

      {/* Selection Actions */}
      {selectionMode && selectedFiles.size > 0 && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg border border-destructive/20">
          <span className="text-sm font-medium">
            {selectedFiles.size} selected
          </span>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
          >
            <Trash2 className="h-4 w-4 mr-1" />
            Delete Selected
          </Button>
          <Button variant="ghost" size="sm" onClick={selectAll}>
            {selectedFiles.size === files.length ? 'Deselect All' : 'Select All'}
          </Button>
        </div>
      )}

      {/* Files List */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading files...</div>
      ) : files.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <FolderOpen className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>No files uploaded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                selectedFiles.has(file.id)
                  ? 'bg-primary/10 border-primary/30'
                  : 'bg-card hover:bg-muted/50'
              }`}
            >
              {selectionMode && (
                <Checkbox
                  checked={selectedFiles.has(file.id)}
                  onCheckedChange={() => toggleFileSelection(file.id)}
                />
              )}
              <div className="flex-shrink-0 text-muted-foreground">
                {getFileIcon(file.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file.file_name}</p>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="px-1.5 py-0.5 bg-muted rounded">
                    {getCategoryLabel(file.category)}
                  </span>
                  {file.file_size && <span>{formatFileSize(file.file_size)}</span>}
                  <span>{format(new Date(file.created_at), 'MMM d, yyyy')}</span>
                  {file.is_client_visible && (
                    <span className="text-green-600 dark:text-green-400">• Client visible</span>
                  )}
                </div>
              </div>
              {!selectionMode && (
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleDownload(file)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => setFileToDelete(file)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Single File Delete Dialog */}
      <AlertDialog open={!!fileToDelete} onOpenChange={() => setFileToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete File</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{fileToDelete?.file_name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (fileToDelete) {
                  handleDeleteFile(fileToDelete);
                  setFileToDelete(null);
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedFiles.size} Files</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedFiles.size} file(s)? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                handleBulkDelete();
                setDeleteDialogOpen(false);
              }}
            >
              Delete All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
