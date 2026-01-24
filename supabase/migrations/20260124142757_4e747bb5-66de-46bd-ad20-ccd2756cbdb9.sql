-- Create a table to track archived order files in client folders
CREATE TABLE public.client_archive_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  original_file_id UUID REFERENCES public.order_files(id) ON DELETE SET NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  category TEXT,
  archived_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  archived_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  order_number TEXT,
  delivery_month TEXT -- Format: 2026-01
);

-- Enable RLS
ALTER TABLE public.client_archive_files ENABLE ROW LEVEL SECURITY;

-- Admins can manage all archived files
CREATE POLICY "Admins can manage all archived files"
  ON public.client_archive_files FOR ALL
  USING (public.is_admin());

-- Team can view archived files
CREATE POLICY "Team can view archived files"
  ON public.client_archive_files FOR SELECT
  USING (public.is_team());

-- Clients can view their own archived files
CREATE POLICY "Clients can view their archived files"
  ON public.client_archive_files FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.clients c
      WHERE c.id = client_archive_files.client_id
      AND c.user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX idx_client_archive_files_client_id ON public.client_archive_files(client_id);
CREATE INDEX idx_client_archive_files_delivery_month ON public.client_archive_files(delivery_month);

-- Create a function to archive order files when order is delivered
CREATE OR REPLACE FUNCTION public.archive_order_files_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when stage changes TO 'delivered'
  IF NEW.current_stage = 'delivered' AND (OLD.current_stage IS NULL OR OLD.current_stage != 'delivered') THEN
    -- Copy all order files to the archive
    INSERT INTO public.client_archive_files (
      client_id,
      order_id,
      original_file_id,
      file_name,
      file_path,
      file_type,
      file_size,
      category,
      archived_by,
      order_number,
      delivery_month
    )
    SELECT 
      NEW.client_id,
      NEW.id,
      of.id,
      of.file_name,
      of.file_path,
      of.file_type,
      of.file_size,
      of.category,
      auth.uid(),
      NEW.order_number,
      TO_CHAR(now(), 'YYYY-MM')
    FROM public.order_files of
    WHERE of.order_id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-archiving
CREATE TRIGGER archive_files_on_delivery
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.archive_order_files_on_delivery();