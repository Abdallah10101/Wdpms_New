-- Security Fix: Create a separate public bucket for client logos
-- and revert order-files to private

-- 1. Create a new public bucket specifically for client logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-logos', 'client-logos', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Revert order-files bucket to private for security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'order-files';

-- 3. Add storage policies for client-logos bucket
-- Allow authenticated users to view logos (they're meant to be public for display)
CREATE POLICY "Anyone can view client logos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-logos');

-- Admins can manage all logos
CREATE POLICY "Admins can manage client logos"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'client-logos' AND
    public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'client-logos' AND
    public.is_admin()
  );

-- Team can upload logos
CREATE POLICY "Team can upload client logos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-logos' AND
    public.is_team()
  );

-- Team can update logos they have access to
CREATE POLICY "Team can update client logos"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'client-logos' AND
    public.is_team()
  )
  WITH CHECK (
    bucket_id = 'client-logos' AND
    public.is_team()
  );