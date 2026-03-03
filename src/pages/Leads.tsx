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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Plus, Search, UserPlus, Mail, Phone, Loader2, Calendar, Instagram, Building2, User, MessageSquare, Globe, Download, LayoutList, Columns3 } from 'lucide-react';
import type { Lead, LeadStatus, LEAD_STATUS_CONFIG } from '@/lib/types';
import { FOLLOWERS_RANGE_OPTIONS } from '@/lib/types';

const LEAD_STATUSES: typeof LEAD_STATUS_CONFIG = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-sky-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { value: 'proposal', label: 'Proposal', color: 'bg-orange-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-yellow-500' },
  { value: 'won', label: 'Won', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export default function Leads() {
  const navigate = useNavigate();
  const { user, role, profile, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'table' | 'kanban'>('table');
  const [isConverting, setIsConverting] = useState(false);

  const [formData, setFormData] = useState({
    company_name: '',
    contact_name: '',
    email: '',
    phone: '',
    brand_name: '',
    status: 'new' as LeadStatus,
    source: '',
    notes: '',
    followers_range: '',
    next_follow_up: '',
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
      fetchLeads();
    }
  }, [user, role]);

  const fetchLeads = async () => {
    try {
      const { data, error } = await (supabase
        .from('leads' as any)
        .select('*')
        .order('created_at', { ascending: false }) as any);

      if (error) throw error;
      setLeads((data || []) as Lead[]);
    } catch (error) {
      console.error('Error fetching leads:', error);
      toast({
        title: 'Error',
        description: 'Failed to load leads.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await (supabase.from('leads' as any) as any).insert({
        company_name: formData.company_name,
        contact_name: formData.contact_name || null,
        email: formData.email || null,
        phone: formData.phone || null,
        brand_name: formData.brand_name || null,
        status: formData.status,
        source: formData.source || null,
        notes: formData.notes || null,
        followers_range: formData.followers_range || null,
        next_follow_up: formData.next_follow_up || null,
        created_by: user?.id,
      } as any);

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Lead created successfully.',
      });

      setIsDialogOpen(false);
      resetForm();
      fetchLeads();
    } catch (error) {
      console.error('Error creating lead:', error);
      toast({
        title: 'Error',
        description: 'Failed to create lead.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateStatus = async (leadId: string, newStatus: LeadStatus) => {
    try {
      const { error } = await (supabase
        .from('leads' as any) as any)
        .update({ status: newStatus })
        .eq('id', leadId);

      if (error) throw error;

      setLeads(leads.map(lead => 
        lead.id === leadId ? { ...lead, status: newStatus } : lead
      ));

      toast({
        title: 'Status Updated',
        description: `Lead status changed to ${newStatus}`,
      });
    } catch (error) {
      console.error('Error updating status:', error);
      toast({
        title: 'Error',
        description: 'Failed to update status.',
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      company_name: '',
      contact_name: '',
      email: '',
      phone: '',
      brand_name: '',
      status: 'new',
      source: '',
      notes: '',
      followers_range: '',
      next_follow_up: '',
    });
  };

  const handleConvertToClient = async (lead: Lead) => {
    setIsConverting(true);
    try {
      const { error } = await supabase.from('clients').insert({
        name: lead.company_name,
        brand_name: lead.brand_name || null,
        contact_person: lead.contact_name || null,
        contact_email: lead.email || null,
        contact_phone: lead.phone || null,
        notes: lead.notes || null,
        created_by: user?.id,
      });
      if (error) throw error;

      // Mark lead as won
      await (supabase.from('leads' as any) as any).update({ status: 'won' }).eq('id', lead.id);

      toast({ title: 'Client Created!', description: `${lead.company_name} has been converted to a client.` });
      setIsDetailOpen(false);
      fetchLeads();
    } catch (error) {
      console.error('Error converting lead:', error);
      toast({ title: 'Error', description: 'Failed to convert lead to client.', variant: 'destructive' });
    } finally {
      setIsConverting(false);
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

  const exportCSV = () => {
    const headers = ['Company', 'Brand', 'Contact', 'Email', 'Phone', 'Status', 'Source', 'Followers', 'Follow-up', 'Notes'];
    const rows = filteredLeads.map(l => [
      l.company_name, l.brand_name || '', l.contact_name || '', l.email || '', l.phone || '',
      l.status, l.source || '', l.followers_range || '', l.next_follow_up || '', l.notes || ''
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'leads.csv'; a.click();
    URL.revokeObjectURL(url);
    logActivity('csv_exported', 'leads', { count: filteredLeads.length });
  };

  const getStatusBadge = (status: LeadStatus) => {
    const config = LEAD_STATUSES.find(s => s.value === status);
    return (
      <Badge className={`${config?.color || 'bg-gray-500'} text-white`}>
        {config?.label || status}
      </Badge>
    );
  };

  const filteredLeads = leads.filter(lead => {
    const matchesSearch = 
      lead.company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.contact_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.brand_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || lead.status === statusFilter;
    
    return matchesSearch && matchesStatus;
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
            <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
            <p className="text-muted-foreground">
              Track potential clients and follow-ups
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportCSV}>
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </Button>
            <Button variant="outline" size="icon" onClick={() => setViewMode(viewMode === 'table' ? 'kanban' : 'table')} title={viewMode === 'table' ? 'Kanban View' : 'Table View'}>
              {viewMode === 'table' ? <Columns3 className="h-4 w-4" /> : <LayoutList className="h-4 w-4" />}
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <form onSubmit={handleCreateLead}>
                <DialogHeader>
                  <DialogTitle>Add New Lead</DialogTitle>
                  <DialogDescription>
                    Track a potential client
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="company_name">Company Name *</Label>
                    <Input
                      id="company_name"
                      value={formData.company_name}
                      onChange={(e) => setFormData({ ...formData, company_name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contact_name">Contact Name</Label>
                      <Input
                        id="contact_name"
                        value={formData.contact_name}
                        onChange={(e) => setFormData({ ...formData, contact_name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brand_name">Brand Name</Label>
                      <Input
                        id="brand_name"
                        value={formData.brand_name}
                        onChange={(e) => setFormData({ ...formData, brand_name: e.target.value })}
                      />
                    </div>
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
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={formData.status}
                        onValueChange={(value: LeadStatus) => setFormData({ ...formData, status: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="source">Source</Label>
                      <Input
                        id="source"
                        placeholder="e.g., Referral, Website"
                        value={formData.source}
                        onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="followers_range">Instagram Followers</Label>
                      <Select
                        value={formData.followers_range}
                        onValueChange={(value) => setFormData({ ...formData, followers_range: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select range" />
                        </SelectTrigger>
                        <SelectContent>
                          {FOLLOWERS_RANGE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="next_follow_up">Next Follow-up</Label>
                      <Input
                        id="next_follow_up"
                        type="date"
                        value={formData.next_follow_up}
                        onChange={(e) => setFormData({ ...formData, next_follow_up: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
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
                        Creating...
                      </>
                    ) : (
                      'Create Lead'
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {LEAD_STATUSES.map((status) => (
                <SelectItem key={status.value} value={status.value}>
                  {status.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-4 min-w-max">
              {LEAD_STATUSES.map((statusCfg) => {
                const columnLeads = filteredLeads.filter(l => l.status === statusCfg.value);
                return (
                  <div key={statusCfg.value} className="w-60 flex-shrink-0">
                    <div className={`flex items-center gap-2 rounded-t-lg px-3 py-2 ${statusCfg.color}`}>
                      <span className="font-medium text-white text-sm">{statusCfg.label}</span>
                      <span className="ml-auto rounded-full bg-white/20 px-2 py-0.5 text-xs text-white">{columnLeads.length}</span>
                    </div>
                    <div className="space-y-2 rounded-b-lg border border-border bg-muted/20 p-2 min-h-24">
                      {columnLeads.map(lead => (
                        <button
                          key={lead.id}
                          className="w-full text-left rounded-lg border border-border bg-card p-3 hover:shadow-sm transition-shadow"
                          onClick={() => { setSelectedLead(lead); setIsDetailOpen(true); }}
                        >
                          <p className="font-medium text-sm truncate">{lead.company_name}</p>
                          {lead.brand_name && <p className="text-xs text-muted-foreground truncate">{lead.brand_name}</p>}
                          {lead.contact_name && <p className="text-xs text-muted-foreground mt-1">{lead.contact_name}</p>}
                          {lead.next_follow_up && (
                            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(lead.next_follow_up).toLocaleDateString()}
                            </p>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Leads Table */}
        {viewMode === 'table' && <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
            <CardDescription>
              {filteredLeads.length} lead{filteredLeads.length !== 1 ? 's' : ''}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filteredLeads.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <UserPlus className="h-12 w-12 text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">
                  {searchQuery || statusFilter !== 'all' ? 'No leads match your filters' : 'No leads yet'}
                </p>
                {!searchQuery && statusFilter === 'all' && (
                  <Button className="mt-4" onClick={() => setIsDialogOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Lead
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Followers</TableHead>
                    <TableHead>Follow-up</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow 
                      key={lead.id} 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => {
                        setSelectedLead(lead);
                        setIsDetailOpen(true);
                      }}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium">{lead.company_name}</p>
                          {lead.brand_name && (
                            <p className="text-sm text-muted-foreground">{lead.brand_name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="text-sm">{lead.contact_name || '-'}</p>
                          {lead.email && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Mail className="h-3 w-3" />
                              {lead.email}
                            </span>
                          )}
                          {lead.phone && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Phone className="h-3 w-3" />
                              {lead.phone}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={lead.status}
                          onValueChange={(value: LeadStatus) => handleUpdateStatus(lead.id, value)}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue>{getStatusBadge(lead.status)}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {LEAD_STATUSES.map((status) => (
                              <SelectItem key={status.value} value={status.value}>
                                {status.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {lead.followers_range ? (
                          <span className="flex items-center gap-1">
                            <Instagram className="h-3 w-3" />
                            {FOLLOWERS_RANGE_OPTIONS.find(o => o.value === lead.followers_range)?.label || lead.followers_range}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                      <TableCell>
                        {lead.next_follow_up ? (
                          <span className="flex items-center gap-1 text-sm">
                            <Calendar className="h-3 w-3" />
                            {new Date(lead.next_follow_up).toLocaleDateString()}
                          </span>
                        ) : (
                          '-'
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>}

        {/* Lead Detail Dialog */}
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                {selectedLead?.company_name}
              </DialogTitle>
              {selectedLead?.brand_name && (
                <DialogDescription>{selectedLead.brand_name}</DialogDescription>
              )}
            </DialogHeader>
            {selectedLead && (
              <div className="space-y-4">
                {/* Status */}
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  {getStatusBadge(selectedLead.status)}
                </div>

                {/* Contact Info */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Contact Information</h4>
                  <div className="grid gap-2 text-sm">
                    {selectedLead.contact_name && (
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{selectedLead.contact_name}</span>
                      </div>
                    )}
                    {selectedLead.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <a href={`mailto:${selectedLead.email}`} className="text-primary hover:underline">
                          {selectedLead.email}
                        </a>
                      </div>
                    )}
                    {selectedLead.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground" />
                        <a href={`tel:${selectedLead.phone}`} className="text-primary hover:underline">
                          {selectedLead.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Additional Details */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium">Details</h4>
                  <div className="grid gap-2 text-sm">
                    {selectedLead.source && (
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-muted-foreground" />
                        <span>Source: {selectedLead.source}</span>
                      </div>
                    )}
                    {selectedLead.followers_range && (
                      <div className="flex items-center gap-2">
                        <Instagram className="h-4 w-4 text-muted-foreground" />
                        <span>Followers: {FOLLOWERS_RANGE_OPTIONS.find(o => o.value === selectedLead.followers_range)?.label || selectedLead.followers_range}</span>
                      </div>
                    )}
                    {selectedLead.next_follow_up && (
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Follow-up: {new Date(selectedLead.next_follow_up).toLocaleDateString()}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {selectedLead.notes && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium flex items-center gap-2">
                      <MessageSquare className="h-4 w-4" />
                      Notes
                    </h4>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/50 p-3 rounded-md">
                      {selectedLead.notes}
                    </p>
                  </div>
                )}

                {/* Created Date */}
                <div className="pt-2 border-t text-xs text-muted-foreground">
                  Created: {new Date(selectedLead.created_at).toLocaleString()}
                </div>

                {/* Convert to Client */}
                {role === 'admin' && selectedLead.status !== 'lost' && (
                  <Button
                    className="w-full"
                    variant="outline"
                    onClick={() => handleConvertToClient(selectedLead)}
                    disabled={isConverting}
                  >
                    {isConverting ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Converting...</>
                    ) : (
                      <><Building2 className="mr-2 h-4 w-4" />Convert to Client</>
                    )}
                  </Button>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
