CREATE OR REPLACE FUNCTION public.notify_client_on_stage_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      -- Get stage label (force TEXT output to avoid enum casting)
      stage_label := CASE (NEW.current_stage::text)
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
        ELSE NEW.current_stage::text
      END;

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
$function$;
