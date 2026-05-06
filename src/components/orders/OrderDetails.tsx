import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  Pencil,
  Save,
  X,
  Printer,
  Sparkles,
  Waves,
  Tag,
  Shirt,
  Gift,
  Package as PackageIcon,
  Zap,
  Link2,
  Key,
  CircleDot,
} from 'lucide-react';
import type { Order } from '@/lib/types';

interface OrderDetailsProps {
  order: Order;
  canEdit: boolean;
  onUpdate: () => void;
}

// Keep these in sync with NewOrder.tsx so creation and editing share the same shape.
const SIZE_OPTIONS = ['XS', 'S', 'M', 'L', 'XL', 'XXL'] as const;
type SizeKey = typeof SIZE_OPTIONS[number];

const ACCESSORY_OPTIONS = [
  { key: 'neck_labels', label: 'Neck Labels', icon: Tag },
  { key: 'washing_labels', label: 'Washing Labels', icon: Shirt },
  { key: 'thanks_cards', label: 'Thanks Cards', icon: Gift },
  { key: 'hang_tags', label: 'Hang Tags', icon: Tag },
  { key: 'packaging', label: 'Packaging', icon: PackageIcon },
  { key: 'zippers', label: 'Zippers', icon: Zap },
  { key: 'rivets', label: 'Rivets', icon: CircleDot },
  { key: 'laces', label: 'Laces', icon: Link2 },
  { key: 'adjustables', label: 'Adjustables', icon: Link2 },
  { key: 'key_chain_holder', label: 'Key Chain Holder', icon: Key },
  { key: 'buttons', label: 'Buttons', icon: CircleDot },
] as const;

type AccessoryKey = typeof ACCESSORY_OPTIONS[number]['key'];

const EMPTY_SAMPLE_DETAILS = {
  pattern_name: '',
  pattern_maker: '',
  references_number: '',
  fabric_kgs: '',
  gsm: '',
  cut_and_sew_supplier: '',
  qc_sign_off: '',
};

