-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('admin', 'team', 'client');

-- Create enum for order priority
CREATE TYPE public.order_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Create enum for task status
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'done', 'blocked');

-- Create enum for production stages
CREATE TYPE public.production_stage AS ENUM (
  'not_started', 
  'sample', 
  'cutting', 
  'printing', 
  'embroidery', 
  'sewing', 
  'wash_house', 
  'qc', 
  'packaging', 
  'shipping', 
  'delivered'
);

-- ============================================
-- USER ROLES TABLE (Separate from profiles for security)
-- ============================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROFILES TABLE
-- ============================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- CLIENTS TABLE (Companies/Brands)
-- ============================================
CREATE TABLE public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  brand_name TEXT,
  contact_person TEXT,
  contact_email TEXT,
  contact_phone TEXT,
  address TEXT,
  notes TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORDERS TABLE
-- ============================================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  collection TEXT,
  size TEXT,
  fabric TEXT,
  supplier TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  delivery_date DATE,
  priority order_priority NOT NULL DEFAULT 'medium',
  current_stage production_stage NOT NULL DEFAULT 'not_started',
  stage_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORDER ASSIGNMENTS (Team members assigned to orders)
-- ============================================
CREATE TABLE public.order_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (order_id, user_id)
);

ALTER TABLE public.order_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORDER TASKS (Checklist items)
-- ============================================
CREATE TABLE public.order_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  due_date DATE,
  status task_status NOT NULL DEFAULT 'pending',
  sort_order INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_tasks ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORDER FILES
-- ============================================
CREATE TABLE public.order_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT, -- 'tech_pack', 'design', 'photo', 'invoice', 'shipping', 'label', 'other'
  is_client_visible BOOLEAN NOT NULL DEFAULT false,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_files ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORDER NOTES
-- ============================================
CREATE TABLE public.order_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  is_client_visible BOOLEAN NOT NULL DEFAULT false,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_notes ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORDER STAGE HISTORY (Track stage changes)
-- ============================================
CREATE TABLE public.order_stage_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  from_stage production_stage,
  to_stage production_stage NOT NULL,
  changed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.order_stage_history ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTIONS (Security Definer)
-- ============================================

-- Check if user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Check if current user is team member
CREATE OR REPLACE FUNCTION public.is_team()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'team')
$$;

-- Check if current user is client
CREATE OR REPLACE FUNCTION public.is_client()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'client')
$$;

-- Check if user is assigned to an order
CREATE OR REPLACE FUNCTION public.is_assigned_to_order(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_assignments
    WHERE order_id = _order_id
      AND user_id = auth.uid()
  )
$$;

-- Check if user is the client of an order
CREATE OR REPLACE FUNCTION public.is_client_of_order(_order_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    JOIN public.clients c ON o.client_id = c.id
    WHERE o.id = _order_id
      AND c.user_id = auth.uid()
  )
$$;

-- Get user's role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- ============================================
-- RLS POLICIES
-- ============================================

-- USER ROLES POLICIES
CREATE POLICY "Admins can manage all roles"
  ON public.user_roles FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can view their own role"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid());

-- PROFILES POLICIES
CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  USING (public.is_admin());

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- CLIENTS POLICIES
CREATE POLICY "Admins can manage all clients"
  ON public.clients FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view all clients"
  ON public.clients FOR SELECT
  USING (public.is_team());

CREATE POLICY "Clients can view their own record"
  ON public.clients FOR SELECT
  USING (user_id = auth.uid());

-- ORDERS POLICIES
CREATE POLICY "Admins can manage all orders"
  ON public.orders FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view assigned orders"
  ON public.orders FOR SELECT
  USING (public.is_team() AND public.is_assigned_to_order(id));

CREATE POLICY "Team can update assigned orders"
  ON public.orders FOR UPDATE
  USING (public.is_team() AND public.is_assigned_to_order(id));

CREATE POLICY "Clients can view their own orders"
  ON public.orders FOR SELECT
  USING (public.is_client_of_order(id));

-- ORDER ASSIGNMENTS POLICIES
CREATE POLICY "Admins can manage all assignments"
  ON public.order_assignments FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view their assignments"
  ON public.order_assignments FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Clients can view order assignments"
  ON public.order_assignments FOR SELECT
  USING (public.is_client_of_order(order_id));

