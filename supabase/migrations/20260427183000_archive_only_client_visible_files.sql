-- Update archive_order_files_on_delivery so internal-only files (e.g. profit
-- invoices, where is_client_visible=false) are NOT copied into
-- client_archive_files. The existing client_archive_files SELECT policy lets
-- clients view all archived files for their orders, so without this filter a
-- profit invoice would become visible to the client after the order is
-- delivered.
CREATE OR REPLACE FUNCTION public.archive_order_files_on_delivery()
RETURNS TRIGGER AS $$
BEGIN
  -- Only run when stage changes TO 'delivered'
  IF NEW.current_stage = 'delivered' AND (OLD.current_stage IS NULL OR OLD.current_stage != 'delivered') THEN
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
    WHERE of.order_id = NEW.id
      AND of.is_client_visible = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
