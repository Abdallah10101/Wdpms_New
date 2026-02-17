-- ============================================================
-- WDSP Production Management System — Full Schema
-- Run this in Supabase SQL Editor (schema only, no seed data)
-- ============================================================

-- ─────────────────────────────────────────────
-- 1. EXTENSIONS
-- ─────────────────────────────────────────────
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ─────────────────────────────────────────────
-- 2. ENUMS
-- ─────────────────────────────────────────────
do $$ begin
  create type app_role as enum ('admin', 'team', 'client');
exception when duplicate_object then null; end $$;

do $$ begin
  create type order_priority as enum ('low', 'medium', 'high', 'urgent');
exception when duplicate_object then null; end $$;

do $$ begin
  create type task_status as enum ('pending', 'in_progress', 'done', 'blocked');
exception when duplicate_object then null; end $$;

do $$ begin
  create type production_stage as enum (
    'not_started', 'sample', 'cutting', 'printing',
    'embroidery', 'sewing', 'wash_house', 'qc',
    'packaging', 'shipping', 'delivered'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum (
    'new', 'contacted', 'qualified', 'proposal',
    'negotiation', 'won', 'lost'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type supplier_category as enum (
    'fabric', 'printing', 'embroidery', 'sewing',
    'packaging', 'wash_house', 'accessories', 'labels', 'other'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type invoice_status as enum (
    'draft', 'sent', 'viewed', 'partially_paid', 'paid', 'overdue'
  );
exception when duplicate_object then null; end $$;

-- ─────────────────────────────────────────────
-- 3. SEQUENCES
-- ─────────────────────────────────────────────
create sequence if not exists order_number_seq start 1;
create sequence if not exists invoice_number_seq start 1;

-- ─────────────────────────────────────────────
-- 4. CORE TABLES
-- ─────────────────────────────────────────────

-- profiles
create table if not exists public.profiles (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid unique references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null,
  phone       text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_profiles_user_id on public.profiles(user_id);

-- user_roles
create table if not exists public.user_roles (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
create index if not exists idx_user_roles_user_id on public.user_roles(user_id);

-- clients
create table if not exists public.clients (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  brand_name      text,
  contact_person  text,
  contact_email   text,
  contact_phone   text,
  address         text,
  notes           text,
  logo_url        text,
  user_id         uuid references auth.users(id) on delete set null,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists idx_clients_user_id on public.clients(user_id);

-- orders
create table if not exists public.orders (
  id               uuid primary key default uuid_generate_v4(),
  order_number     text unique,
  product_name     text not null,
  client_id        uuid not null references public.clients(id) on delete cascade,
  collection       text,
  size             text,
  fabric           text,
  supplier         text,
  quantity         integer not null default 0,
  pieces_sent      integer,
  delivery_date    date,
  priority         order_priority not null default 'medium',
  current_stage    production_stage not null default 'not_started',
  stage_updated_at timestamptz,
  has_printing     boolean default false,
  has_embroidery   boolean default false,
  has_wash_house   boolean default false,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists idx_orders_client_id     on public.orders(client_id);
create index if not exists idx_orders_current_stage on public.orders(current_stage);
create index if not exists idx_orders_delivery_date on public.orders(delivery_date);

-- order_assignments
create table if not exists public.order_assignments (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  unique(order_id, user_id)
);
create index if not exists idx_order_assignments_order_id on public.order_assignments(order_id);
create index if not exists idx_order_assignments_user_id  on public.order_assignments(user_id);

-- order_tasks
create table if not exists public.order_tasks (
  id           uuid primary key default uuid_generate_v4(),
  order_id     uuid not null references public.orders(id) on delete cascade,
  title        text not null,
  description  text,
  assigned_to  uuid references auth.users(id) on delete set null,
  due_date     date,
  status       task_status not null default 'pending',
  sort_order   integer not null default 0,
  completed_at timestamptz,
  completed_by uuid references auth.users(id) on delete set null,
  created_by   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_order_tasks_order_id    on public.order_tasks(order_id);
create index if not exists idx_order_tasks_assigned_to on public.order_tasks(assigned_to);
create index if not exists idx_order_tasks_status      on public.order_tasks(status);

-- order_files
create table if not exists public.order_files (
  id                uuid primary key default uuid_generate_v4(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  file_name         text not null,
  file_path         text not null,
  file_type         text,
  file_size         integer,
  category          text check (category in ('tech_pack','design','photo','invoice','shipping','label','other','stage_image_cutting','stage_image_printing','stage_image_embroidery','stage_image_sewing','stage_image_wash_house')),
  is_client_visible boolean not null default false,
  uploaded_by       uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now()
);
create index if not exists idx_order_files_order_id on public.order_files(order_id);

-- order_notes
create table if not exists public.order_notes (
  id                uuid primary key default uuid_generate_v4(),
  order_id          uuid not null references public.orders(id) on delete cascade,
  content           text not null,
  is_client_visible boolean not null default false,
  author_id         uuid references auth.users(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index if not exists idx_order_notes_order_id on public.order_notes(order_id);

-- order_stage_history
create table if not exists public.order_stage_history (
  id          uuid primary key default uuid_generate_v4(),
  order_id    uuid not null references public.orders(id) on delete cascade,
  from_stage  production_stage,
  to_stage    production_stage not null,
  changed_by  uuid references auth.users(id) on delete set null,
  changed_at  timestamptz not null default now(),
  notes       text
);
create index if not exists idx_order_stage_history_order_id on public.order_stage_history(order_id);

-- leads
create table if not exists public.leads (
  id               uuid primary key default uuid_generate_v4(),
  company_name     text not null,
  contact_name     text,
  email            text,
  phone            text,
  brand_name       text,
  status           lead_status not null default 'new',
  source           text,
  notes            text,
  followers_range  text,
  next_follow_up   date,
  estimated_value  numeric(12,2),
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- suppliers
create table if not exists public.suppliers (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  contact_person  text,
  phone           text,
  email           text,
  address         text,
  category        supplier_category not null,
  specialty       text,
  notes           text,
  pricing_info    text,
  quality_rating  integer check (quality_rating between 1 and 5),
  is_active       boolean not null default true,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- invoices
create table if not exists public.invoices (
  id                      uuid primary key default uuid_generate_v4(),
  invoice_number          text unique,
  order_id                uuid references public.orders(id) on delete set null,
  client_id               uuid not null references public.clients(id) on delete cascade,
  status                  invoice_status not null default 'draft',
  order_name              text not null,
  quantity                integer not null default 0,
  fabric_cost             numeric(12,2) not null default 0,
  production_cost         numeric(12,2) not null default 0,
  accessories_cost        numeric(12,2) not null default 0,
  pattern_cost            numeric(12,2) not null default 0,
  setup_cost              numeric(12,2) not null default 0,
  embroidery_cost         numeric(12,2) not null default 0,
  printing_cost           numeric(12,2) not null default 0,
  digital_printing_cost   numeric(12,2) not null default 0,
  extra_fees              numeric(12,2) not null default 0,
  washing_cost            numeric(12,2) not null default 0,
  total_cost_per_piece    numeric(12,2) not null default 0,
  profit_per_piece        numeric(12,2) not null default 0,
  wholesale_price         numeric(12,2) not null default 0,
  retail_price            numeric(12,2) not null default 0,
  exchange_rate           numeric(10,4) not null default 1.0,
  accessories_detail      jsonb,
  amount_paid             numeric(12,2) not null default 0,
  due_date                date,
  subtotal                numeric(12,2) not null default 0,
  total                   numeric(12,2) not null default 0,
  terms_and_conditions    text,
  internal_notes          text,
  client_notes            text,
  sent_at                 timestamptz,
  viewed_at               timestamptz,
  paid_at                 timestamptz,
  created_by              uuid references auth.users(id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- invoice_items
create table if not exists public.invoice_items (
  id           uuid primary key default uuid_generate_v4(),
  invoice_id   uuid not null references public.invoices(id) on delete cascade,
  order_id     uuid references public.orders(id) on delete set null,
  product_name text not null,
  description  text,
  inclusions   text[],
  quantity     integer not null default 1,
  unit_price   numeric(12,2) not null default 0,
  amount       numeric(12,2) not null default 0,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);

-- notifications
create table if not exists public.notifications (
  id         uuid primary key default uuid_generate_v4(),
  user_id    uuid not null,
  order_id   uuid references public.orders(id) on delete cascade,
  type       text not null,
  title      text not null,
  message    text not null,
  is_read    boolean not null default false,
  metadata   jsonb default '{}',
  created_at timestamptz not null default now()
);
create index if not exists idx_notifications_user_id  on public.notifications(user_id);
create index if not exists idx_notifications_order_id on public.notifications(order_id);

-- client_archive_files
create table if not exists public.client_archive_files (
  id               uuid primary key default uuid_generate_v4(),
  client_id        uuid not null references public.clients(id) on delete cascade,
  order_id         uuid references public.orders(id) on delete set null,
  original_file_id uuid references public.order_files(id) on delete set null,
  file_name        text not null,
  file_path        text not null,
  file_type        text,
  file_size        integer,
  category         text,
  archived_at      timestamptz not null default now(),
  archived_by      uuid references auth.users(id) on delete set null,
  order_number     text,
  delivery_month   text
);
create index if not exists idx_client_archive_files_client_id      on public.client_archive_files(client_id);
create index if not exists idx_client_archive_files_delivery_month on public.client_archive_files(delivery_month);

-- ─────────────────────────────────────────────
-- 5. VIEWS
-- ─────────────────────────────────────────────
create or replace view public.profiles_public
  with (security_invoker = on)
as
  select id, user_id, full_name, avatar_url, created_at, updated_at
  from public.profiles;

-- ─────────────────────────────────────────────
-- 6. HELPER FUNCTIONS (SECURITY DEFINER)
-- ─────────────────────────────────────────────
create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role(auth.uid(), 'admin');
$$;

create or replace function public.is_team()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role(auth.uid(), 'team');
$$;

create or replace function public.is_client()
returns boolean
language sql stable security definer set search_path = public
as $$
  select public.has_role(auth.uid(), 'client');
$$;

create or replace function public.is_assigned_to_order(_order_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.order_assignments
    where order_id = _order_id and user_id = auth.uid()
  );
$$;

create or replace function public.is_client_of_order(_order_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.orders o
    join public.clients c on c.id = o.client_id
    where o.id = _order_id and c.user_id = auth.uid()
  );
$$;

create or replace function public.is_assigned_to_client(_client_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.order_assignments oa
    join public.orders o on o.id = oa.order_id
    where o.client_id = _client_id and oa.user_id = auth.uid()
  );
$$;

create or replace function public.is_assigned_to_profile(_profile_user_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.order_assignments oa
    join public.orders o on o.id = oa.order_id
    join public.clients c on c.id = o.client_id
    where c.user_id = _profile_user_id and oa.user_id = auth.uid()
  );
$$;

create or replace function public.get_user_role(_user_id uuid)
returns app_role
language sql stable security definer set search_path = public
as $$
  select role from public.user_roles where user_id = _user_id limit 1;
$$;

create or replace function public.can_access_order_files(_order_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select (
    public.is_admin()
    or public.is_assigned_to_order(_order_id)
    or public.is_client_of_order(_order_id)
  );
$$;

-- ─────────────────────────────────────────────
-- 7. TRIGGER FUNCTIONS
-- ─────────────────────────────────────────────

-- Generic updated_at updater
create or replace function public.handle_updated_at()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, full_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Auto-generate order number: WDS-YYYYMMDD-XXXX
create or replace function public.generate_order_number()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.order_number is null then
    new.order_number := 'WDS-' || to_char(now(), 'YYYYMMDD') || '-' || lpad(nextval('order_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

-- Auto-generate invoice number: INV-YYYY-XXXX
create or replace function public.generate_invoice_number()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.invoice_number is null then
    new.invoice_number := 'INV-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('invoice_number_seq')::text, 4, '0');
  end if;
  return new;
end;
$$;

-- Track order stage changes
create or replace function public.track_order_stage_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.current_stage is distinct from new.current_stage then
    insert into public.order_stage_history (order_id, from_stage, to_stage, changed_by, changed_at)
    values (new.id, old.current_stage, new.current_stage, auth.uid(), now());
    new.stage_updated_at := now();
  end if;
  return new;
end;
$$;

-- Notify client on stage change
create or replace function public.notify_client_on_stage_change()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  v_client_user_id uuid;
  v_order_number   text;
begin
  if old.current_stage is distinct from new.current_stage then
    select c.user_id, o.order_number
    into v_client_user_id, v_order_number
    from public.orders o
    join public.clients c on c.id = o.client_id
    where o.id = new.id;

    if v_client_user_id is not null then
      insert into public.notifications (user_id, order_id, type, title, message, metadata)
      values (
        v_client_user_id,
        new.id,
        'stage_change',
        'Order Updated: ' || v_order_number,
        'Your order has moved to the ' || replace(new.current_stage::text, '_', ' ') || ' stage.',
        jsonb_build_object('from_stage', old.current_stage, 'to_stage', new.current_stage)
      );
    end if;
  end if;
  return new;
end;
$$;

-- Archive files on delivery
create or replace function public.archive_files_on_delivery()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if old.current_stage <> 'delivered' and new.current_stage = 'delivered' then
    insert into public.client_archive_files
      (client_id, order_id, original_file_id, file_name, file_path, file_type, file_size, category, archived_by, order_number, delivery_month)
    select
      new.client_id,
      new.id,
      f.id,
      f.file_name,
      f.file_path,
      f.file_type,
      f.file_size,
      f.category,
      auth.uid(),
      new.order_number,
      to_char(now(), 'YYYY-MM')
    from public.order_files f
    where f.order_id = new.id;
  end if;
  return new;
end;
$$;

-- ─────────────────────────────────────────────
-- 8. ATTACH TRIGGERS
-- ─────────────────────────────────────────────
-- updated_at triggers
drop trigger if exists update_profiles_updated_at    on public.profiles;
create trigger update_profiles_updated_at    before update on public.profiles    for each row execute function public.handle_updated_at();

drop trigger if exists update_clients_updated_at     on public.clients;
create trigger update_clients_updated_at     before update on public.clients     for each row execute function public.handle_updated_at();

drop trigger if exists update_orders_updated_at      on public.orders;
create trigger update_orders_updated_at      before update on public.orders      for each row execute function public.handle_updated_at();

drop trigger if exists update_order_tasks_updated_at on public.order_tasks;
create trigger update_order_tasks_updated_at before update on public.order_tasks for each row execute function public.handle_updated_at();

drop trigger if exists update_order_notes_updated_at on public.order_notes;
create trigger update_order_notes_updated_at before update on public.order_notes for each row execute function public.handle_updated_at();

drop trigger if exists update_suppliers_updated_at   on public.suppliers;
create trigger update_suppliers_updated_at   before update on public.suppliers   for each row execute function public.handle_updated_at();

drop trigger if exists update_leads_updated_at       on public.leads;
create trigger update_leads_updated_at       before update on public.leads       for each row execute function public.handle_updated_at();

drop trigger if exists update_invoices_updated_at    on public.invoices;
create trigger update_invoices_updated_at    before update on public.invoices    for each row execute function public.handle_updated_at();

-- new user trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- order number trigger
drop trigger if exists generate_order_number_trigger on public.orders;
create trigger generate_order_number_trigger before insert on public.orders for each row execute function public.generate_order_number();

-- invoice number trigger
drop trigger if exists generate_invoice_number_trigger on public.invoices;
create trigger generate_invoice_number_trigger before insert on public.invoices for each row execute function public.generate_invoice_number();

-- stage change triggers
drop trigger if exists track_order_stage_change_trigger  on public.orders;
create trigger track_order_stage_change_trigger  after update on public.orders for each row execute function public.track_order_stage_change();

drop trigger if exists notify_client_stage_change_trigger on public.orders;
create trigger notify_client_stage_change_trigger after update on public.orders for each row execute function public.notify_client_on_stage_change();

drop trigger if exists archive_files_on_delivery_trigger on public.orders;
create trigger archive_files_on_delivery_trigger after update on public.orders for each row execute function public.archive_files_on_delivery();

-- ─────────────────────────────────────────────
-- 9. ENABLE REALTIME
-- ─────────────────────────────────────────────
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.order_stage_history;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.invoices;

-- ─────────────────────────────────────────────
-- 10. STORAGE BUCKETS
-- ─────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('order-files', 'order-files', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- 11. ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
alter table public.profiles             enable row level security;
alter table public.user_roles           enable row level security;
alter table public.clients              enable row level security;
alter table public.orders               enable row level security;
alter table public.order_assignments    enable row level security;
alter table public.order_tasks          enable row level security;
alter table public.order_files          enable row level security;
alter table public.order_notes          enable row level security;
alter table public.order_stage_history  enable row level security;
alter table public.leads                enable row level security;
alter table public.suppliers            enable row level security;
alter table public.invoices             enable row level security;
alter table public.invoice_items        enable row level security;
alter table public.notifications        enable row level security;
alter table public.client_archive_files enable row level security;

-- profiles
create policy "admin_all_profiles"        on public.profiles for all    using (public.is_admin());
create policy "own_profile_read"          on public.profiles for select using (user_id = auth.uid());
create policy "own_profile_update"        on public.profiles for update using (user_id = auth.uid());
create policy "team_view_assigned_profiles" on public.profiles for select using (public.is_team() and public.is_assigned_to_profile(user_id));

-- user_roles
create policy "admin_all_roles"  on public.user_roles for all    using (public.is_admin());
create policy "own_roles_read"   on public.user_roles for select using (user_id = auth.uid());

-- clients
create policy "admin_all_clients" on public.clients for all    using (public.is_admin());
create policy "team_view_assigned_clients" on public.clients for select using (public.is_team() and public.is_assigned_to_client(id));
create policy "client_view_own"   on public.clients for select using (public.is_client() and user_id = auth.uid());

-- orders
create policy "admin_all_orders"    on public.orders for all    using (public.is_admin());
create policy "team_view_assigned"  on public.orders for select using (public.is_team() and public.is_assigned_to_order(id));
create policy "team_update_assigned" on public.orders for update using (public.is_team() and public.is_assigned_to_order(id));
create policy "client_view_own"     on public.orders for select using (public.is_client() and public.is_client_of_order(id));

-- order_assignments
create policy "admin_all_oa"        on public.order_assignments for all    using (public.is_admin());
create policy "team_view_own_oa"    on public.order_assignments for select using (public.is_team() and user_id = auth.uid());

-- order_tasks
create policy "admin_all_tasks"     on public.order_tasks for all    using (public.is_admin());
create policy "team_view_tasks"     on public.order_tasks for select using (public.is_team() and public.is_assigned_to_order(order_id));
create policy "team_manage_tasks"   on public.order_tasks for update using (public.is_team() and public.is_assigned_to_order(order_id));
create policy "client_view_tasks"   on public.order_tasks for select using (public.is_client() and public.is_client_of_order(order_id));

-- order_files
create policy "admin_all_files"     on public.order_files for all    using (public.is_admin());
create policy "team_manage_files"   on public.order_files for all    using (public.is_team() and public.is_assigned_to_order(order_id));
create policy "client_view_files"   on public.order_files for select using (public.is_client() and public.is_client_of_order(order_id) and is_client_visible = true);

-- order_notes
create policy "admin_all_notes"     on public.order_notes for all    using (public.is_admin());
create policy "team_manage_notes"   on public.order_notes for all    using (public.is_team() and public.is_assigned_to_order(order_id));
create policy "client_view_notes"   on public.order_notes for select using (public.is_client() and public.is_client_of_order(order_id) and is_client_visible = true);

-- order_stage_history
create policy "admin_all_history"   on public.order_stage_history for all    using (public.is_admin());
create policy "team_view_history"   on public.order_stage_history for select using (public.is_team() and public.is_assigned_to_order(order_id));
create policy "client_view_history" on public.order_stage_history for select using (public.is_client() and public.is_client_of_order(order_id));

-- leads
create policy "admin_all_leads"     on public.leads for all    using (public.is_admin());
create policy "team_view_leads"     on public.leads for select using (public.is_team());
create policy "team_manage_leads"   on public.leads for all    using (public.is_team());

-- suppliers
create policy "admin_all_suppliers" on public.suppliers for all    using (public.is_admin());
create policy "team_view_suppliers" on public.suppliers for select using (public.is_team());

-- invoices
create policy "admin_all_invoices"  on public.invoices for all    using (public.is_admin());
create policy "team_view_invoices"  on public.invoices for select using (public.is_team() and public.is_assigned_to_client(client_id));
create policy "client_view_invoices" on public.invoices for select using (public.is_client() and exists (select 1 from public.clients where id = client_id and user_id = auth.uid()));

-- invoice_items
create policy "admin_all_ii"        on public.invoice_items for all    using (public.is_admin());
create policy "team_view_ii"        on public.invoice_items for select using (public.is_team());
create policy "client_view_ii"      on public.invoice_items for select using (public.is_client() and exists (
  select 1 from public.invoices i join public.clients c on c.id = i.client_id
  where i.id = invoice_id and c.user_id = auth.uid()
));

-- notifications
create policy "own_notifications"   on public.notifications for all    using (user_id = auth.uid());

-- client_archive_files
create policy "admin_all_archives"  on public.client_archive_files for all    using (public.is_admin());
create policy "team_view_archives"  on public.client_archive_files for select using (public.is_team() and public.is_assigned_to_client(client_id));
create policy "client_view_archives" on public.client_archive_files for select using (public.is_client() and exists (select 1 from public.clients where id = client_id and user_id = auth.uid()));

-- ─────────────────────────────────────────────
-- 12. STORAGE POLICIES
-- ─────────────────────────────────────────────

-- order-files bucket (private, role-based)
create policy "admin_order_files_all"
  on storage.objects for all
  using (bucket_id = 'order-files' and public.is_admin());

create policy "team_order_files_access"
  on storage.objects for all
  using (
    bucket_id = 'order-files'
    and public.is_team()
    and public.can_access_order_files((storage.foldername(name))[1]::uuid)
  );

create policy "client_order_files_read"
  on storage.objects for select
  using (
    bucket_id = 'order-files'
    and public.is_client()
    and public.can_access_order_files((storage.foldername(name))[1]::uuid)
  );

-- client-logos bucket (public read)
create policy "public_client_logos_read"
  on storage.objects for select
  using (bucket_id = 'client-logos');

create policy "admin_client_logos_all"
  on storage.objects for all
  using (bucket_id = 'client-logos' and public.is_admin());
