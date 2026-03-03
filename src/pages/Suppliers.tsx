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
import { Plus, Search, Truck, Mail, Phone, MapPin, Loader2, Star, Edit, Trash2, CheckSquare, X, Download } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  const { user, role, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  const logActivity = async (actionType: string, targetName: string, details: Record<string, any> = {}) => {
    try {
      await (supabase.from as any)('activity_log').insert({
        action_type: actionType,
        actor_id: user?.id,
        actor_name: profile?.full_name || user?.email || 'Unknown',
        target_name: targetName,
        details,
      });
    } catch (err) {
      console.error('Failed to log activity:', err);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    try {
      const supplier = suppliers.find((s) => s.id === supplierId);
      const { error } = await (supabase.from('suppliers' as any) as any).delete().eq('id', supplierId);
      if (error) throw error;
      setSuppliers((prev) => prev.filter((s) => s.id !== supplierId));
      toast({ title: 'Deleted', description: 'Supplier has been removed.' });
      logActivity('supplier_deleted', supplier?.name || 'Unknown');
    } catch (err: any) {
      console.error('Error deleting supplier:', err);
      toast({ title: 'Error', description: 'Failed to delete supplier.', variant: 'destructive' });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredSuppliers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredSuppliers.map((s) => s.id)));
    }
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    const ids = [...selectedIds];
    const deletedNames: string[] = [];
    for (const id of ids) {
      try {
        const supplier = suppliers.find((s) => s.id === id);
        const { error } = await (supabase.from('suppliers' as any) as any).delete().eq('id', id);
        if (!error) {
          deletedNames.push(supplier?.name || 'Unknown');
        }
      } catch {}
    }
    if (deletedNames.length > 0) {
      toast({ title: 'Deleted', description: `${deletedNames.length} supplier${deletedNames.length !== 1 ? 's' : ''} removed.` });
      logActivity('supplier_bulk_deleted', `${deletedNames.length} suppliers`, { names: deletedNames });
      fetchSuppliers();
    }
    exitSelectMode();
  };

  const exportCSV = (suppliersToExport?: Supplier[]) => {
    const data = suppliersToExport || filteredSuppliers;
    const headers = ['Name', 'Category', 'Specialty', 'Contact Person', 'Email', 'Phone', 'Address', 'Rating', 'Active'];
    const rows = data.map(s => [
      s.name, s.category, s.specialty || '', s.contact_person || '', s.email || '',
      s.phone || '', s.address || '', s.quality_rating?.toString() || '', s.is_active ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'suppliers.csv'; a.click();
    URL.revokeObjectURL(url);
    logActivity('csv_exported', 'suppliers', { count: data.length });
  };

  const handleBulkExport = () => {
    const selected = filteredSuppliers.filter((s) => selectedIds.has(s.id));
    exportCSV(selected);
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
      logActivity(editingSupplier ? 'supplier_updated' : 'supplier_created', formData.name);
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
          <div className="flex gap-2">
            {role === 'admin' && !selectMode && (
              <Button variant="outline" onClick={() => setSelectMode(true)}>
                <CheckSquare className="mr-2 h-4 w-4" />
                Select
              </Button>
            )}
            {!selectMode && (
              <Button variant="outline" onClick={() => exportCSV()}>
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </Button>
            )}
            {!selectMode && <Dialog open={isDialogOpen} onOpenChange={(open) => {
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
            <DialogContent className="max-w-lg flex flex-col max-h-[90vh]">
              <form onSubmit={handleCreateOrUpdateSupplier} className="flex flex-col overflow-hidden flex-1">
                <DialogHeader className="flex-shrink-0 px-6 pt-6">
                  <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
                  <DialogDescription>
                    {editingSupplier ? 'Update supplier details' : 'Add a new supplier to your directory'}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4 px-6 overflow-y-auto flex-1">
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
                <DialogFooter className="flex-shrink-0 px-6 pb-6">
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
          </Dialog>}
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectMode && (
          <div className="flex items-center gap-3 rounded-lg border bg-muted/50 px-4 py-3">
            <Checkbox
              checked={selectedIds.size === filteredSuppliers.length && filteredSuppliers.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <span className="text-sm font-medium">
              {selectedIds.size} selected
            </span>
            <div className="ml-auto flex gap-2">
              <Button variant="outline" size="sm" onClick={handleBulkExport} disabled={selectedIds.size === 0}>
                <Download className="mr-2 h-4 w-4" />
                Export Selected
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={selectedIds.size === 0}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete Selected
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete {selectedIds.size} Supplier{selectedIds.size !== 1 ? 's' : ''}</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete {selectedIds.size} selected supplier{selectedIds.size !== 1 ? 's' : ''}? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleBulkDelete}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button variant="ghost" size="sm" onClick={exitSelectMode}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        )}

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
              <Card
                key={supplier.id}
                className={`${!supplier.is_active ? 'opacity-60' : ''} ${selectMode && selectedIds.has(supplier.id) ? 'ring-2 ring-primary' : ''} ${selectMode ? 'cursor-pointer' : ''}`}
                onClick={selectMode ? () => toggleSelect(supplier.id) : undefined}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      {selectMode && (
                        <Checkbox
                          checked={selectedIds.has(supplier.id)}
                          onCheckedChange={() => toggleSelect(supplier.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1"
                        />
                      )}
                      <div className="space-y-1">
                        <CardTitle className="text-lg">{supplier.name}</CardTitle>
                        {supplier.specialty && (
                          <CardDescription>{supplier.specialty}</CardDescription>
                        )}
                      </div>
                    </div>
                    {!selectMode && (
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEditSupplier(supplier)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        {role === 'admin' && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete "{supplier.name}"? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteSupplier(supplier.id)}
                                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )}
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
