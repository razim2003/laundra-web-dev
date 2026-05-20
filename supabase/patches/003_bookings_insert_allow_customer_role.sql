-- Allow any authenticated user to place a booking as themselves (customer_id = auth.uid()).
-- Previously inserts required profiles.role in ('customer','admin'), which blocked riders who book laundry for themselves.

drop policy if exists "bookings_insert_customer" on public.bookings;

create policy "bookings_insert_customer" on public.bookings
for insert to authenticated
with check (customer_id = auth.uid());