export function OrderDetails({ order, canEdit, onUpdate }: OrderDetailsProps) {
  const { toast } = useToast();
  const { isAdmin } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Hydrate internal costs from the row, treating nulls as empty strings so
  // inputs stay controlled.
  const hydrateCosts = (o: Order) => ({
    fabric_cost: (o as any).fabric_cost == null ? '' : String((o as any).fabric_cost),
    pattern_cost: (o as any).pattern_cost == null ? '' : String((o as any).pattern_cost),
    cut_sew_cost: (o as any).cut_sew_cost == null ? '' : String((o as any).cut_sew_cost),
    cost_currency: (o as any).cost_currency || 'TRY',
  });

  // Hydrate sample_details from the row, falling back to empty strings so
  // the inputs stay controlled even on bulk orders that never set them.
  const hydrateSampleDetails = (o: Order) => {
    const sd = (o as any).sample_details as Record<string, any> | null;
    if (!sd) return { ...EMPTY_SAMPLE_DETAILS };
    return {
      pattern_name: sd.pattern_name ?? '',
      pattern_maker: sd.pattern_maker ?? '',
      references_number: sd.references_number ?? '',
      fabric_kgs: sd.fabric_kgs == null ? '' : String(sd.fabric_kgs),
      gsm: sd.gsm == null ? '' : String(sd.gsm),
      cut_and_sew_supplier: sd.cut_and_sew_supplier ?? '',
      qc_sign_off: sd.qc_sign_off ?? '',
    };
  };

  const hydrateAccessories = (o: Order) => {
    const sd = (o as any).sample_details as Record<string, any> | null;
    const stored: Array<{ key?: string; label?: string; qty?: number }> = Array.isArray(sd?.accessories) ? sd!.accessories : [];
    return ACCESSORY_OPTIONS.reduce((acc, opt) => {
      const match = stored.find((a) => a.key === opt.key || a.label === opt.label);
      acc[opt.key] = {
        enabled: !!match,
        qty: match?.qty != null ? String(match.qty) : '',
      };
      return acc;
    }, {} as Record<AccessoryKey, { enabled: boolean; qty: string }>);
  };

  const hydrateSizeBreakdown = (o: Order) => {
    const sb = (o as any).size_breakdown as Record<string, number> | null;
    return SIZE_OPTIONS.reduce((acc, s) => {
      acc[s] = sb && typeof sb[s] === 'number' ? String(sb[s]) : '';
      return acc;
    }, {} as Record<SizeKey, string>);
  };

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
  const [sampleDetails, setSampleDetails] = useState(() => hydrateSampleDetails(order));
  const [accessories, setAccessories] = useState(() => hydrateAccessories(order));
  const [sizeBreakdown, setSizeBreakdown] = useState(() => hydrateSizeBreakdown(order));
  const [costs, setCosts] = useState(() => hydrateCosts(order));

  const sizeBreakdownTotal = SIZE_OPTIONS.reduce(
    (sum, s) => sum + (parseInt(sizeBreakdown[s]) || 0),
    0,
  );

  const client = order.client as any;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Build the sample_details JSON. Only persist a non-null payload when
      // the user actually filled at least one field, so we don't stomp on a
      // pre-existing value with an empty object.
      const selectedAccessories = ACCESSORY_OPTIONS
        .filter((a) => accessories[a.key].enabled)
        .map((a) => ({ key: a.key, label: a.label, qty: Number(accessories[a.key].qty) || 0 }));
      const hasAnySampleDetail =
        Object.values(sampleDetails).some((v) => String(v).trim() !== '') ||
        selectedAccessories.length > 0;
      const sampleDetailsPayload = hasAnySampleDetail
        ? {
            ...sampleDetails,
            fabric_kgs: sampleDetails.fabric_kgs ? Number(sampleDetails.fabric_kgs) : null,
            gsm: sampleDetails.gsm ? Number(sampleDetails.gsm) : null,
            accessories: selectedAccessories,
          }
        : null;

      // Size breakdown: only include sizes the user actually set (>0).
      const sizeBreakdownPayload = SIZE_OPTIONS.reduce((acc, s) => {
        const n = parseInt(sizeBreakdown[s]);
        if (n > 0) acc[s] = n;
        return acc;
      }, {} as Record<string, number>);
      const hasSizeBreakdown = Object.keys(sizeBreakdownPayload).length > 0;

      // If the user filled the size breakdown, derive total quantity from it
      // so quantity and breakdown stay consistent.
      const finalQuantity = hasSizeBreakdown ? sizeBreakdownTotal : formData.quantity;

      const basePayload: Record<string, any> = {
        product_name: formData.product_name,
        size: formData.size || null,
        collection: formData.collection || null,
        fabric: formData.fabric || null,
        supplier: formData.supplier || null,
        quantity: finalQuantity,
        pieces_sent: formData.pieces_sent,
        has_printing: formData.has_printing,
        has_embroidery: formData.has_embroidery,
        has_wash_house: formData.has_wash_house,
        created_at: formData.created_at ? new Date(formData.created_at).toISOString() : order.created_at,
        sample_details: sampleDetailsPayload,
      };
      // Optional columns gated behind a migration are added conditionally so
      // we can fall back if PGRST204 says the column doesn't exist yet.
      basePayload.size_breakdown = hasSizeBreakdown ? sizeBreakdownPayload : null;
      // Internal costs — only admins see these inputs but the persistence is
      // unconditional so admin-managed values aren't silently dropped.
      if (isAdmin) {
        basePayload.fabric_cost = costs.fabric_cost === '' ? null : Number(costs.fabric_cost);
        basePayload.pattern_cost = costs.pattern_cost === '' ? null : Number(costs.pattern_cost);
        basePayload.cut_sew_cost = costs.cut_sew_cost === '' ? null : Number(costs.cut_sew_cost);
        basePayload.cost_currency = costs.cost_currency || 'TRY';
      }

      let { error } = await supabase
        .from('orders')
        .update(basePayload as any)
        .eq('id', order.id);

      // Retry without optional columns if any are missing on this DB.
      if (error && (error as any).code === 'PGRST204') {
        const {
          size_breakdown: _omitSize,
          fabric_cost: _omitF,
          pattern_cost: _omitP,
          cut_sew_cost: _omitC,
          cost_currency: _omitCur,
          ...payloadStripped
        } = basePayload;
        const retry = await supabase
          .from('orders')
          .update(payloadStripped as any)
          .eq('id', order.id);
        error = retry.error;
        if (!error) {
          const skipped: string[] = [];
          if (hasSizeBreakdown) skipped.push('size breakdown');
          if (isAdmin && (costs.fabric_cost || costs.pattern_cost || costs.cut_sew_cost)) skipped.push('internal costs');
          if (skipped.length) {
            toast({
              title: `Saved without ${skipped.join(' & ')}`,
              description: 'The latest Supabase migration is not deployed on this database yet.',
            });
          }
        }
      }

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
    setSampleDetails(hydrateSampleDetails(order));
    setAccessories(hydrateAccessories(order));
    setSizeBreakdown(hydrateSizeBreakdown(order));
    setCosts(hydrateCosts(order));
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
              <Label htmlFor="quantity">
                Quantity
                {sizeBreakdownTotal > 0 && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    (auto from sizes: {sizeBreakdownTotal})
                  </span>
                )}
              </Label>
              <Input
                id="quantity"
                type="number"
                min={1}
                value={sizeBreakdownTotal > 0 ? sizeBreakdownTotal : formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                disabled={sizeBreakdownTotal > 0}
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

          {/* Size Breakdown */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <Label>Sizes</Label>
              {sizeBreakdownTotal > 0 && (
                <span className="text-xs text-muted-foreground">
                  Total: <span className="font-semibold text-foreground">{sizeBreakdownTotal}</span>
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Per-size piece counts. The total replaces the Quantity field above.
            </p>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
              {SIZE_OPTIONS.map((s) => (
                <div key={s} className="space-y-1">
                  <Label htmlFor={`edit_size_${s}`} className="text-xs">{s}</Label>
                  <Input
                    id={`edit_size_${s}`}
                    type="number"
                    min={0}
                    placeholder="0"
                    value={sizeBreakdown[s]}
                    onChange={(e) =>
                      setSizeBreakdown({ ...sizeBreakdown, [s]: e.target.value })
                    }
                  />
                </div>
              ))}
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

          {/* Sample / Production Details */}
          <div className="space-y-3 pt-2 border-t">
            <h4 className="text-sm font-semibold">
              {order.supplier === 'sample' ? 'Sample Details' : 'Production Details'}
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="edit_pattern_name">Pattern Name</Label>
                <Input
                  id="edit_pattern_name"
                  value={sampleDetails.pattern_name}
                  onChange={(e) => setSampleDetails({ ...sampleDetails, pattern_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_pattern_maker">Pattern Maker</Label>
                <Input
                  id="edit_pattern_maker"
                  value={sampleDetails.pattern_maker}
                  onChange={(e) => setSampleDetails({ ...sampleDetails, pattern_maker: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_references_number">References Number</Label>
                <Input
                  id="edit_references_number"
                  value={sampleDetails.references_number}
                  onChange={(e) => setSampleDetails({ ...sampleDetails, references_number: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_fabric_kgs">Amount of Fabric (KGS)</Label>
                <Input
                  id="edit_fabric_kgs"
                  type="number"
                  step="0.01"
                  min={0}
                  value={sampleDetails.fabric_kgs}
                  onChange={(e) => setSampleDetails({ ...sampleDetails, fabric_kgs: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_gsm">GSM</Label>
                <Input
                  id="edit_gsm"
                  type="number"
                  min={0}
                  value={sampleDetails.gsm}
                  onChange={(e) => setSampleDetails({ ...sampleDetails, gsm: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit_cut_and_sew_supplier">Cut & Sew Supplier</Label>
                <Input
                  id="edit_cut_and_sew_supplier"
                  value={sampleDetails.cut_and_sew_supplier}
                  onChange={(e) => setSampleDetails({ ...sampleDetails, cut_and_sew_supplier: e.target.value })}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="edit_qc_sign_off">QC Sign Off</Label>
                <Input
                  id="edit_qc_sign_off"
                  value={sampleDetails.qc_sign_off}
                  onChange={(e) => setSampleDetails({ ...sampleDetails, qc_sign_off: e.target.value })}
                  placeholder="Name of QC who signed off"
                />
              </div>
            </div>
          </div>

          {/* Accessories */}
          <div className="space-y-3 pt-2 border-t">
            <Label>Accessories</Label>
            <p className="text-xs text-muted-foreground">
              Toggle the accessories needed and enter quantity for each.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              {ACCESSORY_OPTIONS.map(({ key, label, icon: Icon }) => {
                const entry = accessories[key];
                return (
                  <div key={key} className="flex items-center gap-3">
                    <div className="flex items-center space-x-2 flex-1 min-w-0">
                      <Checkbox
                        id={`edit_acc_${key}`}
                        checked={entry.enabled}
                        onCheckedChange={(checked) =>
                          setAccessories({
                            ...accessories,
                            [key]: { ...entry, enabled: checked === true },
                          })
                        }
                      />
                      <label
                        htmlFor={`edit_acc_${key}`}
                        className="flex items-center gap-2 text-sm font-medium cursor-pointer truncate"
                      >
                        <Icon className="h-4 w-4 text-orange-500" />
                        {label}
                      </label>
                    </div>
                    {entry.enabled && (
                      <Input
                        type="number"
                        min={0}
                        placeholder="Qty"
                        value={entry.qty}
                        onChange={(e) =>
                          setAccessories({
                            ...accessories,
                            [key]: { ...entry, qty: e.target.value },
                          })
                        }
                        className="w-20 h-8"
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Internal Costs (admin-only). Per-unit costs in the chosen currency.
              Used to compute profit and margin when an invoice is created. */}
          {isAdmin && (
            <div className="space-y-3 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label>Internal Costs</Label>
                <Select
                  value={costs.cost_currency}
                  onValueChange={(v) => setCosts({ ...costs, cost_currency: v })}
                >
                  <SelectTrigger className="w-32 h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['TRY', 'EUR', 'USD', 'GBP', 'AED', 'SAR'].map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground">
                Per-unit costs in the selected currency. Never appear on the client invoice.
              </p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="edit_fabric_cost" className="text-xs">Fabric Cost</Label>
                  <Input
                    id="edit_fabric_cost"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costs.fabric_cost}
                    onChange={(e) => setCosts({ ...costs, fabric_cost: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_pattern_cost" className="text-xs">Pattern Cost</Label>
                  <Input
                    id="edit_pattern_cost"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costs.pattern_cost}
                    onChange={(e) => setCosts({ ...costs, pattern_cost: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="edit_cut_sew_cost" className="text-xs">Cut & Sew Cost</Label>
                  <Input
                    id="edit_cut_sew_cost"
                    type="number"
                    step="0.01"
                    min={0}
                    placeholder="0.00"
                    value={costs.cut_sew_cost}
                    onChange={(e) => setCosts({ ...costs, cut_sew_cost: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
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

      {/* Sample / Production Details — captured at order creation */}
      {(() => {
        const sd = (order as any).sample_details as Record<string, any> | null;
        if (!sd) return null;
        const rows: Array<[string, string]> = [];
        if (sd.pattern_name) rows.push(['Pattern Name', String(sd.pattern_name)]);
        if (sd.pattern_maker) rows.push(['Pattern Maker', String(sd.pattern_maker)]);
        if (sd.references_number) rows.push(['References Number', String(sd.references_number)]);
        if (sd.fabric_kgs != null && sd.fabric_kgs !== '') rows.push(['Amount of Fabric (KGS)', String(sd.fabric_kgs)]);
        if (sd.gsm != null && sd.gsm !== '') rows.push(['GSM', String(sd.gsm)]);
        if (sd.cut_and_sew_supplier) rows.push(['Cut & Sew Supplier', String(sd.cut_and_sew_supplier)]);
        if (sd.qc_sign_off) rows.push(['QC Sign Off', String(sd.qc_sign_off)]);
        const accessories = Array.isArray(sd.accessories)
          ? sd.accessories.filter((a: any) => a && a.label)
          : [];
        if (rows.length === 0 && accessories.length === 0) return null;
        return (
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">
              {order.supplier === 'sample' ? 'Sample Details' : 'Production Details'} :
            </h4>
            {rows.length > 0 && (
              <div className="space-y-1">
                {rows.map(([label, value]) => (
                  <p key={label} className="text-sm">
                    <span className="text-muted-foreground">{label} : </span>
                    <span className="font-medium">{value}</span>
                  </p>
                ))}
              </div>
            )}
            {accessories.length > 0 && (
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Accessories :</p>
                <div className="flex flex-wrap gap-2">
                  {accessories.map((a: any, i: number) => (
                    <Badge key={`${a.key || a.label}-${i}`} variant="secondary">
                      {a.label}
                      {a.qty ? ` × ${a.qty}` : ''}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Internal Costs (admin-only). Read-only display; the Edit button gives
          access to the input fields above. */}
      {isAdmin && (() => {
        const fc = (order as any).fabric_cost;
        const pc = (order as any).pattern_cost;
        const csc = (order as any).cut_sew_cost;
        const cur = (order as any).cost_currency || 'TRY';
        if (fc == null && pc == null && csc == null) return null;
        const totalUnit = (Number(fc) || 0) + (Number(pc) || 0) + (Number(csc) || 0);
        const fmt = (v: any) => {
          if (v == null) return '—';
          try {
            return new Intl.NumberFormat('en-US', { style: 'currency', currency: cur, minimumFractionDigits: 2 }).format(Number(v));
          } catch {
            return `${cur} ${Number(v).toFixed(2)}`;
          }
        };
        return (
          <div className="space-y-2 p-3 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-sm">Internal Costs</h4>
              <Badge variant="outline" className="text-[10px] uppercase tracking-wide">Admin only</Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Fabric</p>
                <p className="font-medium">{fmt(fc)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pattern</p>
                <p className="font-medium">{fmt(pc)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cut & Sew</p>
                <p className="font-medium">{fmt(csc)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total / unit</p>
                <p className="font-semibold">{fmt(totalUnit)}</p>
              </div>
            </div>
          </div>
        );
      })()}

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
