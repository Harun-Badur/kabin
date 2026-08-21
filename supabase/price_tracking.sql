-- =============================================================================
-- Kabin — Fiyat takibi + Expo push altyapısı (MVP)
-- SQL Editor'e TAMAMINI yapıştırıp Run.
-- Önkoşul: schema_products.sql + schema.sql (users, liked_products) kurulu.
-- =============================================================================
-- Mimari not:
--   products.price            = katalog / liste fiyatı (fallback)
--   products.current_price    = canlı fiyat (ileride affiliate/resmi feed yazar)
--   products.previous_price   = bir önceki canlı fiyat (düşüş UI + alert)
--   liked_products.liked_price = beğeni anındaki fiyat (current_price ?? price)
-- products.id TEXT'tir; price_alerts.product_id UUID değil TEXT FK'dir.
-- =============================================================================

alter table public.products
  add column if not exists current_price numeric,
  add column if not exists previous_price numeric,
  add column if not exists last_price_checked_at timestamptz;

update public.products
set current_price = price
where current_price is null;

alter table public.liked_products
  add column if not exists target_price numeric,
  add column if not exists notify_on_price_drop boolean not null default true,
  add column if not exists liked_price numeric;

update public.liked_products as lp
set liked_price = coalesce(
  nullif(lp.product_snapshot ->> 'currentPrice', '')::numeric,
  nullif(lp.product_snapshot ->> 'price', '')::numeric,
  p.current_price,
  p.price
)
from public.products as p
where lp.product_id = p.id
  and lp.liked_price is null;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  expo_push_token text not null,
  device_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, expo_push_token)
);

create table if not exists public.price_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product_id text not null references public.products (id) on delete cascade,
  old_price numeric not null,
  new_price numeric not null,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id);

create index if not exists price_alerts_user_created_idx
  on public.price_alerts (user_id, created_at desc);

create index if not exists price_alerts_product_id_idx
  on public.price_alerts (product_id);

create or replace function public.set_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_push_tokens_updated_at on public.push_tokens;
create trigger trg_push_tokens_updated_at
before update on public.push_tokens
for each row
execute procedure public.set_push_tokens_updated_at();

alter table public.push_tokens enable row level security;
alter table public.price_alerts enable row level security;
alter table public.liked_products enable row level security;
alter table public.products enable row level security;

drop policy if exists products_select_anon on public.products;
create policy products_select_anon
on public.products
for select
to anon, authenticated
using (true);

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

drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own
on public.push_tokens
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists push_tokens_insert_own on public.push_tokens;
create policy push_tokens_insert_own
on public.push_tokens
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists push_tokens_update_own on public.push_tokens;
create policy push_tokens_update_own
on public.push_tokens
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own
on public.push_tokens
for delete
to authenticated
using (auth.uid() = user_id);

drop policy if exists price_alerts_select_own on public.price_alerts;
create policy price_alerts_select_own
on public.price_alerts
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists price_alerts_insert_own on public.price_alerts;
create policy price_alerts_insert_own
on public.price_alerts
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists price_alerts_update_own on public.price_alerts;
create policy price_alerts_update_own
on public.price_alerts
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists price_alerts_delete_own on public.price_alerts;
create policy price_alerts_delete_own
on public.price_alerts
for delete
to authenticated
using (auth.uid() = user_id);

grant select on public.products to anon, authenticated;
grant select, insert, update, delete on public.liked_products to authenticated;
grant select, insert, update, delete on public.push_tokens to authenticated;
grant select, insert, update, delete on public.price_alerts to authenticated;
grant all on public.push_tokens to service_role;
grant all on public.price_alerts to service_role;
