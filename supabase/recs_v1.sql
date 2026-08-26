-- =============================================================================
-- VITRIVIA Recs V1 — P0-A Data Foundation
-- Supabase Dashboard > SQL Editor içine TAMAMINI yapıştırıp Run.
--
-- Önkoşul:
--   1. supabase/schema_products.sql  (public.products)
--   2. supabase/schema.sql           (auth.users)
--   3. supabase/model_studio.sql     (public.profiles.style_tags; yoksa
--      style_tag_weights boş kalır, RPC yine çalışır)
--
-- IDEMPOTENT: IF NOT EXISTS / OR REPLACE / DROP POLICY IF EXISTS.
-- Seed satırları ON CONFLICT DO NOTHING — canlıde ayarlanmış value ezilmez.
--
-- Ağırlıklar V1 HYPOTHESIS'tir; tek kaynak recs_config (TypeScript'e kopyalama).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. user_events
-- -----------------------------------------------------------------------------

create table if not exists public.user_events (
  event_id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id uuid not null,
  event_type text not null,
  product_id text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint user_events_type_nonempty check (char_length(trim(event_type)) > 0)
);

create index if not exists user_events_user_created_idx
  on public.user_events (user_id, created_at desc);

create index if not exists user_events_product_type_idx
  on public.user_events (product_id, event_type)
  where product_id is not null;

alter table public.user_events enable row level security;

drop policy if exists user_events_select_own on public.user_events;
create policy user_events_select_own
on public.user_events
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists user_events_insert_own on public.user_events;
create policy user_events_insert_own
on public.user_events
for insert
to authenticated
with check (auth.uid() = user_id);

revoke all on public.user_events from anon;
grant select, insert on public.user_events to authenticated;
grant all on public.user_events to service_role;

-- -----------------------------------------------------------------------------
-- 2. recs_config
-- -----------------------------------------------------------------------------

create table if not exists public.recs_config (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create or replace function public.set_recs_config_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_recs_config_updated_at on public.recs_config;
create trigger trg_recs_config_updated_at
before update on public.recs_config
for each row
execute procedure public.set_recs_config_updated_at();

alter table public.recs_config enable row level security;

drop policy if exists recs_config_select_public on public.recs_config;
create policy recs_config_select_public
on public.recs_config
for select
to anon, authenticated
using (true);

-- Write policy yok: authenticated/anon yazamaz. service_role RLS'i baypas eder.

revoke all on public.recs_config from anon, authenticated;
grant select on public.recs_config to anon, authenticated;
grant all on public.recs_config to service_role;

insert into public.recs_config (key, value)
values
  (
    'event_weights',
    '{
      "impression": 0.05,
      "like": 1,
      "dolap_add": 1.2,
      "share": 1.5,
      "try_on_start": 1.5,
      "try_on_success": 2,
      "store_click": 3,
      "pass": -0.8,
      "dolap_remove": -1
    }'::jsonb
  ),
  (
    'scoring_weights',
    '{
      "category_match": 10,
      "style_match": 8,
      "color_match": 6,
      "brand_match": 5,
      "fit_match": 6,
      "price_match": 4,
      "negative_signal": 8,
      "novelty": 3,
      "freshness": 2,
      "context": 9
    }'::jsonb
  ),
  (
    'diversity_mix',
    '{
      "preferred": 0.45,
      "similar": 0.22,
      "complementary": 0.18,
      "discovery": 0.15
    }'::jsonb
  ),
  (
    'decay_half_lives',
    '{
      "long_term": "30 days",
      "passed": "12 hours",
      "session": "10 minutes"
    }'::jsonb
  ),
  (
    'reasons_thresholds',
    '{
      "brand_match": 0.35,
      "category_match": 0.30,
      "style_match": 0.30,
      "color_match": 0.25,
      "fit_match": 0.25,
      "price_match": 0.20,
      "complementary": 0.40,
      "min_score_for_sana_uygun": 0.55
    }'::jsonb
  )
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 3. style_tag_priors
-- -----------------------------------------------------------------------------

