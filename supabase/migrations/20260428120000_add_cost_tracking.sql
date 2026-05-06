-- Cost tracking + per-invoice cost snapshots.
--
-- Costs live on the order (one set per product) and are editable. When an
-- invoice is created we snapshot the costs onto invoice_items so previously
-- issued invoices stay accurate even if order costs change later.
--
-- All cost UI is admin-only at the application layer; this schema does not
-- enforce role-based visibility.

ALTER TABLE public.orders
ADD COLUMN IF NOT EXISTS fabric_cost numeric(12, 2),
ADD COLUMN IF NOT EXISTS pattern_cost numeric(12, 2),
ADD COLUMN IF NOT EXISTS cut_sew_cost numeric(12, 2),
ADD COLUMN IF NOT EXISTS cost_currency varchar(3) DEFAULT 'TRY';

-- Backfill cost_currency for any rows that already exist so the column never
-- holds NULL going forward; keeps the application code simple.
UPDATE public.orders
SET cost_currency = 'TRY'
WHERE cost_currency IS NULL;

ALTER TABLE public.invoice_items
ADD COLUMN IF NOT EXISTS unit_cost_snapshot numeric(12, 4),
ADD COLUMN IF NOT EXISTS cost_currency varchar(3),
ADD COLUMN IF NOT EXISTS profit_per_unit numeric(12, 4),
ADD COLUMN IF NOT EXISTS margin_percent numeric(6, 2);
