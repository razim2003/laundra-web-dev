-- Fixes Postgres error 42P17: infinite recursion detected in policy for relation "profiles".
-- Run once in Supabase SQL Editor.

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

drop policy if exists "profiles_read_own" on public.profiles;
create policy "profiles_read_own" on public.profiles
for select to authenticated
using (id = auth.uid() or public.requesting_profile_role() = 'admin');

drop policy if exists "riders_read" on public.riders;
create policy "riders_read" on public.riders
for select to authenticated
using (
  id = auth.uid()
  or public.requesting_profile_role() = 'admin'
);

drop policy if exists "riders_insert_self" on public.riders;
create policy "riders_insert_self" on public.riders
for insert to authenticated
with check (
  id = auth.uid()
  and public.requesting_profile_role() = 'rider'
);

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

drop policy if exists "bookings_insert_customer" on public.bookings;
create policy "bookings_insert_customer" on public.bookings
for insert to authenticated
with check (
  customer_id = auth.uid()
  and public.requesting_profile_role() in ('customer', 'admin')
);

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

drop policy if exists "payments_select" on public.payments;
create policy "payments_select" on public.payments
for select to authenticated
using (
  customer_id = auth.uid()
  or public.requesting_profile_role() = 'admin'
);