create table if not exists public.style_tag_priors (
  tag text primary key,
  subcategory_w jsonb not null default '{}'::jsonb,
  fit_w jsonb not null default '{}'::jsonb,
  color_w jsonb not null default '{}'::jsonb
);

alter table public.style_tag_priors enable row level security;

drop policy if exists style_tag_priors_select_public on public.style_tag_priors;
create policy style_tag_priors_select_public
on public.style_tag_priors
for select
to anon, authenticated
using (true);

revoke all on public.style_tag_priors from anon, authenticated;
grant select on public.style_tag_priors to anon, authenticated;
grant all on public.style_tag_priors to service_role;

insert into public.style_tag_priors (tag, subcategory_w, fit_w, color_w)
values
  (
    'minimal',
    '{"tisort": 0.8, "gomlek": 0.9, "pantolon": 0.7, "elbise": 0.6, "ceket": 0.5}'::jsonb,
    '{"regular": 0.8, "slim": 0.7, "oversized": 0.2, "relaxed": 0.3}'::jsonb,
    '{"siyah": 0.7, "beyaz": 0.9, "bej": 0.8, "gri": 0.7, "navy": 0.8}'::jsonb
  ),
  (
    'street',
    '{"tisort": 0.7, "hoodie": 0.9, "jean": 0.8, "kargo": 0.8, "sweatshirt": 0.7}'::jsonb,
    '{"oversized": 0.9, "relaxed": 0.8, "regular": 0.4, "slim": 0.2}'::jsonb,
    '{"siyah": 0.9, "beyaz": 0.5, "gri": 0.7, "kirmizi": 0.4}'::jsonb
  ),
  (
    'classic',
    '{"gomlek": 0.9, "ceket": 0.85, "blazer": 0.9, "pantolon": 0.8, "elbise": 0.7}'::jsonb,
    '{"regular": 0.9, "slim": 0.8, "relaxed": 0.3, "oversized": 0.15}'::jsonb,
    '{"navy": 0.9, "bej": 0.8, "beyaz": 0.8, "camel": 0.7, "siyah": 0.5}'::jsonb
  ),
  (
    'sport',
    '{"tisort": 0.8, "sweatshirt": 0.85, "esofman": 0.9, "sort": 0.7, "hoodie": 0.6}'::jsonb,
    '{"regular": 0.7, "relaxed": 0.8, "slim": 0.3, "oversized": 0.4}'::jsonb,
    '{"siyah": 0.7, "gri": 0.8, "navy": 0.6, "beyaz": 0.5}'::jsonb
  )
on conflict (tag) do nothing;

-- -----------------------------------------------------------------------------
-- 4. product_attributes
-- -----------------------------------------------------------------------------

create table if not exists public.product_attributes (
  product_id text primary key references public.products (id) on delete cascade,
  gender text,
  colors text[] not null default '{}'::text[],
  fit text,
  subcategory text,
  brand_slug text,
  price_band text,
  material text,
  season text,
  occasion text,
  style_tags text[],
  constraint product_attributes_gender_check
    check (gender is null or gender in ('women', 'men', 'unisex'))
);

alter table public.product_attributes
  add column if not exists gender text,
  add column if not exists colors text[],
  add column if not exists fit text,
  add column if not exists subcategory text,
  add column if not exists brand_slug text,
  add column if not exists price_band text,
  add column if not exists material text,
  add column if not exists season text,
  add column if not exists occasion text,
  add column if not exists style_tags text[];

alter table public.product_attributes enable row level security;

drop policy if exists product_attributes_select_public on public.product_attributes;
create policy product_attributes_select_public
on public.product_attributes
for select
to anon, authenticated
using (true);

revoke all on public.product_attributes from anon, authenticated;
grant select on public.product_attributes to anon, authenticated;
grant all on public.product_attributes to service_role;

-- -----------------------------------------------------------------------------
-- 5. user_style_profiles (recompute_profile hedefi)
-- -----------------------------------------------------------------------------

