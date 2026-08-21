-- =============================================================================
-- Kabin — Auth + kalıcı beğeniler / geçmeler
-- Supabase Dashboard > SQL Editor içine TAMAMINI yapıştırıp Run.
-- Önkoşul: public.products (schema_products.sql) zaten kurulu olsun.
-- Authentication > Providers > Email açık olmalı.
-- =============================================================================
-- Not: products.id TEXT'tir (ör. trendyol-670154023). Bu yüzden
-- liked/passed.product_id UUID değil TEXT'tir. Satır PK'leri UUID'dir.
-- =============================================================================

create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.liked_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id text not null,
  product_snapshot jsonb not null,
  liked_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create table if not exists public.passed_products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  product_id text not null,
  passed_at timestamptz not null default now(),
  unique (user_id, product_id)
);

create index if not exists liked_products_user_liked_at_idx
  on public.liked_products (user_id, liked_at desc);

create index if not exists passed_products_user_passed_at_idx
  on public.passed_products (user_id, passed_at desc);

-- Yeni kayıt → public.users satırı (RLS'i aşmak için security definer)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute procedure public.handle_new_user();

alter table public.users enable row level security;
alter table public.liked_products enable row level security;
alter table public.passed_products enable row level security;

drop policy if exists users_select_own on public.users;
create policy users_select_own
on public.users
for select
to authenticated
using (auth.uid() = id);

drop policy if exists users_insert_own on public.users;
create policy users_insert_own
on public.users
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists users_update_own on public.users;
create policy users_update_own
on public.users
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists liked_products_select_own on public.liked_products;
create policy liked_products_select_own
on public.liked_products
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists liked_products_insert_own on public.liked_products;
create policy liked_products_insert_own
on public.liked_products
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists liked_products_update_own on public.liked_products;
create policy liked_products_update_own
on public.liked_products
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists liked_products_delete_own on public.liked_products;
create policy liked_products_delete_own
on public.liked_products
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists passed_products_select_own on public.passed_products;
create policy passed_products_select_own
on public.passed_products
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists passed_products_insert_own on public.passed_products;
create policy passed_products_insert_own
on public.passed_products
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists passed_products_update_own on public.passed_products;
create policy passed_products_update_own
on public.passed_products
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists passed_products_delete_own on public.passed_products;
create policy passed_products_delete_own
on public.passed_products
for delete
to authenticated
using (auth.uid() = user_id);

grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.liked_products to authenticated;
grant select, insert, update, delete on public.passed_products to authenticated;
