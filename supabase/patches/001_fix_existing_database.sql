-- Run once in Supabase SQL Editor if you already applied an older `schema.sql`
-- (new installs only need the updated `schema.sql`).

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

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
for insert to authenticated
with check (id = auth.uid());

drop policy if exists "riders_insert_self" on public.riders;
create policy "riders_insert_self" on public.riders
for insert to authenticated
with check (
  id = auth.uid()
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'rider')
);

drop policy if exists "bookings_insert_customer" on public.bookings;
create policy "bookings_insert_customer" on public.bookings
for insert to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('customer', 'admin')
  )
);
