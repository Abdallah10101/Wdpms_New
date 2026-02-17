-- ============================================================
-- WDSP Production Management System — Seed Data
-- Run AFTER schema.sql in Supabase SQL Editor
--
-- NOTE: We insert directly into auth.users so the FKs work.
-- All passwords are: Password123!
-- ============================================================

-- ─────────────────────────────────────────────
-- FIXED UUIDs for fake users
-- ─────────────────────────────────────────────
-- Admin:      a0000000-0000-0000-0000-000000000001
-- Team 1:     a0000000-0000-0000-0000-000000000002
-- Team 2:     a0000000-0000-0000-0000-000000000003
-- Client 1:   a0000000-0000-0000-0000-000000000004  (Luxe Studio)
-- Client 2:   a0000000-0000-0000-0000-000000000005  (Nova Wear)
-- Client 3:   a0000000-0000-0000-0000-000000000006  (Urban Threads)

-- ─────────────────────────────────────────────
-- 1. AUTH USERS  (bypass trigger with on conflict)
-- ─────────────────────────────────────────────
-- NOTE: instance_id must match your Supabase project's instance_id.
-- Run this first to get your project's instance_id:
--   SELECT instance_id FROM auth.users LIMIT 1;
-- Then replace the value below with the result.
do $$
declare
  v_instance_id uuid;
