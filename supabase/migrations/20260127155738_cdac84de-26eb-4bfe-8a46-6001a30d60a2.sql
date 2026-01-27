-- Fix the invoice_items foreign key to use ON DELETE SET NULL 
-- (since invoice items can exist without an order reference)

-- First, drop the existing constraint
ALTER TABLE public.invoice_items
DROP CONSTRAINT IF EXISTS invoice_items_order_id_fkey;

-- Re-add with ON DELETE SET NULL (invoice items stay but lose order reference)
ALTER TABLE public.invoice_items
ADD CONSTRAINT invoice_items_order_id_fkey
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;

-- Also update the invoices table foreign key to orders
ALTER TABLE public.invoices
DROP CONSTRAINT IF EXISTS invoices_order_id_fkey;

ALTER TABLE public.invoices
ADD CONSTRAINT invoices_order_id_fkey
FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE SET NULL;