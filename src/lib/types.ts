// WDS Production Management Types

export type AppRole = 'admin' | 'team' | 'client';

export type OrderPriority = 'low' | 'medium' | 'high' | 'urgent';

export type TaskStatus = 'pending' | 'in_progress' | 'done' | 'blocked';

export type ProductionStage = 
  | 'not_started'
  | 'sample'
  | 'cutting'
  | 'printing'
  | 'embroidery'
  | 'sewing'
  | 'wash_house'
  | 'qc'
  | 'packaging'
  | 'shipping'
  | 'delivered';

export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';

export type SupplierCategory = 'fabric' | 'printing' | 'embroidery' | 'sewing' | 'packaging' | 'wash_house' | 'accessories' | 'labels' | 'other';

export interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  brand_name?: string;
  contact_person?: string;
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  notes?: string;
  logo_url?: string;
  user_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  order_number: string;
  product_name: string;
  client_id: string;
  collection?: string;
  size?: string;
  fabric?: string;
  supplier?: string;
  quantity: number;
  pieces_sent?: number;
  delivery_date?: string;
  priority: OrderPriority;
  current_stage: ProductionStage;
  stage_updated_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Process types
  has_printing?: boolean;
  has_embroidery?: boolean;
  has_wash_house?: boolean;
  // Joined fields
  client?: Client | { name: string; brand_name?: string; id?: string };
}

export interface OrderAssignment {
  id: string;
  order_id: string;
  user_id: string;
  assigned_by?: string;
  assigned_at: string;
  // Joined fields
  profile?: Profile;
}

export interface OrderTask {
  id: string;
  order_id: string;
  title: string;
  description?: string;
  assigned_to?: string;
  due_date?: string;
  status: TaskStatus;
  sort_order: number;
  completed_at?: string;
  completed_by?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  assignee?: Profile;
}

export interface OrderFile {
  id: string;
  order_id: string;
  file_name: string;
  file_path: string;
  file_type?: string;
  file_size?: number;
  category?: 'tech_pack' | 'design' | 'photo' | 'invoice' | 'shipping' | 'label' | 'other';
  is_client_visible: boolean;
  uploaded_by?: string;
  created_at: string;
}

export interface OrderNote {
  id: string;
  order_id: string;
  content: string;
  is_client_visible: boolean;
  author_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  author?: Profile;
}

export interface OrderStageHistory {
  id: string;
  order_id: string;
  from_stage?: ProductionStage;
  to_stage: ProductionStage;
  changed_by?: string;
  changed_at: string;
  notes?: string;
  // Joined fields
  changer?: Profile;
}

