-- Fix security issues: Restrict team access to profiles and clients based on order assignments

-- Create a helper function to check if a team member is assigned to work with a specific client
CREATE OR REPLACE FUNCTION public.is_assigned_to_client(_client_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_assignments oa
    JOIN public.orders o ON oa.order_id = o.id
    WHERE oa.user_id = auth.uid()
    AND o.client_id = _client_id
  )
$$;

-- Create a helper function to check if a team member is assigned to work with a specific user's profile
-- (either the user is a client they're assigned to, or the user is a team member they work with on orders)
CREATE OR REPLACE FUNCTION public.is_assigned_to_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Check if the profile belongs to a client the team member is assigned to
    SELECT 1
    FROM public.clients c
    JOIN public.orders o ON o.client_id = c.id
    JOIN public.order_assignments oa ON oa.order_id = o.id
    WHERE c.user_id = _profile_user_id
    AND oa.user_id = auth.uid()
    
    UNION
    
    -- Check if the profile belongs to another team member working on the same orders
    SELECT 1
    FROM public.order_assignments oa1
    JOIN public.order_assignments oa2 ON oa1.order_id = oa2.order_id
    WHERE oa1.user_id = auth.uid()
    AND oa2.user_id = _profile_user_id
  )
$$;

-- Update profiles table RLS: Replace blanket "Team can view all profiles" with restricted policy
DROP POLICY IF EXISTS "Team can view all profiles" ON public.profiles;

-- Team members can only view their own profile OR profiles they're assigned to work with
CREATE POLICY "Team can view assigned profiles"
  ON public.profiles FOR SELECT
  USING (
    is_team() AND (
      user_id = auth.uid() OR                    -- Own profile
      is_assigned_to_profile(user_id)            -- Profiles they work with
    )
  );

-- Update clients table RLS: Replace blanket "Team can view all clients" with restricted policy
DROP POLICY IF EXISTS "Team can view all clients" ON public.clients;

-- Team members can only view clients they're assigned to work with
CREATE POLICY "Team can view assigned clients"
  ON public.clients FOR SELECT
  USING (
    is_team() AND is_assigned_to_client(id)
  );