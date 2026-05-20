-- Adds checkout payment metadata and public business reviews.

alter table public.payments
  add column if not exists method text not null default 'cash_on_delivery'
    check (method in ('cash_on_delivery', 'card')),
  add column if not exists invoice jsonb not null default '{}'::jsonb;

drop policy if exists "payments_insert_own" on public.payments;
create policy "payments_insert_own" on public.payments
for insert to authenticated
with check (customer_id = auth.uid());

create table if not exists public.business_reviews (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.profiles(id) on delete set null,
  customer_name text not null,
  rating integer not null check (rating between 1 and 5),
  comment text not null check (char_length(trim(comment)) between 8 and 400),
  is_public boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists business_reviews_public_idx
  on public.business_reviews(is_public, created_at desc);

alter table public.business_reviews enable row level security;

drop policy if exists "business_reviews_read_public" on public.business_reviews;
create policy "business_reviews_read_public" on public.business_reviews
for select to anon, authenticated
using (is_public = true or customer_id = auth.uid() or public.requesting_profile_role() = 'admin');

drop policy if exists "business_reviews_insert_own" on public.business_reviews;
create policy "business_reviews_insert_own" on public.business_reviews
for insert to authenticated
with check (customer_id = auth.uid());
