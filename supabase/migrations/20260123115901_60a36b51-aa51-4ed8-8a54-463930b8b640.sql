-- Fix 1: Drop overly permissive storage policies and create proper ones
DROP POLICY IF EXISTS "Authenticated users can upload order files" ON storage.objects;
DROP POLICY IF EXISTS "Users can view order files they have access to" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own uploaded files" ON storage.objects;

-- Create helper function to check if user has access to an order's files
CREATE OR REPLACE FUNCTION public.can_access_order_files(_order_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_admin() OR
    public.is_assigned_to_order(_order_id) OR
    public.is_client_of_order(_order_id)
$$;

-- Admins can do everything with order files
CREATE POLICY "Admins can manage all order files"
  ON storage.objects FOR ALL
  USING (
    bucket_id = 'order-files' AND
    public.is_admin()
  )
  WITH CHECK (
    bucket_id = 'order-files' AND
    public.is_admin()
  );

-- Team members can upload files for orders they're assigned to
CREATE POLICY "Team can upload files for assigned orders"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'order-files' AND
    public.is_team() AND
    (
      -- Extract order_id from path (format: order_id/filename)
      public.is_assigned_to_order((string_to_array(name, '/'))[1]::uuid)
    )
  );

-- Team members can view files for orders they're assigned to
CREATE POLICY "Team can view files for assigned orders"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-files' AND
    public.is_team() AND
    public.is_assigned_to_order((string_to_array(name, '/'))[1]::uuid)
  );

-- Team members can delete their own uploaded files
CREATE POLICY "Team can delete own files"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'order-files' AND
    public.is_team() AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Clients can view files for their orders (only client-visible ones are controlled at app level)
CREATE POLICY "Clients can view files for their orders"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'order-files' AND
    public.is_client() AND
    public.is_client_of_order((string_to_array(name, '/'))[1]::uuid)
  );

-- Fix 2: Create a public view for profiles that excludes sensitive data
CREATE OR REPLACE VIEW public.profiles_public
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  full_name,
  avatar_url,
  created_at,
  updated_at
FROM public.profiles;

-- Update the profiles SELECT policy to be more restrictive
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can view their own profile fully
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Team can view all profiles (needed for showing team member names)
CREATE POLICY "Team can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_team());