export interface Lead {
  id: string;
  company_name: string;
  contact_name?: string;
  email?: string;
  phone?: string;
  brand_name?: string;
  status: LeadStatus;
  source?: string;
  notes?: string;
  followers_range?: string;
  next_follow_up?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export const FOLLOWERS_RANGE_OPTIONS = [
  { value: '0-1k', label: '0 - 1K' },
  { value: '1k-10k', label: '1K - 10K' },
  { value: '10k-50k', label: '10K - 50K' },
  { value: '50k-100k', label: '50K - 100K' },
  { value: '100k-500k', label: '100K - 500K' },
  { value: '500k-1m', label: '500K - 1M' },
  { value: '1m+', label: '1M+' },
];

export interface Supplier {
  id: string;
  name: string;
  contact_person?: string;
  phone?: string;
  email?: string;
  address?: string;
  category: SupplierCategory;
  specialty?: string;
  notes?: string;
  pricing_info?: string;
  quality_rating?: number;
  is_active: boolean;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

// Stage configuration
export const PRODUCTION_STAGES: { value: ProductionStage; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-500' },
  { value: 'sample', label: 'Sample', color: 'bg-purple-500' },
  { value: 'cutting', label: 'Cutting', color: 'bg-blue-500' },
  { value: 'printing', label: 'Printing', color: 'bg-fuchsia-500' },
  { value: 'embroidery', label: 'Embroidery', color: 'bg-pink-500' },
  { value: 'sewing', label: 'Sewing', color: 'bg-orange-500' },
  { value: 'wash_house', label: 'Wash House', color: 'bg-cyan-500' },
  { value: 'qc', label: 'QC & Packaging', color: 'bg-yellow-500' },
  { value: 'shipping', label: 'Shipping', color: 'bg-sky-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-emerald-500' },
];

// Bulk order stages (includes not_started, excludes sample)
export const BULK_PRODUCTION_STAGES = PRODUCTION_STAGES.filter(
  s => s.value !== 'sample'
);

// Sample order stages (includes not_started and sample stage)
export const SAMPLE_PRODUCTION_STAGES = PRODUCTION_STAGES.filter(
  s => true // includes all stages
);

// Dashboard display stages - QC & Packaging already combined in PRODUCTION_STAGES
export interface DisplayStage {
  value: ProductionStage | 'qc_packaging';
  label: string;
  color: string;
  combinedStages?: ProductionStage[];
}

const createDashboardStages = (stages: typeof PRODUCTION_STAGES): DisplayStage[] => {
  return stages.map((stage) => {
    if (stage.value === 'qc') {
      return {
        value: 'qc_packaging' as const,
        label: 'QC & Packaging',
        color: 'bg-yellow-500',
        combinedStages: ['qc', 'packaging'] as ProductionStage[],
      };
    }
    return stage;
  });
};

export const BULK_DASHBOARD_STAGES = createDashboardStages(BULK_PRODUCTION_STAGES);
export const SAMPLE_DASHBOARD_STAGES = createDashboardStages(SAMPLE_PRODUCTION_STAGES);

// Helper to get appropriate stages based on order type
export function getOrderStages(orderType: 'sample' | 'bulk' | null | undefined) {
  return orderType === 'sample' ? SAMPLE_PRODUCTION_STAGES : BULK_PRODUCTION_STAGES;
}

// Helper to check if order is sample or bulk (stored in supplier column)
export function getOrderType(order: Order): 'sample' | 'bulk' {
  return order.supplier === 'sample' ? 'sample' : 'bulk';
}

export const PRIORITY_CONFIG: { value: OrderPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-500' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-500' },
  { value: 'high', label: 'High', color: 'bg-orange-500' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-500' },
];

export const TASK_STATUS_CONFIG: { value: TaskStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-gray-500' },
  { value: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { value: 'done', label: 'Done', color: 'bg-green-500' },
  { value: 'blocked', label: 'Blocked', color: 'bg-red-500' },
];

export const LEAD_STATUS_CONFIG: { value: LeadStatus; label: string; color: string }[] = [
  { value: 'new', label: 'New', color: 'bg-blue-500' },
  { value: 'contacted', label: 'Contacted', color: 'bg-sky-500' },
  { value: 'qualified', label: 'Qualified', color: 'bg-purple-500' },
  { value: 'proposal', label: 'Proposal', color: 'bg-orange-500' },
  { value: 'negotiation', label: 'Negotiation', color: 'bg-yellow-500' },
  { value: 'won', label: 'Won', color: 'bg-green-500' },
  { value: 'lost', label: 'Lost', color: 'bg-red-500' },
];

export const SUPPLIER_CATEGORY_CONFIG: { value: SupplierCategory; label: string; color: string }[] = [
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

// Client-visible stages (excludes not_started and sample - internal stages only)
export const CLIENT_VISIBLE_STAGES = PRODUCTION_STAGES.filter(
  s => s.value !== 'not_started' && s.value !== 'sample'
);

// Normalize stage: DB still has separate 'packaging' value, map it to 'qc' for display
export function normalizeStage(stage: ProductionStage): ProductionStage {
  return stage === 'packaging' ? 'qc' : stage;
}

export function getStageIndex(stage: ProductionStage): number {
  return PRODUCTION_STAGES.findIndex(s => s.value === normalizeStage(stage));
}

export function getStageProgress(stage: ProductionStage): number {
  const index = getStageIndex(stage);
  return Math.round(((index + 1) / PRODUCTION_STAGES.length) * 100);
}

// Client-specific progress (based on visible stages only)
export function getClientStageProgress(stage: ProductionStage): number {
  // For internal stages, show 0% to clients
  if (stage === 'not_started' || stage === 'sample') {
    return 0;
  }
  const normalized = normalizeStage(stage);
  const index = CLIENT_VISIBLE_STAGES.findIndex(s => s.value === normalized);
  if (index === -1) return 0;
  return Math.round(((index + 1) / CLIENT_VISIBLE_STAGES.length) * 100);
}

// ── Order Analysis ──────────────────────────────────────
export interface OrderAnalysisOrderItem {
  id: string;
  description: string;
  category: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface OrderAnalysisInvoiceItem {
  id: string;
  product: string;
  firstPaymentPct: number;
  secondPaymentPct: number;
  totalRevenue: number;
}

export interface OrderAnalysisCostItem {
  id: string;
  category: string;
  amountTry: number;
}

export interface OrderAnalysisProfitItem {
  product: string;
  revenue: number;
  costs: number;
  grossProfit: number;
  marginPct: number;
}

export interface OrderAnalysis {
  id: string;
  client_id: string;
  analysis_title: string;
  invoice_ref: string | null;
  supplier: string | null;
  exchange_rate: number;
  display_currency: string;
  order_items_currency?: string;
  invoice_currency?: string;
  cost_currency?: string;
  analysis_date: string;
  notes: string | null;
  order_items: OrderAnalysisOrderItem[];
  invoice_breakdown: OrderAnalysisInvoiceItem[];
  cost_breakdown: OrderAnalysisCostItem[];
  profit_summary: OrderAnalysisProfitItem[];
  total_revenue: number;
  total_costs: number;
  total_profit: number;
  margin_pct: number;
  auto_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const ANALYSIS_COST_CATEGORIES = [
  'Fabric',
  'Production',
  'Washhouse',
  'Printing',
  'Accessories',
  'Embroidery',
  'Packaging',
  'Shipping',
  'Commission',
  'Other',
] as const;
