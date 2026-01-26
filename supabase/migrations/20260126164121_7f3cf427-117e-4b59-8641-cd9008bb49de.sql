
-- Create invoice_items table for multiple products per invoice
CREATE TABLE public.invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  order_id UUID REFERENCES public.orders(id),
  product_name TEXT NOT NULL,
  description TEXT,
  inclusions TEXT[] DEFAULT '{}',
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage all invoice items"
  ON public.invoice_items
  FOR ALL
  USING (public.is_admin());

CREATE POLICY "Team can view invoice items for assigned orders"
  ON public.invoice_items
  FOR SELECT
  USING (
    public.is_team() AND 
    EXISTS (
      SELECT 1 FROM public.invoices i 
      WHERE i.id = invoice_items.invoice_id 
      AND public.is_assigned_to_order(i.order_id)
    )
  );

CREATE POLICY "Team can insert invoice items"
  ON public.invoice_items
  FOR INSERT
  WITH CHECK (public.is_team());

CREATE POLICY "Clients can view their invoice items"
  ON public.invoice_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i 
      JOIN public.clients c ON i.client_id = c.id
      WHERE i.id = invoice_items.invoice_id 
      AND c.user_id = auth.uid()
    )
  );

-- Add terms_and_conditions field to invoices
ALTER TABLE public.invoices 
ADD COLUMN terms_and_conditions TEXT DEFAULT 'Terms and Conditions:
• This invoice total does not include taxes that may be applicable based on your location
• The prices above are in (EUR)
• Payment terms is 100% in advance
• Processing & Manufacturing for the order is 10-15 business days
• Delivery will be made in 3-5 business days';

-- Add subtotal and total fields
ALTER TABLE public.invoices
ADD COLUMN subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
ADD COLUMN total NUMERIC(12,2) NOT NULL DEFAULT 0;
