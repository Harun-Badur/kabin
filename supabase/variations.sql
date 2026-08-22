-- products.colors / products.sizes: varyasyon alanları (nullable jsonb).
-- Mevcut satırlara dokunmaz; değerler scripts/seed-variations.ts ile dolar.
--
--   supabase db query -f supabase/variations.sql
--   veya SQL editor'de çalıştır.

alter table public.products
  add column if not exists colors jsonb,
  add column if not exists sizes jsonb;
