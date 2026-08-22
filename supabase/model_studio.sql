-- =============================================================================
-- Kabin — Modelim & Beden Stüdyosu
-- Supabase Dashboard > SQL Editor içine TAMAMINI yapıştırıp Run.
-- Önkoşul: schema.sql (auth.users mevcut).
-- Mevcut satırları silmez; kolonlar yoksa ekler.
-- =============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  height_cm integer,
  weight_kg integer,
  top_size text,
  bottom_size text,
  style_tags jsonb not null default '[]'::jsonb,
  model_photo_path text,
  updated_at timestamptz not null default now()
);

alter table public.profiles
  add column if not exists height_cm integer,
  add column if not exists weight_kg integer,
  add column if not exists top_size text,
  add column if not exists bottom_size text,
  add column if not exists style_tags jsonb,
  add column if not exists model_photo_path text,
  add column if not exists updated_at timestamptz;

update public.profiles
set style_tags = '[]'::jsonb
where style_tags is null;

alter table public.profiles
  alter column style_tags set default '[]'::jsonb;

alter table public.profiles enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (auth.uid() = id);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists profiles_delete_own on public.profiles;
create policy profiles_delete_own
on public.profiles
for delete
to authenticated
using (auth.uid() = id);

grant select, insert, update, delete on public.profiles to authenticated;

create or replace function public.handle_new_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute procedure public.handle_new_profile();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'model-photos',
  'model-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists model_photos_select_own on storage.objects;
create policy model_photos_select_own
on storage.objects
for select
to authenticated
using (
  bucket_id = 'model-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists model_photos_insert_own on storage.objects;
create policy model_photos_insert_own
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'model-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists model_photos_update_own on storage.objects;
create policy model_photos_update_own
on storage.objects
for update
to authenticated
using (
  bucket_id = 'model-photos'
  and split_part(name, '/', 1) = auth.uid()::text
)
with check (
  bucket_id = 'model-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);

drop policy if exists model_photos_delete_own on storage.objects;
create policy model_photos_delete_own
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'model-photos'
  and split_part(name, '/', 1) = auth.uid()::text
);
