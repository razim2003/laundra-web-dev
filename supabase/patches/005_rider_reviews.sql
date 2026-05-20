-- Lets customers rate riders after delivered bookings and exposes rider averages.

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

alter table public.rider_reviews enable row level security;

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
