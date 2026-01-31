-- Add followers_range column to leads table
ALTER TABLE public.leads ADD COLUMN followers_range text;

-- Optionally drop estimated_value column (keeping it for now in case there's existing data)
-- If you want to remove it completely, uncomment: ALTER TABLE public.leads DROP COLUMN estimated_value;