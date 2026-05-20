-- Laundra production schema (Postgres + Supabase)
-- Apply in Supabase SQL Editor.

-- Extensions
create extension if not exists "pgcrypto";

-- =========
-- TYPES
-- =========
do $$ begin
  create type public.booking_status as enum (
    'booking_placed',
    'rider_assigned',
    'rider_arriving',
    'picked_up',
    'washing_started',
    'washing_completed',
    'ironing_started',
    'ironing_completed',
    'out_for_delivery',
    'delivered',
    'cancelled'
  );
exception when duplicate_object then null; end $$;

-- =========
-- PROFILES
-- =========
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','rider','admin')),
  full_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_role_idx on public.profiles(role);

-- =========
-- RIDERS
-- =========
create table if not exists public.riders (
  id uuid primary key references public.profiles(id) on delete cascade,
  city text,
  is_online boolean not null default false,
  rating numeric(3,2) not null default 5.00,
  vehicle_type text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========
-- SERVICE PACKAGES
-- =========
create table if not exists public.service_packages (
  id text primary key, -- basic | pro | luxury
  title text not null,
  description text not null,
  base_unit text not null check (base_unit in ('kg','item')),
  base_price_lkr integer not null,
  express_surcharge_lkr integer not null default 0,
  highlight_color text,
  created_at timestamptz not null default now()
);

insert into public.service_packages (id, title, description, base_unit, base_price_lkr, express_surcharge_lkr, highlight_color)
values
  ('basic', 'Basic', 'Wash & Fold · Standard', 'kg', 450, 0, 'blue'),
  ('pro', 'Pro', 'Wash + Iron · Express-ready', 'kg', 650, 1500, 'yellow'),
  ('luxury', 'Luxury', 'Dry Clean · Couture Care', 'item', 1250, 0, 'black')
on conflict (id) do nothing;

-- =========
-- BOOKINGS / ORDERS
-- =========
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  rider_id uuid references public.riders(id) on delete set null,
  package_id text not null references public.service_packages(id),

  service_type text not null check (service_type in ('wash','iron','dry_clean')),
  weight_kg integer,
  item_count integer,

  addons jsonb not null default '{}'::jsonb,
  pickup_address text not null,
  pickup_city text not null default 'Colombo',
  pickup_lat double precision,
  pickup_lng double precision,
  scheduled_date date not null,
  scheduled_window text not null,

  status public.booking_status not null default 'booking_placed',
  total_lkr integer not null,
  delivery_fee_lkr integer not null default 1000,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists bookings_customer_idx on public.bookings(customer_id, created_at desc);
create index if not exists bookings_rider_idx on public.bookings(rider_id, created_at desc);
create index if not exists bookings_status_idx on public.bookings(status, created_at desc);

-- =========
-- BOOKING EVENTS (timeline)
-- =========
create table if not exists public.booking_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  status public.booking_status not null,
  note text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists booking_events_booking_idx on public.booking_events(booking_id, created_at asc);

-- =========
-- TRACKING (rider location per booking)
-- =========
create table if not exists public.booking_tracking (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading_deg double precision,
  speed_mps double precision,
  created_at timestamptz not null default now()
);
create index if not exists booking_tracking_booking_idx on public.booking_tracking(booking_id, created_at desc);

-- =========
-- NOTIFICATIONS
-- =========
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- =========
-- PAYMENTS (placeholder)
-- =========
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.profiles(id) on delete restrict,
  amount_lkr integer not null,
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  provider text,
  method text not null default 'cash_on_delivery' check (method in ('cash_on_delivery','card')),
  invoice jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- =========
-- BUSINESS REVIEWS
-- =========
create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 8 and 400),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists business_reviews_public_idx on public.business_reviews(is_public, created_at desc);

