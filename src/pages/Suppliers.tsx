import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, Truck, Mail, Phone, MapPin, Loader2, Star, Edit } from 'lucide-react';
import type { Supplier, SupplierCategory, SUPPLIER_CATEGORY_CONFIG } from '@/lib/types';

const SUPPLIER_CATEGORIES: typeof SUPPLIER_CATEGORY_CONFIG = [
  { value: 'fabric', label: 'Fabric', color: 'bg-blue-500' },
  { value: 'printing', label: 'Printing', color: 'bg-fuchsia-500' },
  { value: 'embroidery', label: 'Embroidery', color: 'bg-pink-500' },
  { value: 'sewing', label: 'Sewing', color: 'bg-orange-500' },
  { value: 'packaging', label: 'Packaging', color: 'bg-green-500' },
  { value: 'wash_house', label: 'Wash House', color: 'bg-cyan-500' },
  { value: 'accessories', label: 'Accessories', color: 'bg-purple-500' },
  { value: 'labels', label: 'Labels', color: 'bg-yellow-500' },
  { value: 'other', label: 'Other', color: 'bg-gray-500' },
];

export default function Suppliers() {
  const navigate = useNavigate();
  const { user, role, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    address: '',
    category: 'other' as SupplierCategory,
    specialty: '',
    notes: '',
    pricing_info: '',
    quality_rating: '',
    is_active: true,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
    if (!authLoading && role === 'client') {
      navigate('/dashboard');
    }
  }, [user, authLoading, role, navigate]);

  useEffect(() => {
    if (user && role && role !== 'client') {
      fetchSuppliers();
    }
  }, [user, role]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await (supabase
        .from('suppliers' as any)
        .select('*')
        .order('name', { ascending: true }) as any);

      if (error) throw error;
      setSuppliers((data || []) as Supplier[]);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load suppliers.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateOrUpdateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const supplierData = {
        name: formData.name,
        contact_person: formData.contact_person || null,
        phone: formData.phone || null,
        email: formData.email || null,
        address: formData.address || null,
        category: formData.category,
        specialty: formData.specialty || null,
        notes: formData.notes || null,
        pricing_info: formData.pricing_info || null,
        quality_rating: formData.quality_rating ? parseInt(formData.quality_rating) : null,
        is_active: formData.is_active,
      };

      if (editingSupplier) {
        const { error } = await (supabase
          .from('suppliers' as any) as any)
          .update(supplierData)
          .eq('id', editingSupplier.id);

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Supplier updated successfully.',
        });
      } else {
        const { error } = await (supabase.from('suppliers' as any) as any).insert({
          ...supplierData,
          created_by: user?.id,
        });

        if (error) throw error;

        toast({
          title: 'Success',
          description: 'Supplier created successfully.',
        });
      }

      setIsDialogOpen(false);
      setEditingSupplier(null);
      resetForm();
      fetchSuppliers();
    } catch (error) {
      console.error('Error saving supplier:', error);
      toast({
        title: 'Error',
        description: 'Failed to save supplier.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_person: supplier.contact_person || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      address: supplier.address || '',
      category: supplier.category,
      specialty: supplier.specialty || '',
      notes: supplier.notes || '',
      pricing_info: supplier.pricing_info || '',
      quality_rating: supplier.quality_rating?.toString() || '',
      is_active: supplier.is_active,
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      address: '',
      category: 'other',
      specialty: '',
      notes: '',
      pricing_info: '',
      quality_rating: '',
      is_active: true,
    });
  };

  const getCategoryBadge = (category: SupplierCategory) => {
    const config = SUPPLIER_CATEGORIES.find(c => c.value === category);
    return (
      <Badge className={`${config?.color || 'bg-gray-500'} text-white`}>
        {config?.label || category}
      </Badge>
    );
  };

  const renderStars = (rating: number | null) => {
    if (!rating) return '-';
    return (
      <div className="flex items-center gap-0.5">
        {[...Array(5)].map((_, i) => (
          <Star
            key={i}
            className={`h-3 w-3 ${i < rating ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`}
          />
        ))}
      </div>
    );
  };

  const filteredSuppliers = suppliers.filter(supplier => {
    const matchesSearch = 
      supplier.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.contact_person?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      supplier.specialty?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || supplier.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  if (authLoading || !user) {
    return null;
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Suppliers</h1>
            <p className="text-muted-foreground">
              Your supplier directory and contacts
            </p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) {
              setEditingSupplier(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Supplier
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateOrUpdateSupplier}>
                <DialogHeader>
                  <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                  <DialogDescription>
                    {editingSupplier ? 'Update supplier details' : 'Add a new supplier to your directory'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Company Name *</Label>
                    <Input
                      id="name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="category">Category *</Label>
                      <Select
                        value={formData.category}
                        onValueChange={(value: SupplierCategory) => setFormData({ ...formData, category: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SUPPLIER_CATEGORIES.map((cat) => (
                            <SelectItem key={cat.value} value={cat.value}>
                              {cat.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="specialty">Specialty</Label>
                      <Input
                        id="specialty"
                        placeholder="e.g., Denim, Screen print"
                        value={formData.specialty}
                        onChange={(e) => setFormData({ ...formData, specialty: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contact_person">Contact Person</Label>
                    <Input
                      id="contact_person"
                      value={formData.contact_person}
                      onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address</Label>
                    <Textarea
                      id="address"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quality_rating">Quality Rating (1-5)</Label>
                      <Select
                        value={formData.quality_rating}
                        onValueChange={(value) => setFormData({ ...formData, quality_rating: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select rating" />
                        </SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((rating) => (
                            <SelectItem key={rating} value={rating.toString()}>
                              {rating} star{rating !== 1 ? 's' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center space-x-2 pt-6">
                      <Switch
                        id="is_active"
                        checked={formData.is_active}
                        onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                      />
                      <Label htmlFor="is_active">Active Supplier</Label>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pricing_info">Pricing Info</Label>
                    <Textarea
                      id="pricing_info"
                      placeholder="Price ranges, payment terms, etc."
                      value={formData.pricing_info}
                      onChange={(e) => setFormData({ ...formData, pricing_info: e.target.value })}
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Additional notes about this supplier"
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {editingSupplier ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      editingSupplier ? 'Update Supplier' : 'Create Supplier'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search suppliers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {SUPPLIER_CATEGORIES.map((cat) => (
                <SelectItem key={cat.value} value={cat.value}>
                  {cat.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Suppliers Grid */}
        {isLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Truck className="h-12 w-12 text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">
                {searchQuery || categoryFilter !== 'all' ? 'No suppliers match your filters' : 'No suppliers yet'}
              </p>
              {!searchQuery && categoryFilter === 'all' && (
                <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add First Supplier
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredSuppliers.map((supplier) => (
              <Card key={supplier.id} className={!supplier.is_active ? 'opacity-60' : ''}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{supplier.name}</CardTitle>
                      {supplier.specialty && (
                        <CardDescription>{supplier.specialty}</CardDescription>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEditSupplier(supplier)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    {getCategoryBadge(supplier.category)}
                    {!supplier.is_active && (
                      <Badge variant="outline">Inactive</Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  {supplier.contact_person && (
                    <p className="font-medium">{supplier.contact_person}</p>
                  )}
                  {supplier.email && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-3 w-3" />
                      <a href={`mailto:${supplier.email}`} className="hover:underline">
                        {supplier.email}
                      </a>
                    </div>
                  )}
                  {supplier.phone && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Phone className="h-3 w-3" />
                      <a href={`tel:${supplier.phone}`} className="hover:underline">
                        {supplier.phone}
                      </a>
                    </div>
                  )}
                  {supplier.address && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <MapPin className="h-3 w-3 mt-0.5" />
                      <span className="line-clamp-2">{supplier.address}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Quality:</span>
                      {renderStars(supplier.quality_rating)}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