create table if not exists public.user_style_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  color_w jsonb not null default '{}'::jsonb,
  subcategory_w jsonb not null default '{}'::jsonb,
  brand_w jsonb not null default '{}'::jsonb,
  fit_w jsonb not null default '{}'::jsonb,
  price_band_w jsonb not null default '{}'::jsonb,
  negative_preferences jsonb not null default '[]'::jsonb,
  style_tag_weights jsonb not null default '{}'::jsonb,
  event_count integer not null default 0,
  last_event_at timestamptz,
  computed_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_style_profiles
  add column if not exists color_w jsonb,
  add column if not exists subcategory_w jsonb,
  add column if not exists brand_w jsonb,
  add column if not exists fit_w jsonb,
  add column if not exists price_band_w jsonb,
  add column if not exists negative_preferences jsonb,
  add column if not exists style_tag_weights jsonb,
  add column if not exists event_count integer,
  add column if not exists last_event_at timestamptz,
  add column if not exists computed_at timestamptz,
  add column if not exists updated_at timestamptz;

alter table public.user_style_profiles enable row level security;

drop policy if exists user_style_profiles_select_own on public.user_style_profiles;
create policy user_style_profiles_select_own
on public.user_style_profiles
for select
to authenticated
using (auth.uid() = user_id);

-- Insert/update policy yok: yazma yalnızca security definer RPC.

revoke all on public.user_style_profiles from anon;
grant select on public.user_style_profiles to authenticated;
grant all on public.user_style_profiles to service_role;

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------