-- ORDER TASKS POLICIES
CREATE POLICY "Admins can manage all tasks"
  ON public.order_tasks FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view tasks for assigned orders"
  ON public.order_tasks FOR SELECT
  USING (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Team can manage tasks they created or are assigned to"
  ON public.order_tasks FOR UPDATE
  USING (public.is_team() AND (assigned_to = auth.uid() OR created_by = auth.uid()));

CREATE POLICY "Team can insert tasks for assigned orders"
  ON public.order_tasks FOR INSERT
  WITH CHECK (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Clients can view tasks for their orders"
  ON public.order_tasks FOR SELECT
  USING (public.is_client_of_order(order_id));

-- ORDER FILES POLICIES
CREATE POLICY "Admins can manage all files"
  ON public.order_files FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view files for assigned orders"
  ON public.order_files FOR SELECT
  USING (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Team can upload files for assigned orders"
  ON public.order_files FOR INSERT
  WITH CHECK (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Team can delete their own files"
  ON public.order_files FOR DELETE
  USING (public.is_team() AND uploaded_by = auth.uid());

CREATE POLICY "Clients can view client-visible files"
  ON public.order_files FOR SELECT
  USING (public.is_client_of_order(order_id) AND is_client_visible = true);

-- ORDER NOTES POLICIES
CREATE POLICY "Admins can manage all notes"
  ON public.order_notes FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view notes for assigned orders"
  ON public.order_notes FOR SELECT
  USING (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Team can insert notes for assigned orders"
  ON public.order_notes FOR INSERT
  WITH CHECK (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Team can update their own notes"
  ON public.order_notes FOR UPDATE
  USING (public.is_team() AND author_id = auth.uid());

CREATE POLICY "Clients can view client-visible notes"
  ON public.order_notes FOR SELECT
  USING (public.is_client_of_order(order_id) AND is_client_visible = true);

-- ORDER STAGE HISTORY POLICIES
CREATE POLICY "Admins can manage all stage history"
  ON public.order_stage_history FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view stage history for assigned orders"
  ON public.order_stage_history FOR SELECT
  USING (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Team can insert stage history for assigned orders"
  ON public.order_stage_history FOR INSERT
  WITH CHECK (public.is_team() AND public.is_assigned_to_order(order_id));

CREATE POLICY "Clients can view stage history for their orders"
  ON public.order_stage_history FOR SELECT
  USING (public.is_client_of_order(order_id));

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_tasks_updated_at
  BEFORE UPDATE ON public.order_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_notes_updated_at
  BEFORE UPDATE ON public.order_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-generate order number
CREATE OR REPLACE FUNCTION public.generate_order_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.order_number IS NULL OR NEW.order_number = '' THEN
    NEW.order_number := 'WDS-' || TO_CHAR(now(), 'YYYYMMDD') || '-' || LPAD(nextval('order_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE TRIGGER generate_order_number_trigger
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.generate_order_number();

-- Track stage changes
CREATE OR REPLACE FUNCTION public.track_stage_change()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
    INSERT INTO public.order_stage_history (order_id, from_stage, to_stage, changed_by)
    VALUES (NEW.id, OLD.current_stage, NEW.current_stage, auth.uid());
    NEW.stage_updated_at = now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER track_order_stage_change
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.track_stage_change();

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================
-- STORAGE BUCKET FOR ORDER FILES
-- ============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-files', 'order-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Authenticated users can upload order files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'order-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can view order files they have access to"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-files' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own uploaded files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'order-files' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================
CREATE INDEX idx_orders_client_id ON public.orders(client_id);
CREATE INDEX idx_orders_current_stage ON public.orders(current_stage);
CREATE INDEX idx_orders_delivery_date ON public.orders(delivery_date);
CREATE INDEX idx_order_assignments_order_id ON public.order_assignments(order_id);
CREATE INDEX idx_order_assignments_user_id ON public.order_assignments(user_id);
CREATE INDEX idx_order_tasks_order_id ON public.order_tasks(order_id);
CREATE INDEX idx_order_tasks_assigned_to ON public.order_tasks(assigned_to);
CREATE INDEX idx_order_tasks_status ON public.order_tasks(status);
CREATE INDEX idx_order_files_order_id ON public.order_files(order_id);
CREATE INDEX idx_order_notes_order_id ON public.order_notes(order_id);
CREATE INDEX idx_order_stage_history_order_id ON public.order_stage_history(order_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX idx_clients_user_id ON public.clients(user_id);