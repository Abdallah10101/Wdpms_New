import { useEffect, useMemo, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Image as ImageIcon, Upload, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CLIENT_STAGE_IMAGE_STAGES,
  STAGE_IMAGE_LABELS,
  STAGE_IMAGE_CATEGORIES,
  categoryToStage,
  stageToImageCategory,
  type ClientStageImageStage,
} from '@/lib/stage-images';

interface StageImageRow {
  id: string;
  order_id: string;
  category: string | null;
  file_name: string;
  file_path: string;
  created_at: string;
  file_type: string | null;
}

interface StageImageItem extends StageImageRow {
  signedUrl: string | null;
}

interface OrderStageImagesProps {
  orderId: string;
  canUpload: boolean;
}

export function OrderStageImages({ orderId, canUpload }: OrderStageImagesProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [removingStage, setRemovingStage] = useState<ClientStageImageStage | null>(null);
  const [selectedStage, setSelectedStage] = useState<ClientStageImageStage>('cutting');
  const [stageImages, setStageImages] = useState<
    Partial<Record<ClientStageImageStage, StageImageItem>>
  >({});

  useEffect(() => {
    fetchStageImages();
  }, [orderId]);

  const fetchStageImages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('order_files')
        .select('id, order_id, category, file_name, file_path, created_at, file_type')
        .eq('order_id', orderId)
        .eq('is_client_visible', true)
        .in('category', STAGE_IMAGE_CATEGORIES)
        .order('created_at', { ascending: false });

      if (error) throw error;

      console.log('[StageImages] DB rows returned:', data?.length, data);

      const latestByStage: Partial<Record<ClientStageImageStage, StageImageRow>> = {};
      for (const row of (data || []) as StageImageRow[]) {
        const stage = categoryToStage(row.category);
        if (!stage || latestByStage[stage]) continue;
        latestByStage[stage] = row;
      }

      const signedImageEntries = await Promise.all(
        CLIENT_STAGE_IMAGE_STAGES.map(async (stage) => {
          const row = latestByStage[stage];
          if (!row) return [stage, undefined] as const;

          const { data: signedData, error: signedError } = await supabase.storage
            .from('order-files')
            .createSignedUrl(row.file_path, 60 * 60);

          console.log(`[StageImages] signedUrl for "${stage}":`, signedData?.signedUrl ?? null, signedError ?? 'no error');

          if (signedError) {
            console.error(`createSignedUrl failed for stage "${stage}" (path: ${row.file_path}):`, signedError);
          }

          return [
            stage,
            {
              ...row,
              signedUrl: signedData?.signedUrl ?? null,
            },
          ] as const;
        }),
      );

      setStageImages(
        signedImageEntries.reduce((acc, [stage, item]) => {
          if (item) acc[stage] = item;
          return acc;
        }, {} as Partial<Record<ClientStageImageStage, StageImageItem>>),
      );
    } catch (error) {
      console.error('Error fetching stage images:', error);
      toast({
        title: 'Error',
        description: 'Failed to load stage images.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const currentImage = useMemo(() => stageImages[selectedStage], [selectedStage, stageImages]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      event.target.value = '';
      return;
    }

    setIsUploading(true);
    try {
      const category = stageToImageCategory(selectedStage);
      const existing = stageImages[selectedStage];

      if (existing) {
        await supabase.storage.from('order-files').remove([existing.file_path]);
        await supabase.from('order_files').delete().eq('id', existing.id);
      }

      const timestamp = Date.now();
      const ext = file.name.split('.').pop() || 'jpg';
      const safeExt = ext.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'jpg';
      const filePath = `${orderId}/stage-images/${selectedStage}_${timestamp}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(filePath, file, { upsert: false });

      console.log('[StageImages] storage upload result:', uploadError ?? 'success', 'path:', filePath);
      if (uploadError) throw uploadError;

      const { error: insertError } = await supabase.from('order_files').insert({
        order_id: orderId,
        file_name: file.name,
        file_path: filePath,
        file_type: file.type,
        file_size: file.size,
        category,
        is_client_visible: true,
      });

      console.log('[StageImages] DB insert result:', insertError ?? 'success', 'category:', category);
      if (insertError) throw insertError;

      toast({
        title: 'Image uploaded',
        description: `${STAGE_IMAGE_LABELS[selectedStage]} image is now visible to the client.`,
      });

      await fetchStageImages();
    } catch (error) {
      console.error('Error uploading stage image:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload stage image.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      event.target.value = '';
    }
  };

  const handleRemove = async (stage: ClientStageImageStage) => {
    const image = stageImages[stage];
    if (!image) return;

    setRemovingStage(stage);
    try {
      const { error: storageError } = await supabase.storage
        .from('order-files')
        .remove([image.file_path]);
      if (storageError) throw storageError;

      const { error: dbError } = await supabase.from('order_files').delete().eq('id', image.id);
      if (dbError) throw dbError;

      toast({
        title: 'Image removed',
        description: `${STAGE_IMAGE_LABELS[stage]} image has been deleted.`,
      });

      await fetchStageImages();
    } catch (error) {
      console.error('Error removing stage image:', error);
      toast({
        title: 'Delete failed',
        description: 'Could not remove stage image.',
        variant: 'destructive',
      });
    } finally {
      setRemovingStage(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Client Stage Images</h3>
        <p className="text-sm text-muted-foreground">
          Upload one image per stage. Clients can view these updates.
        </p>
      </div>

      {canUpload && (
        <div className="grid gap-3 md:grid-cols-[200px_1fr]">
          <div className="space-y-2">
            <Label>Select Stage</Label>
            <Select
              value={selectedStage}
              onValueChange={(value) => setSelectedStage(value as ClientStageImageStage)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENT_STAGE_IMAGE_STAGES.map((stage) => (
                  <SelectItem key={stage} value={stage}>
                    {STAGE_IMAGE_LABELS[stage]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="stage-image-upload">Upload Image</Label>
            <Input
              id="stage-image-upload"
              type="file"
              accept="image/*"
              disabled={isUploading}
              onChange={handleUpload}
            />
            <p className="text-xs text-muted-foreground">
              Uploading to {STAGE_IMAGE_LABELS[selectedStage]}. Uploading a new file replaces the previous one.
            </p>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading stage images...</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {CLIENT_STAGE_IMAGE_STAGES.map((stage) => {
            const image = stageImages[stage];

            return (
              <div key={stage} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{STAGE_IMAGE_LABELS[stage]}</p>
                  <div className="flex items-center gap-1">
                    {image?.signedUrl && (
                      <Button size="icon" variant="ghost" asChild>
                        <a href={image.signedUrl} target="_blank" rel="noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    {canUpload && image && (
                      <Button
                        size="icon"
                        variant="ghost"
                        disabled={removingStage === stage}
                        onClick={() => handleRemove(stage)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </div>

                {image?.signedUrl ? (
                  <>
                    <a href={image.signedUrl} target="_blank" rel="noreferrer">
                      <img
                        src={image.signedUrl}
                        alt={`${STAGE_IMAGE_LABELS[stage]} update`}
                        className="h-36 w-full rounded-md object-contain border bg-muted/30"
                      />
                    </a>
                    <p className="text-xs text-muted-foreground">
                      Uploaded {formatDistanceToNow(new Date(image.created_at), { addSuffix: true })}
                    </p>
                  </>
                ) : (
                  <div className="h-36 w-full rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                    <div className="flex items-center gap-2 text-sm">
                      <ImageIcon className="h-4 w-4" />
                      No image
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {canUpload && currentImage?.signedUrl && (
        <Button variant="outline" size="sm" asChild>
          <a href={currentImage.signedUrl} target="_blank" rel="noreferrer">
            <Upload className="mr-2 h-4 w-4" />
            View Current {STAGE_IMAGE_LABELS[selectedStage]} Image
          </a>
        </Button>
      )}
    </div>
  );
}