create or replace function public.recs_config_value(p_key text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_value jsonb;
begin
  select c.value into v_value
  from public.recs_config as c
  where c.key = p_key;

  if v_value is null then
    raise exception 'recs_config key eksik: %', p_key
      using errcode = 'P0002';
  end if;

  return v_value;
end;
$$;

revoke all on function public.recs_config_value(text) from public, anon, authenticated;
grant execute on function public.recs_config_value(text) to service_role;

create or replace function public.recs_accum_weight(
  p_map jsonb,
  p_key text,
  p_delta numeric
)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_key text;
  v_current numeric;
begin
  if p_map is null then
    p_map := '{}'::jsonb;
  end if;
  if p_key is null or btrim(p_key) = '' or p_delta = 0 then
    return p_map;
  end if;

  v_key := lower(btrim(p_key));
  v_current := coalesce((p_map ->> v_key)::numeric, 0) + p_delta;
  return jsonb_set(p_map, array[v_key], to_jsonb(v_current), true);
end;
$$;

create or replace function public.recs_normalize_weights(p_weights jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_max numeric := 0;
  v_key text;
  v_val numeric;
  v_out jsonb := '{}'::jsonb;
begin
  if p_weights is null or p_weights = '{}'::jsonb then
    return '{}'::jsonb;
  end if;

  for v_key, v_val in
    select e.key, (e.value #>> '{}')::numeric
    from jsonb_each(p_weights) as e
  loop
    if v_val > v_max then
      v_max := v_val;
    end if;
  end loop;

  if v_max <= 0 then
    return '{}'::jsonb;
  end if;

  for v_key, v_val in
    select e.key, (e.value #>> '{}')::numeric
    from jsonb_each(p_weights) as e
  loop
    if v_val > 0 then
      v_out := v_out || jsonb_build_object(v_key, round(v_val / v_max, 6));
    end if;
  end loop;

  return v_out;
end;
$$;

create or replace function public.recs_payload_colors(p_payload jsonb)
returns text[]
language plpgsql
immutable
as $$
declare
  v_colors text[];
  v_single text;
begin
  if p_payload is null then
    return '{}'::text[];
  end if;

  if jsonb_typeof(p_payload -> 'colors') = 'array' then
    select coalesce(array_agg(btrim(x)), '{}'::text[])
    into v_colors
    from jsonb_array_elements_text(p_payload -> 'colors') as x
    where btrim(x) <> '';
    return coalesce(v_colors, '{}'::text[]);
  end if;

  v_single := nullif(btrim(coalesce(p_payload ->> 'color', '')), '');
  if v_single is not null then
    return array[v_single];
  end if;

  return '{}'::text[];
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. recompute_profile
--    Ağırlık ve half-life yalnız recs_config'dan okunur (TS sabiti yok).
--    Aynı event kümesi + aynı config + aynı an → aynı maps (random yok).
--    Recency now()'a bağlıdır; zaman geçince skorlar bilinçli olarak yaşlanır.
-- -----------------------------------------------------------------------------

create or replace function public.recompute_profile(p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_weights jsonb;
  v_decay jsonb;
  v_half_life interval;
  v_half_life_sec numeric;
  v_age_sec numeric;
  v_decay_factor numeric;
  v_delta numeric;
  v_type_weight numeric;
  v_event record;
  v_color_w jsonb := '{}'::jsonb;
  v_subcategory_w jsonb := '{}'::jsonb;
  v_brand_w jsonb := '{}'::jsonb;
  v_fit_w jsonb := '{}'::jsonb;
  v_price_band_w jsonb := '{}'::jsonb;
  v_neg jsonb := '[]'::jsonb;
  v_style jsonb := '{}'::jsonb;
  v_tags jsonb;
  v_tag text;
  v_colors text[];
  v_color text;
  v_color_delta numeric;
  v_subcategory text;
  v_brand text;
  v_fit text;
  v_price_band text;
  v_event_count integer := 0;
  v_last_event_at timestamptz;
  v_attr_n integer;
begin
  if p_user_id is null then
    raise exception 'recompute_profile: user_id zorunlu'
      using errcode = '22023';
  end if;

  if auth.uid() is not null and auth.uid() <> p_user_id then
    raise exception 'recompute_profile: yalnızca kendi profilin'
      using errcode = '42501';
  end if;

  v_weights := public.recs_config_value('event_weights');
  v_decay := public.recs_config_value('decay_half_lives');
  v_half_life := (v_decay ->> 'long_term')::interval;
  v_half_life_sec := greatest(extract(epoch from v_half_life), 1);

  for v_event in
    select
      e.event_id,
      e.event_type,
      e.product_id,
      e.payload,
      e.created_at,
      a.colors as attr_colors,
      a.subcategory as attr_subcategory,
      a.brand_slug as attr_brand_slug,
      a.fit as attr_fit,
      a.price_band as attr_price_band
    from public.user_events as e
    left join public.product_attributes as a
      on a.product_id = e.product_id
    where e.user_id = p_user_id
      and v_weights ? e.event_type
      and abs(coalesce((v_weights ->> e.event_type)::numeric, 0)) >= 0.5
    order by e.created_at desc, e.event_id desc
    limit 1000
  loop
    v_event_count := v_event_count + 1;
    if v_last_event_at is null then
      v_last_event_at := v_event.created_at;
    end if;

    v_type_weight := (v_weights ->> v_event.event_type)::numeric;
    v_age_sec := greatest(
      extract(epoch from (now() - v_event.created_at)),
      0
    );
    v_decay_factor := power(0.5, v_age_sec / v_half_life_sec);
    v_delta := v_type_weight * v_decay_factor;

    v_colors := coalesce(
      nullif(v_event.attr_colors, '{}'::text[]),
      public.recs_payload_colors(v_event.payload)
    );
    v_subcategory := nullif(
      btrim(coalesce(
        v_event.attr_subcategory,
        v_event.payload ->> 'subcategory',
        ''
      )),
      ''
    );
    v_brand := nullif(
      btrim(coalesce(
        v_event.attr_brand_slug,
        v_event.payload ->> 'brand_slug',
        v_event.payload ->> 'brand',
        ''
      )),
      ''
    );
    v_fit := nullif(
      btrim(coalesce(
        v_event.attr_fit,
        v_event.payload ->> 'fit',
        ''
      )),
      ''
    );
    v_price_band := nullif(
      btrim(coalesce(
        v_event.attr_price_band,
        v_event.payload ->> 'price_band',
        ''
      )),
      ''
    );

    if v_event.event_type = 'pass' then
      v_neg := v_neg || jsonb_build_array(
        jsonb_build_object(
          'product_id', v_event.product_id,
          'at', v_event.created_at,
          'colors', to_jsonb(coalesce(v_colors, '{}'::text[])),
          'subcategory', to_jsonb(v_subcategory),
          'fit', to_jsonb(v_fit),
          'brand_slug', to_jsonb(v_brand),
          'price_band', to_jsonb(v_price_band)
        )
      );
      continue;
    end if;

    v_attr_n := coalesce(cardinality(v_colors), 0);
    if v_attr_n > 0 then
      v_color_delta := v_delta / v_attr_n;
      foreach v_color in array v_colors
      loop
        v_color_w := public.recs_accum_weight(v_color_w, v_color, v_color_delta);
      end loop;
    end if;

    v_subcategory_w := public.recs_accum_weight(
      v_subcategory_w,
      v_subcategory,
      v_delta
    );
    v_brand_w := public.recs_accum_weight(v_brand_w, v_brand, v_delta);
    v_fit_w := public.recs_accum_weight(v_fit_w, v_fit, v_delta);
    v_price_band_w := public.recs_accum_weight(
      v_price_band_w,
      v_price_band,
      v_delta
    );
  end loop;

  if jsonb_array_length(v_neg) > 100 then
    select coalesce(jsonb_agg(t.val order by t.ord), '[]'::jsonb)
    into v_neg
    from jsonb_array_elements(v_neg) with ordinality as t(val, ord)
    where t.ord <= 100;
  end if;

  v_tags := '[]'::jsonb;
  if to_regclass('public.profiles') is not null then
    select coalesce(p.style_tags, '[]'::jsonb)
    into v_tags
    from public.profiles as p
    where p.id = p_user_id;
  end if;

  if jsonb_typeof(v_tags) = 'array' then
    for v_tag in
      select jsonb_array_elements_text(v_tags)
    loop
      v_style := public.recs_accum_weight(v_style, v_tag, 1);
    end loop;
  end if;

  insert into public.user_style_profiles (
    user_id,
    color_w,
    subcategory_w,
    brand_w,
    fit_w,
    price_band_w,
    negative_preferences,
    style_tag_weights,
    event_count,
    last_event_at,
    computed_at,
    updated_at
  )
  values (
    p_user_id,
    public.recs_normalize_weights(v_color_w),
    public.recs_normalize_weights(v_subcategory_w),
    public.recs_normalize_weights(v_brand_w),
    public.recs_normalize_weights(v_fit_w),
    public.recs_normalize_weights(v_price_band_w),
    v_neg,
    v_style,
    v_event_count,
    v_last_event_at,
    now(),
    now()
  )
  on conflict (user_id) do update
  set
    color_w = excluded.color_w,
    subcategory_w = excluded.subcategory_w,
    brand_w = excluded.brand_w,
    fit_w = excluded.fit_w,
    price_band_w = excluded.price_band_w,
    negative_preferences = excluded.negative_preferences,
    style_tag_weights = excluded.style_tag_weights,
    event_count = excluded.event_count,
    last_event_at = excluded.last_event_at,
    computed_at = excluded.computed_at,
    updated_at = excluded.updated_at;

  return jsonb_build_object(
    'user_id', p_user_id,
    'event_count', v_event_count,
    'last_event_at', v_last_event_at
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. ingest_events
--    p_batch: JSON dizi veya { "events": [ ... ] }
--    Satır: event_id, user_id, session_id, event_type, product_id?, payload?,
--           created_at?
-- -----------------------------------------------------------------------------

create or replace function public.ingest_events(p_batch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_batch jsonb;
  v_item jsonb;
  v_user_id uuid;
  v_inserted integer := 0;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'ingest_events: giriş zorunlu'
      using errcode = '42501';
  end if;

  if p_batch is null then
    raise exception 'ingest_events: batch zorunlu'
      using errcode = '22023';
  end if;

  if jsonb_typeof(p_batch) = 'object' and p_batch ? 'events' then
    v_batch := p_batch -> 'events';
  else
    v_batch := p_batch;
  end if;

  if jsonb_typeof(v_batch) is distinct from 'array' then
    raise exception 'ingest_events: batch bir JSON dizi olmalı'
      using errcode = '22023';
  end if;

  for v_item in
    select value from jsonb_array_elements(v_batch)
  loop
    if jsonb_typeof(v_item) is distinct from 'object' then
      raise exception 'ingest_events: her satır bir nesne olmalı'
        using errcode = '22023';
    end if;

    if v_item ->> 'event_id' is null
      or v_item ->> 'user_id' is null
      or v_item ->> 'session_id' is null
      or nullif(btrim(coalesce(v_item ->> 'event_type', '')), '') is null
    then
      raise exception 'ingest_events: event_id, user_id, session_id, event_type zorunlu'
        using errcode = '22023';
    end if;

    begin
      v_user_id := (v_item ->> 'user_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'ingest_events: user_id geçersiz uuid'
          using errcode = '22P02';
    end;

    if v_user_id <> v_uid then
      raise exception 'ingest_events: user_id oturum ile eşleşmiyor'
        using errcode = '42501';
    end if;

    begin
      perform (v_item ->> 'event_id')::uuid;
      perform (v_item ->> 'session_id')::uuid;
    exception
      when invalid_text_representation then
        raise exception 'ingest_events: event_id veya session_id geçersiz uuid'
          using errcode = '22P02';
    end;
  end loop;

  insert into public.user_events (
    event_id,
    user_id,
    session_id,
    event_type,
    product_id,
    payload,
    created_at
  )
  select
    (item ->> 'event_id')::uuid,
    (item ->> 'user_id')::uuid,
    (item ->> 'session_id')::uuid,
    btrim(item ->> 'event_type'),
    nullif(btrim(coalesce(item ->> 'product_id', '')), ''),
    coalesce(item -> 'payload', '{}'::jsonb),
    least(
      coalesce((item ->> 'created_at')::timestamptz, now()),
      now()
    )
  from jsonb_array_elements(v_batch) as item
  on conflict (event_id) do nothing;

  get diagnostics v_inserted = row_count;

  perform public.recompute_profile(v_uid);

  return jsonb_build_object(
    'inserted', v_inserted,
    'received', jsonb_array_length(v_batch),
    'user_id', v_uid
  );
end;
$$;

revoke all on function public.recompute_profile(uuid) from public, anon;
grant execute on function public.recompute_profile(uuid) to authenticated;
grant execute on function public.recompute_profile(uuid) to service_role;

revoke all on function public.ingest_events(jsonb) from public, anon;
grant execute on function public.ingest_events(jsonb) to authenticated;

revoke all on function public.recs_accum_weight(jsonb, text, numeric)
  from public, anon, authenticated;
revoke all on function public.recs_normalize_weights(jsonb)
  from public, anon, authenticated;
revoke all on function public.recs_payload_colors(jsonb)
  from public, anon, authenticated;

comment on table public.user_events is
  'VITRIVIA Recs V1 event log. event_id istemci idempotency anahtarı.';
comment on table public.recs_config is
  'V1 HYPOTHESIS skor/decay/diversity; TypeScript bu tabloyu okumalı.';
comment on table public.user_style_profiles is
  'Davranışsal ağırlıklar (0..1) + declared style_tag_weights. Scoring karıştırmaz.';
comment on function public.ingest_events(jsonb) is
  'Batch insert; çakışan event_id yok sayılır; ardından recompute_profile.';
comment on function public.recompute_profile(uuid) is
  'Son ≤1000 meaningful event (abs(weight)>=0.5), 30g half-life, normalize 0..1.';
