-- Create supplier categories enum
CREATE TYPE public.supplier_category AS ENUM ('fabric', 'printing', 'embroidery', 'sewing', 'packaging', 'wash_house', 'accessories', 'labels', 'other');

-- Create lead status enum
CREATE TYPE public.lead_status AS ENUM ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  category supplier_category NOT NULL DEFAULT 'other',
  specialty TEXT,
  notes TEXT,
  pricing_info TEXT,
  quality_rating INTEGER CHECK (quality_rating >= 1 AND quality_rating <= 5),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create leads table
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name TEXT NOT NULL,
  contact_name TEXT,
  email TEXT,
  phone TEXT,
  brand_name TEXT,
  status lead_status NOT NULL DEFAULT 'new',
  source TEXT,
  notes TEXT,
  estimated_value DECIMAL(10, 2),
  next_follow_up DATE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add pieces_sent column to orders for tracking bulk completion
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS pieces_sent INTEGER DEFAULT 0;

-- Enable RLS
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for suppliers (admin and team only)
CREATE POLICY "Admins can manage all suppliers" 
ON public.suppliers 
FOR ALL 
USING (is_admin());

CREATE POLICY "Team can view all suppliers" 
ON public.suppliers 
FOR SELECT 
USING (is_team());

CREATE POLICY "Team can insert suppliers" 
ON public.suppliers 
FOR INSERT 
WITH CHECK (is_team());

CREATE POLICY "Team can update suppliers" 
ON public.suppliers 
FOR UPDATE 
USING (is_team());

-- RLS Policies for leads (admin and team only)
CREATE POLICY "Admins can manage all leads" 
ON public.leads 
FOR ALL 
USING (is_admin());

CREATE POLICY "Team can view all leads" 
ON public.leads 
FOR SELECT 
USING (is_team());

CREATE POLICY "Team can insert leads" 
ON public.leads 
FOR INSERT 
WITH CHECK (is_team());

CREATE POLICY "Team can update leads" 
ON public.leads 
FOR UPDATE 
USING (is_team());

-- Create triggers for updated_at
CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
BEFORE UPDATE ON public.leads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();