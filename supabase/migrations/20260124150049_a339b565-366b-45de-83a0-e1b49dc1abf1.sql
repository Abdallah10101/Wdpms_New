-- Make the order-files bucket public so logos can be displayed
UPDATE storage.buckets 
SET public = true 
WHERE id = 'order-files';