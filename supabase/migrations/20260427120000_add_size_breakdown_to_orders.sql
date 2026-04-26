-- Add size_breakdown column to orders for storing per-size quantities
-- (e.g. {"S": 10, "M": 20, "L": 15, "XL": 5}) for both bulk and sample orders.
ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS size_breakdown jsonb;