-- =========
-- RIDER REVIEWS
-- =========
create table if not exists public.rider_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade unique,
  customer_id uuid not null references public.profiles(id) on delete cascade,
  rider_id uuid not null references public.riders(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text,
  created_at timestamptz not null default now()
);
create index if not exists rider_reviews_rider_idx on public.rider_reviews(rider_id, created_at desc);
create index if not exists rider_reviews_customer_idx on public.rider_reviews(customer_id, created_at desc);

-- =========
-- UPDATED_AT triggers
-- =========
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$ begin
  create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger riders_updated_at
  before update on public.riders
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

do $$ begin
  create trigger bookings_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();
exception when duplicate_object then null; end $$;

-- =========
-- AUTH HOOK: ensure profile exists
-- =========
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r text;
begin
  r := coalesce(nullif(trim(new.raw_user_meta_data->>'role'), ''), 'customer');
  if r not in ('customer', 'rider', 'admin') then
    r := 'customer';
  end if;

  insert into public.profiles (id, role, full_name)
  values (new.id, r, coalesce(new.raw_user_meta_data->>'full_name', null))
  on conflict (id) do nothing;

  if r = 'rider' then
    insert into public.riders (id)
    values (new.id)
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;

do $$ begin
  create trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();
exception when duplicate_object then null; end $$;

-- =========
-- RLS helpers (avoid querying profiles inside profiles policies → 42P17 recursion)
-- =========
create or replace function public.requesting_profile_role()
returns text
language sql
security definer
set search_path = public
stable
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

revoke all on function public.requesting_profile_role() from public;
grant execute on function public.requesting_profile_role() to authenticated;

-- =========
-- RLS
-- =========
alter table public.profiles enable row level security;
alter table public.riders enable row level security;
alter table public.service_packages enable row level security;
alter table public.bookings enable row level security;
alter table public.booking_events enable row level security;
alter table public.booking_tracking enable row level security;
alter table public.notifications enable row level security;
alter table public.payments enable row level security;
alter table public.business_reviews enable row level security;
alter table public.rider_reviews enable row level security;

-- PROFILES: users can read/update themselves; admins read all
drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
for select to authenticated
using (id = auth.uid() or public.requesting_profile_role() = 'admin');

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (id = auth.uid());

-- SERVICE PACKAGES: readable by everyone
drop policy if exists "packages_read_all" on public.service_packages;
create policy "packages_read_all" on public.service_packages
for select to anon, authenticated
using (true);

-- RIDERS: riders can read/update themselves; admins read all
drop policy if exists "riders_read" on public.riders;
create policy "riders_read" on public.riders
for select to authenticated
using (
  id = auth.uid()
  or public.requesting_profile_role() = 'admin'
);

drop policy if exists "riders_update_self" on public.riders;
create policy "riders_update_self" on public.riders
for update to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "riders_insert_self" on public.riders;
create policy "riders_insert_self" on public.riders
for insert to authenticated
with check (
  id = auth.uid()
  and public.requesting_profile_role() = 'rider'
);

-- BOOKINGS: customers see theirs; riders see assigned + unassigned (available); admins see all
drop policy if exists "bookings_select" on public.bookings;
create policy "bookings_select" on public.bookings
for select to authenticated
using (
  customer_id = auth.uid()
  or rider_id = auth.uid()
  or public.requesting_profile_role() = 'admin'
  or (
    public.requesting_profile_role() = 'rider'
    and rider_id is null
  )
);

-- BOOKINGS INSERT: acting as the customer (your own laundry). Any profile role may book for self.
drop policy if exists "bookings_insert_customer" on public.bookings;
create policy "bookings_insert_customer" on public.bookings
for insert to authenticated
with check (customer_id = auth.uid());

