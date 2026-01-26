-- Create invoice status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue');

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  status invoice_status NOT NULL DEFAULT 'draft',
  
  -- Order details snapshot
  order_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  
  -- Cost breakdown (internal only - stored in TRY)
  fabric_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  production_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  accessories_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  pattern_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  setup_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  embroidery_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  printing_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  digital_printing_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  extra_fees NUMERIC(12,2) NOT NULL DEFAULT 0,
  washing_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Totals
  total_cost_per_piece NUMERIC(12,2) NOT NULL DEFAULT 0,
  profit_per_piece NUMERIC(12,2) NOT NULL DEFAULT 0,
  wholesale_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  retail_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  
  -- Currency info
  exchange_rate NUMERIC(10,4) NOT NULL DEFAULT 50.43,
  
  -- Accessories detail (JSON for flexibility)
  accessories_detail JSONB DEFAULT '[]'::jsonb,
  
  -- Payment tracking
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  due_date DATE,
  
  -- Notes
  internal_notes TEXT,
  client_notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_by UUID
);

-- Create invoice number sequence
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1;

-- Create function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invoice_number IS NULL OR NEW.invoice_number = '' THEN
    NEW.invoice_number := 'INV-' || TO_CHAR(now(), 'YYYY') || '-' || LPAD(nextval('invoice_number_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger for auto-generating invoice number
CREATE TRIGGER generate_invoice_number_trigger
BEFORE INSERT ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.generate_invoice_number();

-- Create trigger for updating updated_at
CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all invoices"
ON public.invoices FOR ALL
USING (is_admin());

CREATE POLICY "Team can view invoices for assigned orders"
ON public.invoices FOR SELECT
USING (is_team() AND is_assigned_to_order(order_id));

CREATE POLICY "Team can insert invoices for assigned orders"
ON public.invoices FOR INSERT
WITH CHECK (is_team() AND is_assigned_to_order(order_id));

CREATE POLICY "Team can update invoices for assigned orders"
ON public.invoices FOR UPDATE
USING (is_team() AND is_assigned_to_order(order_id));

CREATE POLICY "Clients can view their invoices"
ON public.invoices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.clients c
    WHERE c.id = invoices.client_id
    AND c.user_id = auth.uid()
  )
);

-- Enable realtime for invoices
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;