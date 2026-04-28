-- Extend the allowed values for order_files.category so the OrderInvoices
-- component can persist its three invoice slots (cost / client / profit).
ALTER TABLE public.order_files
DROP CONSTRAINT IF EXISTS order_files_category_check;

ALTER TABLE public.order_files
ADD CONSTRAINT order_files_category_check
CHECK (category IN (
  'tech_pack',
  'design',
  'photo',
  'invoice',
  'invoice_1',
  'invoice_2',
  'invoice_profit',
  'shipping',
  'label',
  'other',
  'stage_image_cutting',
  'stage_image_printing',
  'stage_image_embroidery',
  'stage_image_sewing',
  'stage_image_wash_house'
));
