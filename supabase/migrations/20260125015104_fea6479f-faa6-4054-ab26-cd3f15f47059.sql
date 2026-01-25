-- Add columns to track which optional processes apply to each order
ALTER TABLE public.orders
ADD COLUMN has_printing BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN has_embroidery BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN has_wash_house BOOLEAN NOT NULL DEFAULT false;