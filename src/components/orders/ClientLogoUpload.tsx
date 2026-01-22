import { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Link as LinkIcon, Loader2 } from 'lucide-react';
import type { Client } from '@/lib/types';

interface ClientLogoUploadProps {
  client: Client | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ClientLogoUpload({ client, open, onOpenChange, onSuccess }: ClientLogoUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [logoUrl, setLogoUrl] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !client) return;

    setIsUploading(true);
    try {
      // Upload to Supabase storage
      const fileExt = file.name.split('.').pop();
      const fileName = `client-logos/${client.id}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('order-files')
        .getPublicUrl(fileName);

      // Update client with logo URL
      const { error: updateError } = await supabase
        .from('clients')
        .update({ logo_url: urlData.publicUrl } as any)
        .eq('id', client.id);

      if (updateError) throw updateError;

      toast({ title: 'Logo updated successfully' });
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload logo',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleUrlSubmit = async () => {
    if (!logoUrl.trim() || !client) return;

    setIsUploading(true);
    try {
      const { error } = await supabase
        .from('clients')
        .update({ logo_url: logoUrl.trim() } as any)
        .eq('id', client.id);

      if (error) throw error;

      toast({ title: 'Logo updated successfully' });
      onSuccess();
      onOpenChange(false);
      setLogoUrl('');
    } catch (error) {
      console.error('Error updating logo:', error);
      toast({
        title: 'Error',
        description: 'Failed to update logo',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            Update Logo for {client?.brand_name || client?.name}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="url">Image URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
            <Button
              variant="outline"
              className="w-full h-32 border-dashed"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
            >
              {isUploading ? (
                <Loader2 className="h-8 w-8 animate-spin" />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="h-8 w-8" />
                  <span>Click to upload image</span>
                </div>
              )}
            </Button>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="logo-url">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="logo-url"
                  placeholder="https://..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
                <Button onClick={handleUrlSubmit} disabled={isUploading || !logoUrl.trim()}>
                  {isUploading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <LinkIcon className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
