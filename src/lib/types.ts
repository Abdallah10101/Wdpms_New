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
  delivery_date?: string;
  priority: OrderPriority;
  current_stage: ProductionStage;
  stage_updated_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client?: Client;
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

// Stage configuration
export const PRODUCTION_STAGES: { value: ProductionStage; label: string; color: string }[] = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-500' },
  { value: 'sample', label: 'Sample', color: 'bg-purple-500' },
  { value: 'cutting', label: 'Cutting', color: 'bg-blue-500' },
  { value: 'printing', label: 'Printing', color: 'bg-fuchsia-500' },
  { value: 'embroidery', label: 'Embroidery', color: 'bg-pink-500' },
  { value: 'sewing', label: 'Sewing', color: 'bg-orange-500' },
  { value: 'wash_house', label: 'Wash House', color: 'bg-cyan-500' },
  { value: 'qc', label: 'QC', color: 'bg-yellow-500' },
  { value: 'packaging', label: 'Packaging', color: 'bg-green-500' },
  { value: 'shipping', label: 'Shipping', color: 'bg-sky-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-emerald-500' },
];

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

export function getStageIndex(stage: ProductionStage): number {
  return PRODUCTION_STAGES.findIndex(s => s.value === stage);
}

export function getStageProgress(stage: ProductionStage): number {
  const index = getStageIndex(stage);
  return Math.round(((index + 1) / PRODUCTION_STAGES.length) * 100);
}