begin
  -- Auto-detect instance_id from any existing auth user, fallback to zeros
  select instance_id into v_instance_id from auth.users limit 1;
  if v_instance_id is null then
    v_instance_id := '00000000-0000-0000-0000-000000000000';
  end if;

  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_user_meta_data, raw_app_meta_data, is_super_admin, is_sso_user, confirmation_token, recovery_token, email_change_token_new, email_change)
  values
    (v_instance_id, 'a0000000-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@wdsp.com',
     crypt('Password123456!', gen_salt('bf', 10)), now(), now(), now(),
     '{"full_name":"Ahmed Al-Rashidi"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false, '', '', '', ''),

    (v_instance_id, 'a0000000-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'sara@wdsp.com',
     crypt('Password123456!', gen_salt('bf', 10)), now(), now(), now(),
     '{"full_name":"Sara Yilmaz"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false, '', '', '', ''),

    (v_instance_id, 'a0000000-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'karim@wdsp.com',
     crypt('Password123456!', gen_salt('bf', 10)), now(), now(), now(),
     '{"full_name":"Karim Bouaziz"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false, '', '', '', ''),

    (v_instance_id, 'a0000000-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'client.luxe@email.com',
     crypt('Password123456!', gen_salt('bf', 10)), now(), now(), now(),
     '{"full_name":"Layla Hassan"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false, '', '', '', ''),

    (v_instance_id, 'a0000000-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'client.nova@email.com',
     crypt('Password123456!', gen_salt('bf', 10)), now(), now(), now(),
     '{"full_name":"Omar Farouq"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false, '', '', '', ''),

    (v_instance_id, 'a0000000-0000-0000-0000-000000000006', 'authenticated', 'authenticated', 'client.urban@email.com',
     crypt('Password123456!', gen_salt('bf', 10)), now(), now(), now(),
     '{"full_name":"Nour Khalil"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, false, false, '', '', '', '')
  on conflict do nothing;
end $$;

-- ─────────────────────────────────────────────
-- 2. PROFILES
-- ─────────────────────────────────────────────
insert into public.profiles (id, user_id, full_name, email, phone, created_at, updated_at)
values
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000001', 'Ahmed Al-Rashidi',  'admin@wdsp.com',         '+90 532 111 0001', now(), now()),
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000002', 'Sara Yilmaz',       'sara@wdsp.com',          '+90 532 111 0002', now(), now()),
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000003', 'Karim Bouaziz',     'karim@wdsp.com',         '+90 532 111 0003', now(), now()),
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000004', 'Layla Hassan',      'client.luxe@email.com',  '+971 50 222 0004', now(), now()),
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000005', 'Omar Farouq',       'client.nova@email.com',  '+971 50 222 0005', now(), now()),
  (uuid_generate_v4(), 'a0000000-0000-0000-0000-000000000006', 'Nour Khalil',       'client.urban@email.com', '+971 50 222 0006', now(), now())
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 3. USER ROLES
-- ─────────────────────────────────────────────
insert into public.user_roles (user_id, role)
values
  ('a0000000-0000-0000-0000-000000000001', 'admin'),
  ('a0000000-0000-0000-0000-000000000002', 'team'),
  ('a0000000-0000-0000-0000-000000000003', 'team'),
  ('a0000000-0000-0000-0000-000000000004', 'client'),
  ('a0000000-0000-0000-0000-000000000005', 'client'),
  ('a0000000-0000-0000-0000-000000000006', 'client')
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 4. CLIENTS
-- ─────────────────────────────────────────────
insert into public.clients (id, name, brand_name, contact_person, contact_email, contact_phone, address, notes, user_id, created_by, created_at, updated_at)
values
  ('c1000000-0000-0000-0000-000000000001',
   'Luxe Studio FZE', 'LUXE STUDIO',
   'Layla Hassan', 'client.luxe@email.com', '+971 50 222 0004',
   'Dubai Design District, Building 6, UAE',
   'Premium womenswear brand. Prefers eco-friendly fabrics. Pays on time.',
   'a0000000-0000-0000-0000-000000000004',
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '6 months', now()),

  ('c1000000-0000-0000-0000-000000000002',
   'Nova Wear Ltd.', 'NOVA WEAR',
   'Omar Farouq', 'client.nova@email.com', '+971 50 222 0005',
   'Jumeirah Lake Towers, Cluster N, Dubai, UAE',
   'Streetwear / athleisure brand. High volume orders.',
   'a0000000-0000-0000-0000-000000000005',
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '4 months', now()),

  ('c1000000-0000-0000-0000-000000000003',
   'Urban Threads Trading', 'URBAN THREADS',
   'Nour Khalil', 'client.urban@email.com', '+971 50 222 0006',
   'Sharjah Industrial Area 6, UAE',
   'Mid-range unisex basics and workwear.',
   'a0000000-0000-0000-0000-000000000006',
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '2 months', now())
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 5. ORDERS
-- ─────────────────────────────────────────────
insert into public.orders (id, order_number, product_name, client_id, collection, size, fabric, supplier, quantity, pieces_sent, delivery_date, priority, current_stage, stage_updated_at, has_printing, has_embroidery, has_wash_house, created_by, created_at, updated_at)
values
  -- Luxe Studio orders
  ('00100000-0000-0000-0000-000000000001',
   'WDS-20260101-0001', 'Oversized Linen Blazer',
   'c1000000-0000-0000-0000-000000000001',
   'SS26 Collection', 'S/M/L/XL', 'Italian Linen 140gsm', 'Ahmet Kumaş',
   500, 480, current_date + 30, 'high', 'qc',
   now() - interval '2 days', false, false, false,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '45 days', now()),

  ('00100000-0000-0000-0000-000000000002',
   'WDS-20260105-0002', 'Silk Wrap Dress',
   'c1000000-0000-0000-0000-000000000001',
   'SS26 Collection', 'XS/S/M/L', 'Silk Satin 90gsm', 'Ahmet Kumaş',
   300, null, current_date + 60, 'medium', 'sewing',
   now() - interval '1 day', false, true, false,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '20 days', now()),

  ('00100000-0000-0000-0000-000000000003',
   'WDS-20260110-0003', 'Linen Trousers (Sample)',
   'c1000000-0000-0000-0000-000000000001',
   'SS26 Collection', 'S/M/L', 'Linen Blend 120gsm', 'sample',
   5, null, current_date + 14, 'urgent', 'sample',
   now() - interval '5 days', false, false, false,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '7 days', now()),

  -- Nova Wear orders
  ('00100000-0000-0000-0000-000000000004',
   'WDS-20260115-0004', 'Graphic Oversized Hoodie',
   'c1000000-0000-0000-0000-000000000002',
   'Drop 1 FW26', 'S/M/L/XL/XXL', 'Fleece 380gsm', 'Polat Tekstil',
   1200, 1200, current_date - 5, 'urgent', 'delivered',
   now() - interval '4 days', true, false, true,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '60 days', now()),

  ('00100000-0000-0000-0000-000000000005',
   'WDS-20260120-0005', 'Cargo Jogger Pants',
   'c1000000-0000-0000-0000-000000000002',
   'Drop 1 FW26', 'S/M/L/XL', 'Ripstop Nylon 200gsm', 'Polat Tekstil',
   800, null, current_date + 45, 'medium', 'cutting',
   now() - interval '3 days', false, false, false,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '15 days', now()),

  ('00100000-0000-0000-0000-000000000006',
   'WDS-20260122-0006', 'Puffer Vest (Sample)',
   'c1000000-0000-0000-0000-000000000002',
   'Drop 2 FW26', 'M/L', 'Nylon Shell 70D', 'sample',
   3, null, current_date + 10, 'high', 'cutting',
   now() - interval '1 day', false, false, false,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '5 days', now()),

  -- Urban Threads orders
  ('00100000-0000-0000-0000-000000000007',
   'WDS-20260201-0007', 'Basic Crewneck Sweatshirt',
   'c1000000-0000-0000-0000-000000000003',
   'Core Basics FW26', 'XS/S/M/L/XL/XXL', 'Cotton Fleece 320gsm', 'Kaya Tekstil',
   2000, null, current_date + 90, 'low', 'not_started',
   null, false, false, false,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '3 days', now()),

  ('00100000-0000-0000-0000-000000000008',
   'WDS-20260205-0008', 'Work Chino Trousers',
   'c1000000-0000-0000-0000-000000000003',
   'Core Basics FW26', 'S/M/L/XL', 'Stretch Twill 250gsm', 'Kaya Tekstil',
   600, null, current_date + 75, 'medium', 'printing',
   now() - interval '6 hours', true, false, false,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '12 days', now())
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 6. ORDER ASSIGNMENTS
-- ─────────────────────────────────────────────
insert into public.order_assignments (order_id, user_id, assigned_by, assigned_at)
values
  ('00100000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '44 days'),
  ('00100000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '19 days'),
  ('00100000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '6 days'),
  ('00100000-0000-0000-0000-000000000004', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', now() - interval '59 days'),
  ('00100000-0000-0000-0000-000000000005', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', now() - interval '14 days'),
  ('00100000-0000-0000-0000-000000000006', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', now() - interval '4 days'),
  ('00100000-0000-0000-0000-000000000007', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '2 days'),
  ('00100000-0000-0000-0000-000000000008', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '11 days')
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 7. ORDER STAGE HISTORY
-- ─────────────────────────────────────────────
insert into public.order_stage_history (order_id, from_stage, to_stage, changed_by, changed_at, notes)
values
  -- Blazer: not_started → cutting → sewing → qc
  ('00100000-0000-0000-0000-000000000001', 'not_started', 'cutting',  'a0000000-0000-0000-0000-000000000001', now() - interval '40 days', null),
  ('00100000-0000-0000-0000-000000000001', 'cutting',     'sewing',   'a0000000-0000-0000-0000-000000000002', now() - interval '25 days', 'Fabric cut and sorted by size'),
  ('00100000-0000-0000-0000-000000000001', 'sewing',      'qc',       'a0000000-0000-0000-0000-000000000002', now() - interval '2 days',  'Ready for quality check'),
  -- Silk Dress: not_started → cutting → embroidery → sewing
  ('00100000-0000-0000-0000-000000000002', 'not_started', 'cutting',  'a0000000-0000-0000-0000-000000000001', now() - interval '18 days', null),
  ('00100000-0000-0000-0000-000000000002', 'cutting',     'embroidery','a0000000-0000-0000-0000-000000000002', now() - interval '10 days', null),
  ('00100000-0000-0000-0000-000000000002', 'embroidery',  'sewing',   'a0000000-0000-0000-0000-000000000002', now() - interval '1 day',   'Embroidery approved'),
  -- Hoodie: full journey → delivered
  ('00100000-0000-0000-0000-000000000004', 'not_started', 'cutting',  'a0000000-0000-0000-0000-000000000001', now() - interval '55 days', null),
  ('00100000-0000-0000-0000-000000000004', 'cutting',     'printing', 'a0000000-0000-0000-0000-000000000003', now() - interval '45 days', null),
  ('00100000-0000-0000-0000-000000000004', 'printing',    'sewing',   'a0000000-0000-0000-0000-000000000003', now() - interval '35 days', 'Screen print passed inspection'),
  ('00100000-0000-0000-0000-000000000004', 'sewing',      'wash_house','a0000000-0000-0000-0000-000000000003', now() - interval '25 days', null),
  ('00100000-0000-0000-0000-000000000004', 'wash_house',  'qc',       'a0000000-0000-0000-0000-000000000003', now() - interval '15 days', null),
  ('00100000-0000-0000-0000-000000000004', 'qc',          'packaging','a0000000-0000-0000-0000-000000000003', now() - interval '10 days', '98% pass rate'),
  ('00100000-0000-0000-0000-000000000004', 'packaging',   'shipping', 'a0000000-0000-0000-0000-000000000003', now() - interval '6 days',  null),
  ('00100000-0000-0000-0000-000000000004', 'shipping',    'delivered','a0000000-0000-0000-0000-000000000001', now() - interval '4 days',  'Delivered to DHL Dubai'),
  -- Cargo Jogger
  ('00100000-0000-0000-0000-000000000005', 'not_started', 'cutting',  'a0000000-0000-0000-0000-000000000001', now() - interval '3 days',  null),
  -- Work Chino
  ('00100000-0000-0000-0000-000000000008', 'not_started', 'cutting',  'a0000000-0000-0000-0000-000000000001', now() - interval '10 days', null),
  ('00100000-0000-0000-0000-000000000008', 'cutting',     'printing', 'a0000000-0000-0000-0000-000000000002', now() - interval '3 days',  null);

-- ─────────────────────────────────────────────
-- 8. ORDER TASKS
-- ─────────────────────────────────────────────
insert into public.order_tasks (order_id, title, description, assigned_to, due_date, status, sort_order, completed_at, completed_by, created_by, created_at, updated_at)
values
  -- Blazer tasks
  ('00100000-0000-0000-0000-000000000001', 'Approve fabric swatches',     'Sign off on final linen swatch',        'a0000000-0000-0000-0000-000000000002', current_date - 30, 'done',        0, now() - interval '31 days', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '44 days', now()),
  ('00100000-0000-0000-0000-000000000001', 'Submit tech pack to factory',  null,                                    'a0000000-0000-0000-0000-000000000002', current_date - 25, 'done',        1, now() - interval '26 days', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '44 days', now()),
  ('00100000-0000-0000-0000-000000000001', 'QC inspection report',         'Check stitching, buttons, sizing',      'a0000000-0000-0000-0000-000000000002', current_date + 2,  'in_progress', 2, null, null, 'a0000000-0000-0000-0000-000000000001', now() - interval '44 days', now()),
  ('00100000-0000-0000-0000-000000000001', 'Book shipping with forwarder', null,                                    'a0000000-0000-0000-0000-000000000001', current_date + 5,  'pending',     3, null, null, 'a0000000-0000-0000-0000-000000000001', now() - interval '44 days', now()),
  -- Silk Dress tasks
  ('00100000-0000-0000-0000-000000000002', 'Send embroidery design files', 'DST file to Bilal embroidery',          'a0000000-0000-0000-0000-000000000002', current_date - 8,  'done',        0, now() - interval '9 days', 'a0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', now() - interval '19 days', now()),
  ('00100000-0000-0000-0000-000000000002', 'Follow up sewing line',        'Check progress daily',                  'a0000000-0000-0000-0000-000000000002', current_date + 5,  'in_progress', 1, null, null, 'a0000000-0000-0000-0000-000000000001', now() - interval '19 days', now()),
  ('00100000-0000-0000-0000-000000000002', 'Label placement review',       'Client wants Arabic + English labels',  'a0000000-0000-0000-0000-000000000002', current_date + 10, 'pending',     2, null, null, 'a0000000-0000-0000-0000-000000000001', now() - interval '19 days', now()),
  -- Hoodie tasks (all done)
  ('00100000-0000-0000-0000-000000000004', 'Confirm print artwork',        null,                                    'a0000000-0000-0000-0000-000000000003', current_date - 50, 'done',        0, now() - interval '52 days', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', now() - interval '59 days', now()),
  ('00100000-0000-0000-0000-000000000004', 'Wash test approval',           '3 wash cycles, check colour fade',      'a0000000-0000-0000-0000-000000000003', current_date - 20, 'done',        1, now() - interval '22 days', 'a0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', now() - interval '59 days', now()),
  ('00100000-0000-0000-0000-000000000004', 'Final invoice issued',         null,                                    'a0000000-0000-0000-0000-000000000001', current_date - 5,  'done',        2, now() - interval '5 days',  'a0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', now() - interval '59 days', now()),
  -- Cargo Jogger
  ('00100000-0000-0000-0000-000000000005', 'Receive fabric from supplier', 'Confirm gsm and yardage',               'a0000000-0000-0000-0000-000000000003', current_date + 5,  'in_progress', 0, null, null, 'a0000000-0000-0000-0000-000000000001', now() - interval '14 days', now()),
  ('00100000-0000-0000-0000-000000000005', 'Pattern grading',              'Sizes S–XL',                            'a0000000-0000-0000-0000-000000000003', current_date + 10, 'pending',     1, null, null, 'a0000000-0000-0000-0000-000000000001', now() - interval '14 days', now()),
  -- Basic Crewneck
  ('00100000-0000-0000-0000-000000000007', 'Source cotton fleece stock',   null,                                    'a0000000-0000-0000-0000-000000000002', current_date + 20, 'pending',     0, null, null, 'a0000000-0000-0000-0000-000000000001', now() - interval '3 days', now());

-- ─────────────────────────────────────────────
-- 9. ORDER NOTES
-- ─────────────────────────────────────────────
insert into public.order_notes (order_id, content, is_client_visible, author_id, created_at, updated_at)
values
  ('00100000-0000-0000-0000-000000000001', 'Client approved final linen swatch on video call. Colour: Off-White only.', true,  'a0000000-0000-0000-0000-000000000001', now() - interval '38 days', now()),
  ('00100000-0000-0000-0000-000000000001', 'Factory pushing back delivery by 3 days due to machine maintenance. Flagged to client.', true, 'a0000000-0000-0000-0000-000000000002', now() - interval '10 days', now()),
  ('00100000-0000-0000-0000-000000000001', 'Internal: Check if extra fabric roll is available for potential reorder.', false, 'a0000000-0000-0000-0000-000000000002', now() - interval '5 days',  now()),
  ('00100000-0000-0000-0000-000000000002', 'Embroidery chest badge approved by client — 8cm diameter, silver thread.', true, 'a0000000-0000-0000-0000-000000000002', now() - interval '8 days',  now()),
  ('00100000-0000-0000-0000-000000000002', 'Size run: XS×60, S×80, M×100, L×60. Client confirmed 16 Jan.', false, 'a0000000-0000-0000-0000-000000000001', now() - interval '15 days', now()),
  ('00100000-0000-0000-0000-000000000004', 'All 1,200 pieces shipped via DHL Express — AWB: 1234567890.', true, 'a0000000-0000-0000-0000-000000000001', now() - interval '4 days',  now()),
  ('00100000-0000-0000-0000-000000000004', 'Post-delivery: 4 pieces returned due to print defect, replacement in next order agreed.', false, 'a0000000-0000-0000-0000-000000000003', now() - interval '3 days',  now()),
  ('00100000-0000-0000-0000-000000000005', 'Pattern set received from client design team. Starting grading.', false, 'a0000000-0000-0000-0000-000000000003', now() - interval '12 days', now()),
  ('00100000-0000-0000-0000-000000000007', 'Client wants printed hangtags. Need to add to accessories budget.', true, 'a0000000-0000-0000-0000-000000000002', now() - interval '1 day',   now());

-- ─────────────────────────────────────────────
-- 10. ORDER FILES (metadata only — no actual files)
-- ─────────────────────────────────────────────
insert into public.order_files (order_id, file_name, file_path, file_type, file_size, category, is_client_visible, uploaded_by, created_at)
values
  ('00100000-0000-0000-0000-000000000001', 'Luxe_SS26_Blazer_TechPack_v3.pdf', '00100000-0000-0000-0000-000000000001/LuxeBlazar_TP_v3.pdf', 'application/pdf', 4200000, 'tech_pack', false, 'a0000000-0000-0000-0000-000000000002', now() - interval '40 days'),
  ('00100000-0000-0000-0000-000000000001', 'Blazer_FabricSwatch_OffWhite.jpg', '00100000-0000-0000-0000-000000000001/Swatch_OffWhite.jpg', 'image/jpeg', 850000, 'photo', true, 'a0000000-0000-0000-0000-000000000002', now() - interval '38 days'),
  ('00100000-0000-0000-0000-000000000001', 'QC_Report_Blazer_Draft.pdf', '00100000-0000-0000-0000-000000000001/QC_Draft.pdf', 'application/pdf', 1100000, 'design', false, 'a0000000-0000-0000-0000-000000000002', now() - interval '1 day'),
  ('00100000-0000-0000-0000-000000000002', 'SilkDress_EmbroideryDesign_Final.dst', '00100000-0000-0000-0000-000000000002/embroidery_final.dst', 'application/octet-stream', 320000, 'design', false, 'a0000000-0000-0000-0000-000000000002', now() - interval '12 days'),
  ('00100000-0000-0000-0000-000000000002', 'SilkDress_Progress_Photo_01.jpg', '00100000-0000-0000-0000-000000000002/progress_01.jpg', 'image/jpeg', 2100000, 'photo', true, 'a0000000-0000-0000-0000-000000000002', now() - interval '3 days'),
  ('00100000-0000-0000-0000-000000000004', 'Hoodie_TechPack_v1.pdf', '00100000-0000-0000-0000-000000000004/Hoodie_TP_v1.pdf', 'application/pdf', 3800000, 'tech_pack', false, 'a0000000-0000-0000-0000-000000000003', now() - interval '58 days'),
  ('00100000-0000-0000-0000-000000000004', 'Hoodie_PrintArtwork_Front.ai', '00100000-0000-0000-0000-000000000004/print_front.ai', 'application/illustrator', 9500000, 'design', false, 'a0000000-0000-0000-0000-000000000003', now() - interval '52 days'),
  ('00100000-0000-0000-0000-000000000004', 'Hoodie_Delivered_PackingList.pdf', '00100000-0000-0000-0000-000000000004/packing_list.pdf', 'application/pdf', 480000, 'shipping', true, 'a0000000-0000-0000-0000-000000000001', now() - interval '4 days');

-- ─────────────────────────────────────────────
-- 11. SUPPLIERS
-- ─────────────────────────────────────────────
insert into public.suppliers (id, name, contact_person, phone, email, address, category, specialty, notes, pricing_info, quality_rating, is_active, created_by, created_at, updated_at)
values
  ('00500000-0000-0000-0000-000000000001',
   'Ahmet Kumaş Tekstil', 'Ahmet Demir', '+90 212 555 0101', 'ahmet@ahmetkumas.com.tr',
   'Bağcılar, İstanbul, Turkey', 'fabric',
   'Linen, cotton, silk blends', 'Long-time supplier. 30-day credit terms.', 'Linen €4.50/m, Silk €12/m, Min 500m',
   5, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '6 months', now()),

  ('00500000-0000-0000-0000-000000000002',
   'Polat Tekstil San.', 'Mehmet Polat', '+90 212 555 0202', 'info@polattekstil.com.tr',
   'Esenler, İstanbul, Turkey', 'fabric',
   'Fleece, ripstop, technical fabrics', 'Good for athletic and streetwear.', 'Fleece ₺180/m, Ripstop ₺95/m',
   4, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '5 months', now()),

  ('00500000-0000-0000-0000-000000000003',
   'Bilal Nakış & Baskı', 'Bilal Arslan', '+90 532 555 0303', 'bilal@bilalnakis.com',
   'Güngören, İstanbul, Turkey', 'embroidery',
   'Chest badges, sleeve patches, all thread types', 'Fastest turnaround in the district. 5-day lead.', '₺18/piece for 10k stitches, discount at 500+',
   5, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '5 months', now()),

  ('00500000-0000-0000-0000-000000000004',
   'Istanbul Screen Print Co.', 'Yusuf Şahin', '+90 212 555 0404', 'yusuf@ispco.com.tr',
   'Zeytinburnu, İstanbul, Turkey', 'printing',
   'Screen printing, DTF, discharge print', null, '₺22/piece up to 2 colours, DTF ₺35/piece',
   4, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '4 months', now()),

  ('00500000-0000-0000-0000-000000000005',
   'Kaya Tekstil Konfeksiyon', 'Hasan Kaya', '+90 212 555 0505', 'hasan@kayakonfeksiyon.com',
   'Bağcılar, İstanbul, Turkey', 'sewing',
   'All garment categories, specialised in basics', 'In-house pattern team. 600 pcs/day capacity.', 'CMT: ₺55–₺120/piece depending on complexity',
   4, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '6 months', now()),

  ('00500000-0000-0000-0000-000000000006',
   'AquaWash İstanbul', 'Selim Özer', '+90 532 555 0606', 'selim@aquawash.com.tr',
   'Sultangazi, İstanbul, Turkey', 'wash_house',
   'Stone wash, enzyme wash, garment dye', null, '₺8–₺15/piece based on process',
   3, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '3 months', now()),

  ('00500000-0000-0000-0000-000000000007',
   'FastPack Ambalaj', 'Derya Aktaş', '+90 212 555 0707', 'derya@fastpack.com.tr',
   'Bağcılar, İstanbul, Turkey', 'packaging',
   'Polybags, boxes, hangtags, swing tags', 'Next day delivery within Istanbul.', 'Polybags ₺0.80, Boxes ₺3.50, Hangtags ₺1.20',
   5, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '6 months', now()),

  ('00500000-0000-0000-0000-000000000008',
   'Güven Etiket & Aksesuar', 'Fatma Güven', '+90 532 555 0808', 'fatma@guvenetiket.com',
   'Merter, İstanbul, Turkey', 'labels',
   'Woven labels, care labels, size labels, patch labels', null, 'Woven ₺1.80/pc MOQ 500, Care ₺0.40/pc',
   5, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '6 months', now()),

  ('00500000-0000-0000-0000-000000000009',
   'Ayna Aksesuar', 'Caner Ayna', '+90 212 555 0909', 'caner@aynaaccessory.com',
   'Merter, İstanbul, Turkey', 'accessories',
   'Zippers, buttons, snaps, drawcords, eyelets', null, 'YKK zippers ₺4.50, Buttons ₺0.60 each',
   4, true, 'a0000000-0000-0000-0000-000000000001', now() - interval '5 months', now()),

  ('00500000-0000-0000-0000-000000000010',
   'Parça Dokuma Ltd.', 'Serkan Doğan', '+90 212 555 1010', null,
   'Çerkezköy, Istanbul, Turkey', 'fabric',
   'Denim, canvas, heavy cotton', 'Slower delivery (10 days) but great pricing.', 'Denim ₺85/m, Canvas ₺55/m',
   3, false, 'a0000000-0000-0000-0000-000000000001', now() - interval '8 months', now())
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 12. LEADS
-- ─────────────────────────────────────────────
insert into public.leads (id, company_name, contact_name, email, phone, brand_name, status, source, notes, followers_range, next_follow_up, created_by, created_at, updated_at)
values
  ('00300000-0000-0000-0000-000000000001',
   'Desert Bloom Apparel', 'Fatima Al-Nasser', 'fatima@desertbloom.ae', '+971 55 100 2001',
   'DESERT BLOOM', 'proposal',
   'Instagram DM', 'Looking for 300–500pcs modest wear. Interested in embroidery. Budget is reasonable.',
   '10k-50k', current_date + 7,
   'a0000000-0000-0000-0000-000000000001', now() - interval '14 days', now()),

  ('00300000-0000-0000-0000-000000000002',
   'Marble Studios', 'Jake Williams', 'jake@marblestudios.co.uk', '+44 7700 900 200',
   'MARBLE', 'qualified',
   'Referral', 'UK streetwear brand scaling to 1000+ units. Needs full CMT + packaging.',
   '50k-100k', current_date + 3,
   'a0000000-0000-0000-0000-000000000001', now() - interval '30 days', now()),

  ('00300000-0000-0000-0000-000000000003',
   'Sage & Stone Co.', 'Maya Patel', 'maya@sagestone.com', '+1 310 555 0300',
   'SAGE & STONE', 'negotiation',
   'Trade Show', 'Los Angeles sustainable fashion brand. 500pcs linen range. Needs GRS certification.',
   '100k-500k', current_date + 2,
   'a0000000-0000-0000-0000-000000000001', now() - interval '45 days', now()),

  ('00300000-0000-0000-0000-000000000004',
   'Volt Athletics', 'Dan Kowalski', 'dan@voltathletics.com', '+1 646 555 0400',
   'VOLT', 'contacted',
   'Cold Email', 'Performance activewear, sublimation printing needed. Evaluating multiple factories.',
   '10k-50k', current_date + 14,
   'a0000000-0000-0000-0000-000000000001', now() - interval '7 days', now()),

  ('00300000-0000-0000-0000-000000000005',
   'Crescent Couture', 'Hana Al-Mousa', 'hana@crescentcouture.com', '+966 55 500 5005',
   'CRESCENT COUTURE', 'won',
   'Instagram DM', 'Converted to client! First order being processed.', '1k-10k',
   null,
   'a0000000-0000-0000-0000-000000000001', now() - interval '60 days', now()),

  ('00300000-0000-0000-0000-000000000006',
   'Kore Concept Store', 'Emre Yıldız', 'emre@koreconcept.com', '+90 532 600 0006',
   'KORE', 'new',
   'Walk-in', 'Stopped by the showroom. Small quantities 100-200pcs. Following up Monday.',
   '1k-10k', current_date + 1,
   'a0000000-0000-0000-0000-000000000002', now() - interval '2 days', now()),

  ('00300000-0000-0000-0000-000000000007',
   'Bloom & Co. Kids', 'Sarah Green', 'sarah@bloomkids.com', '+61 400 700 007',
   'BLOOM KIDS', 'lost',
   'LinkedIn', 'Went with a local Australian manufacturer due to shipping costs.',
   '10k-50k', null,
   'a0000000-0000-0000-0000-000000000001', now() - interval '90 days', now())
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 13. INVOICES
-- ─────────────────────────────────────────────
insert into public.invoices (id, invoice_number, order_id, client_id, status, order_name, quantity, fabric_cost, production_cost, accessories_cost, pattern_cost, setup_cost, embroidery_cost, printing_cost, digital_printing_cost, extra_fees, washing_cost, total_cost_per_piece, profit_per_piece, wholesale_price, retail_price, exchange_rate, accessories_detail, amount_paid, due_date, subtotal, total, terms_and_conditions, client_notes, sent_at, viewed_at, paid_at, created_by, created_at, updated_at)
values
  -- Invoice for delivered hoodie (PAID)
  ('00400000-0000-0000-0000-000000000001',
   'INV-2026-0001',
   '00100000-0000-0000-0000-000000000004',
   'c1000000-0000-0000-0000-000000000002',
   'paid', 'Graphic Oversized Hoodie × 1200',
   1200,
   45.00, 55.00, 12.00, 0, 8.00, 0, 22.00, 0, 3.50, 15.00,
   160.50, 39.50, 200.00, 320.00,
   32.5,
   '[{"item":"YKK Zipper","qty":1,"unit":4.50},{"item":"Drawcord","qty":1,"unit":1.20},{"item":"Eyelets x2","qty":2,"unit":0.50}]'::jsonb,
   240000.00,
   current_date - 10,
   240000.00, 240000.00,
   'Payment due within 30 days of invoice date. 50% deposit required before production.',
   'Thank you for your order. Please review the attached packing list.',
   now() - interval '12 days',
   now() - interval '11 days',
   now() - interval '5 days',
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '13 days', now()),

  -- Invoice for blazer (SENT, partially paid)
  ('00400000-0000-0000-0000-000000000002',
   'INV-2026-0002',
   '00100000-0000-0000-0000-000000000001',
   'c1000000-0000-0000-0000-000000000001',
   'partially_paid', 'Oversized Linen Blazer × 500',
   500,
   85.00, 65.00, 8.00, 15.00, 5.00, 0, 0, 0, 0, 0,
   178.00, 52.00, 230.00, 420.00,
   32.5,
   '[{"item":"Buttons x4","qty":4,"unit":0.60}]'::jsonb,
   57500.00,
   current_date + 15,
   115000.00, 115000.00,
   'Payment due within 30 days. 50% deposit paid, balance due on delivery.',
   'Deposit received. Balance of $57,500 due upon delivery confirmation.',
   now() - interval '5 days',
   now() - interval '4 days',
   null,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '6 days', now()),

  -- Invoice for silk dress (DRAFT)
  ('00400000-0000-0000-0000-000000000003',
   'INV-2026-0003',
   '00100000-0000-0000-0000-000000000002',
   'c1000000-0000-0000-0000-000000000001',
   'draft', 'Silk Wrap Dress × 300',
   300,
   120.00, 70.00, 10.00, 20.00, 5.00, 18.00, 0, 0, 0, 0,
   243.00, 57.00, 300.00, 560.00,
   32.5,
   null,
   0,
   current_date + 45,
   90000.00, 90000.00,
   null, null, null, null, null,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '1 day', now()),

  -- Invoice for cargo jogger (OVERDUE)
  ('00400000-0000-0000-0000-000000000004',
   'INV-2026-0004',
   '00100000-0000-0000-0000-000000000005',
   'c1000000-0000-0000-0000-000000000002',
   'overdue', 'Cargo Jogger Pants × 800 — Deposit',
   800,
   55.00, 50.00, 15.00, 0, 0, 0, 0, 0, 0, 0,
   120.00, 30.00, 150.00, 280.00,
   32.5,
   '[{"item":"YKK Zip x2","qty":2,"unit":4.50},{"item":"D-Ring","qty":2,"unit":0.80}]'::jsonb,
   0,
   current_date - 7,
   60000.00, 60000.00,
   'Deposit invoice. Full payment required before shipment.',
   '50% deposit required to confirm production slot.',
   now() - interval '20 days',
   now() - interval '19 days',
   null,
   'a0000000-0000-0000-0000-000000000001',
   now() - interval '21 days', now())
on conflict do nothing;

-- ─────────────────────────────────────────────
-- 14. INVOICE ITEMS
-- ─────────────────────────────────────────────
insert into public.invoice_items (invoice_id, order_id, product_name, description, inclusions, quantity, unit_price, amount, sort_order, created_at)
values
  -- Hoodie invoice items
  ('00400000-0000-0000-0000-000000000001',
   '00100000-0000-0000-0000-000000000004',
   'Graphic Oversized Hoodie', 'Fleece 380gsm, screen print front + back, enzyme wash',
   array['Screen printing (2 placements)', 'Enzyme wash', 'YKK zipper', 'Custom drawcord', 'Polybag packaging'],
   1200, 200.00, 240000.00, 0, now() - interval '13 days'),

  -- Blazer invoice items
  ('00400000-0000-0000-0000-000000000002',
   '00100000-0000-0000-0000-000000000001',
   'Oversized Linen Blazer', 'Italian linen 140gsm, fully lined, 4-button front',
   array['Italian linen fabric', 'Full lining', 'Pattern grading S–XL', 'Woven label', 'Hanger packaging'],
   500, 230.00, 115000.00, 0, now() - interval '6 days'),

  -- Silk dress invoice items
  ('00400000-0000-0000-0000-000000000003',
   '00100000-0000-0000-0000-000000000002',
   'Silk Wrap Dress', 'Silk satin 90gsm, chest embroidery badge, adjustable wrap belt',
   array['Silk satin fabric', 'Chest embroidery (silver thread)', 'Self-fabric belt', 'Care + woven label', 'Garment bag packaging'],
   300, 300.00, 90000.00, 0, now() - interval '1 day'),

  -- Cargo jogger deposit
  ('00400000-0000-0000-0000-000000000004',
   '00100000-0000-0000-0000-000000000005',
   'Cargo Jogger Pants — 50% Deposit', 'Ripstop nylon, 6 pockets, elasticated waist',
   array['Ripstop nylon fabric', 'YKK zippers (x2 per piece)', 'Elastic waistband', 'D-ring hardware', 'Screen print logo'],
   800, 75.00, 60000.00, 0, now() - interval '21 days');

-- ─────────────────────────────────────────────
-- 15. NOTIFICATIONS
-- ─────────────────────────────────────────────
insert into public.notifications (user_id, order_id, type, title, message, is_read, metadata, created_at)
values
  -- Client notifications (Luxe Studio)
  ('a0000000-0000-0000-0000-000000000004',
   '00100000-0000-0000-0000-000000000001',
   'stage_change', 'Order WDS-20260101-0001 Updated',
   'Your order has moved to the qc stage.',
   false,
   '{"from_stage":"sewing","to_stage":"qc"}'::jsonb,
   now() - interval '2 days'),

  ('a0000000-0000-0000-0000-000000000004',
   '00100000-0000-0000-0000-000000000002',
   'stage_change', 'Order WDS-20260105-0002 Updated',
   'Your order has moved to the sewing stage.',
   true,
   '{"from_stage":"embroidery","to_stage":"sewing"}'::jsonb,
   now() - interval '1 day'),

  ('a0000000-0000-0000-0000-000000000004',
   '00100000-0000-0000-0000-000000000001',
   'invoice_uploaded', 'New Invoice: INV-2026-0002',
   'A new invoice has been issued for your order WDS-20260101-0001.',
   false,
   '{"invoice_number":"INV-2026-0002","amount":115000}'::jsonb,
   now() - interval '6 days'),

  -- Client notifications (Nova Wear)
  ('a0000000-0000-0000-0000-000000000005',
   '00100000-0000-0000-0000-000000000004',
   'stage_change', 'Order WDS-20260115-0004 Delivered',
   'Great news! Your order has been delivered.',
   true,
   '{"from_stage":"shipping","to_stage":"delivered"}'::jsonb,
   now() - interval '4 days'),

  ('a0000000-0000-0000-0000-000000000005',
   '00100000-0000-0000-0000-000000000004',
   'invoice_uploaded', 'Invoice INV-2026-0001 Paid',
   'Your invoice INV-2026-0001 has been marked as paid. Thank you!',
   true,
   '{"invoice_number":"INV-2026-0001","amount":240000}'::jsonb,
   now() - interval '5 days'),

  ('a0000000-0000-0000-0000-000000000005',
   '00100000-0000-0000-0000-000000000005',
   'stage_change', 'Order WDS-20260120-0005 Updated',
   'Your order has moved to the cutting stage.',
   false,
   '{"from_stage":"not_started","to_stage":"cutting"}'::jsonb,
   now() - interval '3 days'),

  -- Team notifications (Sara)
  ('a0000000-0000-0000-0000-000000000002',
   '00100000-0000-0000-0000-000000000001',
   'note_added', 'New Note on WDS-20260101-0001',
   'Admin left a note on the Linen Blazer order.',
   true,
   '{}'::jsonb,
   now() - interval '10 days');

-- ─────────────────────────────────────────────
-- 16. CLIENT ARCHIVE FILES (delivered hoodie)
-- ─────────────────────────────────────────────
insert into public.client_archive_files (client_id, order_id, file_name, file_path, file_type, file_size, category, archived_at, archived_by, order_number, delivery_month)
values
  ('c1000000-0000-0000-0000-000000000002',
   '00100000-0000-0000-0000-000000000004',
   'Hoodie_TechPack_v1.pdf',
   '00100000-0000-0000-0000-000000000004/Hoodie_TP_v1.pdf',
   'application/pdf', 3800000, 'tech_pack',
   now() - interval '4 days',
   'a0000000-0000-0000-0000-000000000001',
   'WDS-20260115-0004', '2026-02'),

  ('c1000000-0000-0000-0000-000000000002',
   '00100000-0000-0000-0000-000000000004',
   'Hoodie_Delivered_PackingList.pdf',
   '00100000-0000-0000-0000-000000000004/packing_list.pdf',
   'application/pdf', 480000, 'shipping',
   now() - interval '4 days',
   'a0000000-0000-0000-0000-000000000001',
   'WDS-20260115-0004', '2026-02');

-- ─────────────────────────────────────────────
-- DONE
-- ─────────────────────────────────────────────
-- Summary of seeded data:
--  6 users  (1 admin, 2 team, 3 clients)
--  3 clients (Luxe Studio, Nova Wear, Urban Threads)
--  8 orders  (various stages, inc. 1 delivered, 2 samples)
--  8 order assignments
-- 17 stage history records
-- 13 order tasks
--  9 order notes
--  8 order files
-- 10 suppliers (all categories)
--  7 leads    (all statuses)
--  4 invoices (paid/partial/draft/overdue)
--  4 invoice items
--  7 notifications
--  2 archive files
