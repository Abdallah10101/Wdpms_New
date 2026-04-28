import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Loader2, Printer, Sparkles, Waves, Layers, FlaskConical, Tag, Shirt, Gift, Package as PackageIcon, Zap, Link2, Key, CircleDot } from 'lucide-react';
import { PRIORITY_CONFIG, type Client, type OrderPriority } from '@/lib/types';

type OrderType = 'sample' | 'bulk';

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

export default function NewOrder() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderType, setOrderType] = useState<OrderType | null>(null);

  const [formData, setFormData] = useState({
    product_name: '',
    client_id: '',
    collection: '',
    size: '',
    notes: '',
    quantity: 1,
    delivery_date: '',
    priority: 'medium' as OrderPriority,
    has_printing: false,
    has_embroidery: false,
    has_wash_house: false,
  });

  // Sample-specific fields
  const [sampleDetails, setSampleDetails] = useState({
    pattern_name: '',
    pattern_maker: '',
    references_number: '',
    fabric_kgs: '',
    gsm: '',
    cut_and_sew_supplier: '',
    qc_sign_off: '',
  });
  const [accessories, setAccessories] = useState<Record<AccessoryKey, { enabled: boolean; qty: string }>>(
    () => ACCESSORY_OPTIONS.reduce((acc, a) => ({ ...acc, [a.key]: { enabled: false, qty: '' } }), {} as Record<AccessoryKey, { enabled: boolean; qty: string }>)
  );

  const [sizeBreakdown, setSizeBreakdown] = useState<Record<SizeKey, string>>(
    () => SIZE_OPTIONS.reduce((acc, s) => ({ ...acc, [s]: '' }), {} as Record<SizeKey, string>)
  );

  const sizeBreakdownTotal = SIZE_OPTIONS.reduce(
    (sum, s) => sum + (parseInt(sizeBreakdown[s]) || 0),
    0
  );

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role !== 'admin') {
      navigate('/dashboard');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role === 'admin') {
      fetchClients();
    }
  }, [user, role]);

  const fetchClients = async () => {
    try {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .order('name');

      if (error) throw error;
      setClients((data || []) as Client[]);
    } catch (error) {
      console.error('Error fetching clients:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // For sample orders, start at 'sample' stage; for bulk, start at 'cutting'
      const initialStage = orderType === 'sample' ? 'sample' : 'cutting';
      
      // Build sample_details JSON for sample orders
      const selectedAccessories = ACCESSORY_OPTIONS
        .filter((a) => accessories[a.key].enabled)
        .map((a) => ({ key: a.key, label: a.label, qty: Number(accessories[a.key].qty) || 0 }));

      // Sample details + accessories are now captured for bulk orders as well.
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

      // Build size breakdown JSON from non-empty entries
      const sizeBreakdownPayload = SIZE_OPTIONS.reduce((acc, s) => {
        const n = parseInt(sizeBreakdown[s]);
        if (n > 0) acc[s] = n;
        return acc;
      }, {} as Record<string, number>);
      const hasSizeBreakdown = Object.keys(sizeBreakdownPayload).length > 0;

      // If user filled the size breakdown, derive total quantity from it
      const finalQuantity = hasSizeBreakdown ? sizeBreakdownTotal : formData.quantity;

      // Base payload — guaranteed to have columns that already exist on the table.
      const basePayload: Record<string, any> = {
        product_name: formData.product_name,
        client_id: formData.client_id,
        collection: formData.collection || null,
        size: orderType === 'sample' ? (formData.size || null) : null, // Only save size for samples
        fabric: formData.notes || null, // Using fabric column for notes
        supplier: orderType, // Store order type in supplier column
        quantity: finalQuantity,
        delivery_date: formData.delivery_date || null,
        priority: formData.priority,
        created_by: user?.id,
        has_printing: formData.has_printing,
        has_embroidery: formData.has_embroidery,
        has_wash_house: formData.has_wash_house,
        current_stage: initialStage,
        sample_details: sampleDetailsPayload,
      };
      // Only include size_breakdown when the user actually filled it in. This
      // also avoids a PGRST204 ("column not found") error if the DB migration
      // that adds the column hasn't been deployed yet.
      if (hasSizeBreakdown) {
        basePayload.size_breakdown = sizeBreakdownPayload;
      }

      let { data, error } = await supabase
        .from('orders')
        .insert(basePayload as any)
        .select()
        .single();

      // If the size_breakdown column doesn't exist yet (migration pending),
      // retry without it so order creation still works — but warn the user
      // that the size breakdown wasn't saved.
      if (error && (error as any).code === 'PGRST204' && hasSizeBreakdown) {
        const { size_breakdown: _omit, ...payloadWithoutSizes } = basePayload;
        const retry = await supabase
          .from('orders')
          .insert(payloadWithoutSizes as any)
          .select()
          .single();
        data = retry.data;
        error = retry.error;
        if (!error) {
          toast({
            title: 'Order saved without size breakdown',
            description: 'The size breakdown column is not deployed yet — ask an admin to run the latest Supabase migration.',
          });
        }
      }

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Order created successfully.',
      });

      navigate(`/orders/${data.id}`);
    } catch (error) {
      console.error('Error creating order:', error);
      toast({
        title: 'Error',
        description: 'Failed to create order.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading || !user || role !== 'admin') {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => orderType ? setOrderType(null) : navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Order</h1>
            <p className="text-muted-foreground">
              {orderType ? `Create a new ${orderType} order` : 'Select order type'}
            </p>
          </div>
        </div>

        {/* Order Type Selection */}
        {!orderType && (
          <Card>
            <CardHeader>
              <CardTitle>Select Order Type</CardTitle>
              <CardDescription>
                Choose whether this is a sample or bulk order
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setOrderType('sample')}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <FlaskConical className="h-12 w-12 text-purple-500" />
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Sample</h3>
                    <p className="text-sm text-muted-foreground">
                      Create a sample order with size specifications
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('bulk')}
                  className="flex flex-col items-center justify-center gap-3 p-6 rounded-lg border-2 border-border hover:border-primary hover:bg-primary/5 transition-all"
                >
                  <Layers className="h-12 w-12 text-blue-500" />
                  <div className="text-center">
                    <h3 className="font-semibold text-lg">Bulk</h3>
                    <p className="text-sm text-muted-foreground">
                      Create a bulk production order
                    </p>
                  </div>
                </button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Order Form - Only show after type selection */}
        {orderType && (
        <form onSubmit={handleSubmit}>
          <Card>
            <CardHeader>
              <CardTitle>Order Details</CardTitle>
              <CardDescription>
                Fill in the {orderType} order information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Basic Info */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="product_name">Product Name *</Label>
                  <Input
                    id="product_name"
                    value={formData.product_name}
                    onChange={(e) =>
                      setFormData({ ...formData, product_name: e.target.value })
                    }
                    required
                  />
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="client_id">Client *</Label>
                  <Select
                    value={formData.client_id}
                    onValueChange={(value) =>
                      setFormData({ ...formData, client_id: value })
                    }
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.brand_name || client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clients.length === 0 && !isLoading && (
                    <p className="text-sm text-muted-foreground">
                      No clients found.{' '}
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => navigate('/clients')}
                      >
                        Create a client first
                      </Button>
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="collection">Collection</Label>
                  <Input
                    id="collection"
                    value={formData.collection}
                    onChange={(e) =>
                      setFormData({ ...formData, collection: e.target.value })
                    }
                  />
                </div>

                {/* Only show size field for sample orders */}
                {orderType === 'sample' && (
                  <div className="space-y-2">
                    <Label htmlFor="size">Size</Label>
                    <Input
                      id="size"
                      value={formData.size}
                      onChange={(e) =>
                        setFormData({ ...formData, size: e.target.value })
                      }
                    />
                  </div>
                )}

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    placeholder="Add any notes about the product..."
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quantity">
                    Quantity *
                    {sizeBreakdownTotal > 0 && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        (auto from sizes: {sizeBreakdownTotal})
                      </span>
                    )}
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    min="1"
                    value={sizeBreakdownTotal > 0 ? sizeBreakdownTotal : formData.quantity}
                    onChange={(e) =>
                      setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })
                    }
                    disabled={sizeBreakdownTotal > 0}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="priority">Priority</Label>
                  <Select
                    value={formData.priority}
                    onValueChange={(value) =>
                      setFormData({ ...formData, priority: value as OrderPriority })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_CONFIG.map((priority) => (
                        <SelectItem key={priority.value} value={priority.value}>
                          {priority.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) =>
                      setFormData({ ...formData, delivery_date: e.target.value })
                    }
                  />
                </div>

                {/* Size Breakdown */}
                <div className="space-y-3 sm:col-span-2 pt-2">
                  <div className="flex items-center justify-between">
                    <Label>Sizes</Label>
                    {sizeBreakdownTotal > 0 && (
                      <span className="text-xs text-muted-foreground">
                        Total: <span className="font-semibold text-foreground">{sizeBreakdownTotal}</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter how many pieces per size. Leave empty if not used. The total will be saved as the order quantity.
                  </p>
                  <div className="grid gap-3 grid-cols-3 sm:grid-cols-6">
                    {SIZE_OPTIONS.map((s) => (
                      <div key={s} className="space-y-1">
                        <Label htmlFor={`size_${s}`} className="text-xs">{s}</Label>
                        <Input
                          id={`size_${s}`}
                          type="number"
                          min="0"
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

                {/* Process Types / Design Types */}
                <div className="space-y-3 sm:col-span-2">
                  <Label>{orderType === 'sample' ? 'Design Types' : 'Process Types'}</Label>
                  <p className="text-xs text-muted-foreground">
                    Select which {orderType === 'sample' ? 'design techniques' : 'processes'} this product will go through
                  </p>
                  <div className="flex flex-wrap gap-4">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has_printing"
                        checked={formData.has_printing}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, has_printing: checked === true })
                        }
                      />
                      <label
                        htmlFor="has_printing"
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <Printer className="h-4 w-4 text-blue-500" />
                        Printing
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has_embroidery"
                        checked={formData.has_embroidery}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, has_embroidery: checked === true })
                        }
                      />
                      <label
                        htmlFor="has_embroidery"
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4 text-purple-500" />
                        Embroidery
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has_wash_house"
                        checked={formData.has_wash_house}
                        onCheckedChange={(checked) =>
                          setFormData({ ...formData, has_wash_house: checked === true })
                        }
                      />
                      <label
                        htmlFor="has_wash_house"
                        className="flex items-center gap-2 text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <Waves className="h-4 w-4 text-cyan-500" />
                        Wash House
                      </label>
                    </div>
                  </div>
                </div>

                {/* Production / Sample details — shown for both bulk and sample */}
                <>
                    <div className="space-y-2 sm:col-span-2 pt-4 border-t">
                      <h3 className="text-sm font-semibold">
                        {orderType === 'sample' ? 'Sample Details' : 'Production Details'}
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pattern_name">Pattern Name</Label>
                      <Input
                        id="pattern_name"
                        value={sampleDetails.pattern_name}
                        onChange={(e) => setSampleDetails({ ...sampleDetails, pattern_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pattern_maker">Pattern Maker</Label>
                      <Input
                        id="pattern_maker"
                        value={sampleDetails.pattern_maker}
                        onChange={(e) => setSampleDetails({ ...sampleDetails, pattern_maker: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="references_number">References Number</Label>
                      <Input
                        id="references_number"
                        value={sampleDetails.references_number}
                        onChange={(e) => setSampleDetails({ ...sampleDetails, references_number: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fabric_kgs">Amount of Fabric (KGS)</Label>
                      <Input
                        id="fabric_kgs"
                        type="number"
                        step="0.01"
                        min="0"
                        value={sampleDetails.fabric_kgs}
                        onChange={(e) => setSampleDetails({ ...sampleDetails, fabric_kgs: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="gsm">GSM</Label>
                      <Input
                        id="gsm"
                        type="number"
                        min="0"
                        value={sampleDetails.gsm}
                        onChange={(e) => setSampleDetails({ ...sampleDetails, gsm: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="cut_and_sew_supplier">Cut and Sew Supplier</Label>
                      <Input
                        id="cut_and_sew_supplier"
                        value={sampleDetails.cut_and_sew_supplier}
                        onChange={(e) => setSampleDetails({ ...sampleDetails, cut_and_sew_supplier: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="qc_sign_off">QC Sign Off</Label>
                      <Input
                        id="qc_sign_off"
                        value={sampleDetails.qc_sign_off}
                        onChange={(e) => setSampleDetails({ ...sampleDetails, qc_sign_off: e.target.value })}
                        placeholder="Name of QC who signed off"
                      />
                    </div>

                    {/* Accessories */}
                    <div className="space-y-3 sm:col-span-2 pt-4 border-t">
                      <Label>Accessories</Label>
                      <p className="text-xs text-muted-foreground">
                        Toggle the accessories needed and enter quantity for each
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {ACCESSORY_OPTIONS.map(({ key, label, icon: Icon }) => {
                          const entry = accessories[key];
                          return (
                            <div key={key} className="flex items-center gap-3">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <Checkbox
                                  id={`acc_${key}`}
                                  checked={entry.enabled}
                                  onCheckedChange={(checked) =>
                                    setAccessories({
                                      ...accessories,
                                      [key]: { ...entry, enabled: checked === true },
                                    })
                                  }
                                />
                                <label
                                  htmlFor={`acc_${key}`}
                                  className="flex items-center gap-2 text-sm font-medium cursor-pointer truncate"
                                >
                                  <Icon className="h-4 w-4 text-orange-500" />
                                  {label}
                                </label>
                              </div>
                              {entry.enabled && (
                                <Input
                                  type="number"
                                  min="0"
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
                  </>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => navigate(-1)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting || !formData.client_id}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Order'
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </form>
        )}
      </div>
    </DashboardLayout>
  );
}
