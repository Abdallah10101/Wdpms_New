-- Create notifications table for client alerts
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'stage_change', 'invoice_uploaded', 'note_added', etc.
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only view their own notifications
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (user_id = auth.uid());

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (user_id = auth.uid());

-- System/admins can insert notifications for any user
CREATE POLICY "Admins can manage all notifications"
ON public.notifications
FOR ALL
USING (is_admin());

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Create function to notify client on stage change
CREATE OR REPLACE FUNCTION public.notify_client_on_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_user_id UUID;
  stage_label TEXT;
BEGIN
  -- Only run when stage actually changes
  IF OLD.current_stage IS DISTINCT FROM NEW.current_stage THEN
    -- Get the client's user_id
    SELECT c.user_id INTO client_user_id
    FROM public.clients c
    WHERE c.id = NEW.client_id;
    
    -- Only create notification if client has a linked user account
    IF client_user_id IS NOT NULL THEN
      -- Get stage label
      SELECT CASE NEW.current_stage
        WHEN 'not_started' THEN 'Not Started'
        WHEN 'sample' THEN 'Sample'
        WHEN 'cutting' THEN 'Cutting'
        WHEN 'printing' THEN 'Printing'
        WHEN 'embroidery' THEN 'Embroidery'
        WHEN 'sewing' THEN 'Sewing'
        WHEN 'wash_house' THEN 'Wash House'
        WHEN 'qc' THEN 'Quality Control'
        WHEN 'packaging' THEN 'Packaging'
        WHEN 'shipping' THEN 'Shipping'
        WHEN 'delivered' THEN 'Delivered'
        ELSE NEW.current_stage
      END INTO stage_label;
      
      INSERT INTO public.notifications (user_id, order_id, type, title, message, metadata)
      VALUES (
        client_user_id,
        NEW.id,
        'stage_change',
        'Order Update',
        NEW.product_name || ' moved to ' || stage_label,
        jsonb_build_object(
          'order_number', NEW.order_number,
          'from_stage', OLD.current_stage,
          'to_stage', NEW.current_stage
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for stage change notifications
CREATE TRIGGER notify_client_stage_change
AFTER UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_on_stage_change();

-- Create function to notify client on invoice upload
CREATE OR REPLACE FUNCTION public.notify_client_on_invoice_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  client_user_id UUID;
  order_info RECORD;
BEGIN
  -- Only for client invoices (invoice_2 category)
  IF NEW.category = 'invoice_2' THEN
    -- Get order and client info
    SELECT o.id, o.order_number, o.product_name, c.user_id
    INTO order_info
    FROM public.orders o
    JOIN public.clients c ON o.client_id = c.id
    WHERE o.id = NEW.order_id;
    
    -- Only create notification if client has a linked user account
    IF order_info.user_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, order_id, type, title, message, metadata)
      VALUES (
        order_info.user_id,
        NEW.order_id,
        'invoice_uploaded',
        'New Invoice',
        'Invoice uploaded for ' || order_info.product_name,
        jsonb_build_object(
          'order_number', order_info.order_number,
          'file_name', NEW.file_name
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for invoice upload notifications
CREATE TRIGGER notify_client_invoice_upload
AFTER INSERT ON public.order_files
FOR EACH ROW
EXECUTE FUNCTION public.notify_client_on_invoice_upload();