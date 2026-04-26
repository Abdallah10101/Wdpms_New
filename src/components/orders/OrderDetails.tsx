import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Pencil, Save, X, Printer, Sparkles, Waves } from 'lucide-react';
import type { Order } from '@/lib/types';

interface OrderDetailsProps {
  order: Order;
  canEdit: boolean;
  onUpdate: () => void;
}

export function OrderDetails({ order, canEdit, onUpdate }: OrderDetailsProps) {
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    product_name: order.product_name || '',
    size: order.size || '',
    collection: order.collection || '',
    fabric: order.fabric || '',
    supplier: order.supplier || '',
    quantity: order.quantity || 1,
    pieces_sent: order.pieces_sent || 0,
    has_printing: order.has_printing || false,
    has_embroidery: order.has_embroidery || false,
    has_wash_house: order.has_wash_house || false,
    created_at: order.created_at ? new Date(order.created_at).toISOString().slice(0, 16) : '',
  });

  const client = order.client as any;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          product_name: formData.product_name,
          size: formData.size || null,
          collection: formData.collection || null,
          fabric: formData.fabric || null,
          supplier: formData.supplier || null,
          quantity: formData.quantity,
          pieces_sent: formData.pieces_sent,
          has_printing: formData.has_printing,
          has_embroidery: formData.has_embroidery,
          has_wash_house: formData.has_wash_house,
          created_at: formData.created_at ? new Date(formData.created_at).toISOString() : order.created_at,
        })
        .eq('id', order.id);

      if (error) throw error;

      toast({
        title: 'Saved',
        description: 'Product details updated successfully.',
      });
      
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error saving:', error);
      toast({
        title: 'Error',
        description: 'Failed to save changes.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      product_name: order.product_name || '',
      size: order.size || '',
      collection: order.collection || '',
      fabric: order.fabric || '',
      supplier: order.supplier || '',
      quantity: order.quantity || 1,
      pieces_sent: order.pieces_sent || 0,
      has_printing: order.has_printing || false,
      has_embroidery: order.has_embroidery || false,
      has_wash_house: order.has_wash_house || false,
      created_at: order.created_at ? new Date(order.created_at).toISOString().slice(0, 16) : '',
    });
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Edit Details</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isSaving}>
              <Save className="h-4 w-4 mr-1" />
              {isSaving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="product_name">Pattern Name</Label>
            <Input
              id="product_name"
              value={formData.product_name}
              onChange={(e) => setFormData({ ...formData, product_name: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="size">Size</Label>
              <Input
                id="size"
                value={formData.size}
                onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                placeholder="e.g., M Sample"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="collection">Collection</Label>
              <Input
                id="collection"
                value={formData.collection}
                onChange={(e) => setFormData({ ...formData, collection: e.target.value })}
                placeholder="e.g., Summer 2026"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fabric">Fabric</Label>
            <Textarea
              id="fabric"
              value={formData.fabric}
              onChange={(e) => setFormData({ ...formData, fabric: e.target.value })}
              placeholder="e.g., Cherry 320 gsm sardonsuz (yazarlar)"
              className="min-h-[60px]"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="supplier">Supplier</Label>
            <Input
              id="supplier"
              value={formData.supplier}
              onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
              placeholder="e.g., Zirve Nakis"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity</Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pieces_sent">Pieces Sent</Label>
              <Input
                id="pieces_sent"
                type="number"
                min={0}
                value={formData.pieces_sent}
                onChange={(e) => setFormData({ ...formData, pieces_sent: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>

          {/* Created Date */}
          <div className="space-y-2">
            <Label htmlFor="created_at">Created Date</Label>
            <Input
              id="created_at"
              type="datetime-local"
              value={formData.created_at}
              onChange={(e) => setFormData({ ...formData, created_at: e.target.value })}
            />
          </div>

          {/* Process Types */}
          <div className="space-y-3">
            <Label>Process Types</Label>
            <p className="text-xs text-muted-foreground">
              Select which processes this product goes through
            </p>
            <div className="flex flex-wrap gap-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_has_printing"
                  checked={formData.has_printing}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, has_printing: checked === true })
                  }
                />
                <label
                  htmlFor="edit_has_printing"
                  className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                >
                  <Printer className="h-4 w-4 text-blue-500" />
                  Printing
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_has_embroidery"
                  checked={formData.has_embroidery}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, has_embroidery: checked === true })
                  }
                />
                <label
                  htmlFor="edit_has_embroidery"
                  className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-purple-500" />
                  Embroidery
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="edit_has_wash_house"
                  checked={formData.has_wash_house}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, has_wash_house: checked === true })
                  }
                />
                <label
                  htmlFor="edit_has_wash_house"
                  className="flex items-center gap-2 text-sm font-medium leading-none cursor-pointer"
                >
                  <Waves className="h-4 w-4 text-cyan-500" />
                  Wash House
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const specifications = [
    order.fabric && `Fabric : ${order.fabric}`,
    order.supplier && `Supplier : ${order.supplier}`,
    `Quantity : ${order.quantity} pieces`,
    order.pieces_sent && order.pieces_sent > 0 && `Pieces Sent : ${order.pieces_sent}`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
        </div>
      )}

      {/* Basic Details */}
      <div className="space-y-2">
        <p className="text-sm">
          <span className="text-muted-foreground">Pattern name : </span>
          <span className="font-medium">{order.product_name}</span>
        </p>
        {order.size && (
          <p className="text-sm">
            <span className="text-muted-foreground">Size : </span>
            <span className="font-medium">{order.size}</span>
          </p>
        )}
        {(order as any).size_breakdown && Object.keys((order as any).size_breakdown).length > 0 && (
          <p className="text-sm">
            <span className="text-muted-foreground">Sizes : </span>
            <span className="font-medium">
              {Object.entries((order as any).size_breakdown as Record<string, number>)
                .map(([s, n]) => `${s}: ${n}`)
                .join(', ')}
            </span>
          </p>
        )}
        {order.collection && (
          <p className="text-sm">
            <span className="text-muted-foreground">Collection : </span>
            <span className="font-medium">{order.collection}</span>
          </p>
        )}
      </div>

      {/* Product Description */}
      {specifications.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Product Description :</h4>
          <ul className="list-disc list-inside space-y-1 text-sm">
            {specifications.map((spec, index) => (
              <li key={index} className="text-muted-foreground">
                <span className="text-foreground">{spec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Process Types */}
      {(order.has_printing || order.has_embroidery || order.has_wash_house) && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Process Types :</h4>
          <div className="flex flex-wrap gap-2">
            {order.has_printing && (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <Printer className="h-3 w-3 text-blue-500" />
                Printing
              </Badge>
            )}
            {order.has_embroidery && (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-purple-500" />
                Embroidery
              </Badge>
            )}
            {order.has_wash_house && (
              <Badge variant="secondary" className="flex items-center gap-1.5">
                <Waves className="h-3 w-3 text-cyan-500" />
                Wash House
              </Badge>
            )}
          </div>
        </div>
      )}

      {/* Client Info */}
      {client && (
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Client :</h4>
          <p className="text-sm">
            {client.brand_name || client.name}
          </p>
        </div>
      )}
    </div>
  );
}