-- BOOKINGS UPDATE:
-- - customer can update only if still booking_placed (eg cancel)
-- - rider can claim unassigned + update assigned
-- - admin can update all
drop policy if exists "bookings_update" on public.bookings;
create policy "bookings_update" on public.bookings
for update to authenticated
using (
  public.requesting_profile_role() = 'admin'
  or (customer_id = auth.uid() and status = 'booking_placed')
  or (
    public.requesting_profile_role() = 'rider'
    and (rider_id = auth.uid() or rider_id is null)
  )
)
with check (
  public.requesting_profile_role() = 'admin'
  or (customer_id = auth.uid())
  or (
    public.requesting_profile_role() = 'rider'
    and rider_id = auth.uid()
  )
);

-- BOOKING EVENTS: select like bookings; insert by rider/admin/customer for their booking
drop policy if exists "events_select" on public.booking_events;
create policy "events_select" on public.booking_events
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (
        b.customer_id = auth.uid()
        or b.rider_id = auth.uid()
        or public.requesting_profile_role() = 'admin'
      )
  )
);

drop policy if exists "events_insert" on public.booking_events;
create policy "events_insert" on public.booking_events
for insert to authenticated
with check (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (
        b.customer_id = auth.uid()
        or b.rider_id = auth.uid()
        or public.requesting_profile_role() = 'admin'
      )
  )
);

-- TRACKING: customer can read their booking; rider can insert/read for assigned booking; admin can read all
drop policy if exists "tracking_select" on public.booking_tracking;
create policy "tracking_select" on public.booking_tracking
for select to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and (
        b.customer_id = auth.uid()
        or b.rider_id = auth.uid()
        or public.requesting_profile_role() = 'admin'
      )
  )
);

drop policy if exists "tracking_insert_rider" on public.booking_tracking;
create policy "tracking_insert_rider" on public.booking_tracking
for insert to authenticated
with check (
  rider_id = auth.uid()
  and exists (select 1 from public.bookings b where b.id = booking_id and b.rider_id = auth.uid())
);

-- NOTIFICATIONS: own only; admin can insert for any user via service key (server)
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications
for select to authenticated
using (user_id = auth.uid());

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications
for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- PAYMENTS: customer sees their payments; admin sees all
drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
for select to authenticated
using (
  customer_id = auth.uid()
  or public.requesting_profile_role() = 'admin'
);

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments
for insert to authenticated
with check (customer_id = auth.uid());

drop policy if exists "business_reviews_read_public" on public.business_reviews;
create policy "business_reviews_read_public" on public.business_reviews
for select to anon, authenticated
using (is_public = true or customer_id = auth.uid() or public.requesting_profile_role() = 'admin');

drop policy if exists "business_reviews_insert_own" on public.business_reviews;
create policy "business_reviews_insert_own" on public.business_reviews
for insert to authenticated
with check (customer_id = auth.uid());

drop policy if exists "rider_reviews_select_related" on public.rider_reviews;
create policy "rider_reviews_select_related" on public.rider_reviews
for select to authenticated
using (
  customer_id = auth.uid()
  or rider_id = auth.uid()
  or public.requesting_profile_role() = 'admin'
);

drop policy if exists "rider_reviews_insert_customer" on public.rider_reviews;
create policy "rider_reviews_insert_customer" on public.rider_reviews
for insert to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.bookings b
    where b.id = booking_id
      and b.customer_id = auth.uid()
      and b.rider_id = rider_reviews.rider_id
      and b.status = 'delivered'
  )
);

create or replace function public.refresh_rider_rating(target_rider uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.riders
  set rating = coalesce(
    (select round(avg(r.rating)::numeric, 2) from public.rider_reviews r where r.rider_id = target_rider),
    5.00
  )
  where id = target_rider;
$$;

create or replace function public.handle_rider_review_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.refresh_rider_rating(new.rider_id);
  return new;
end;
$$;

drop trigger if exists rider_reviews_refresh_rating on public.rider_reviews;
create trigger rider_reviews_refresh_rating
after insert or update on public.rider_reviews
for each row execute function public.handle_rider_review_rating();

-- Realtime: ensure these tables are added to publication in Supabase dashboard if needed.
