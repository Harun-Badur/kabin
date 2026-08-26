-- =============================================================================
-- VITRIVIA Recs V1 — P1 User Understanding + Funnel + Declared Style
-- Supabase Dashboard > SQL Editor içine TAMAMINI yapıştırıp Run.
-- Önkoşul: supabase/recs_v1.sql
-- IDEMPOTENT.
-- =============================================================================

-- Extra scoring knobs. ON CONFLICT DO NOTHING: canlıde ezilmez.
insert into public.recs_config (key, value)
values
  ('noise_amplitude', '2'::jsonb),
  (
    'scoring_mix',
    '{"declared_style": 0.35, "behavioral_style": 0.65}'::jsonb
  ),
  (
    'soft_negative',
    '{"product_hours": 12, "feature_scale": 0.25}'::jsonb
  )
on conflict (key) do nothing;

-- Mevcut scoring_weights'e try_shop_boost ekle; diğer anahtarları koru.
update public.recs_config
set value = value || '{"try_shop_boost": 4}'::jsonb
where key = 'scoring_weights'
  and not (value ? 'try_shop_boost');

-- Impression → like attribution join'i için.
create index if not exists user_events_rec_id_idx
  on public.user_events ((payload ->> 'recommendation_id'))
  where payload ? 'recommendation_id';

create index if not exists user_events_user_type_created_idx
  on public.user_events (user_id, event_type, created_at desc);

-- -----------------------------------------------------------------------------
-- Declared style (Beden & Stil stüdyosu). Behavioral map'lere dokunmaz.
-- -----------------------------------------------------------------------------

create or replace function public.sync_declared_style_tags(p_tags jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_style jsonb := '{}'::jsonb;
  v_tag text;
begin
  if v_uid is null then
    raise exception 'giriş zorunlu';
  end if;

  if jsonb_typeof(p_tags) = 'array' then
    for v_tag in
      select jsonb_array_elements_text(p_tags)
    loop
      v_style := public.recs_accum_weight(v_style, v_tag, 1);
    end loop;
  end if;

  insert into public.user_style_profiles (
    user_id,
    style_tag_weights,
    updated_at
  )
  values (
    v_uid,
    v_style,
    now()
  )
  on conflict (user_id) do update
  set
    style_tag_weights = excluded.style_tag_weights,
    updated_at = now();

  return jsonb_build_object(
    'user_id', v_uid,
    'style_tag_weights', v_style
  );
end;
$$;

revoke all on function public.sync_declared_style_tags(jsonb) from public, anon;
grant execute on function public.sync_declared_style_tags(jsonb) to authenticated;

-- -----------------------------------------------------------------------------
-- v_funnel: impression → like → try_on_success → store_click
-- 7 gün pencere, recommendation_id join. Purchase YOK.
-- -----------------------------------------------------------------------------

create or replace view public.v_funnel as
with windowed as (
  select
    e.user_id,
    e.product_id,
    e.event_type,
    coalesce(e.payload ->> 'recommendation_id', '') as recommendation_id,
    e.created_at
  from public.user_events as e
  where e.product_id is not null
    and e.created_at >= (now() - interval '7 days')
),
impressions as (
  select
    w.user_id,
    w.product_id,
    w.recommendation_id,
    min(w.created_at) as impression_at
  from windowed as w
  where w.event_type = 'impression'
  group by w.user_id, w.product_id, w.recommendation_id
)
select
  i.user_id,
  i.product_id,
  i.recommendation_id,
  i.impression_at,
  l.like_at,
  t.try_on_success_at,
  s.store_click_at
from impressions as i
left join lateral (
  select min(w.created_at) as like_at
  from windowed as w
  where w.user_id = i.user_id
    and w.product_id = i.product_id
    and w.recommendation_id = i.recommendation_id
    and w.event_type = 'like'
    and w.created_at >= i.impression_at
    and w.created_at <= i.impression_at + interval '7 days'
) as l on true
left join lateral (
  select min(w.created_at) as try_on_success_at
  from windowed as w
  where w.user_id = i.user_id
    and w.product_id = i.product_id
    and w.recommendation_id = i.recommendation_id
    and w.event_type = 'try_on_success'
    and l.like_at is not null
    and w.created_at >= l.like_at
    and w.created_at <= i.impression_at + interval '7 days'
) as t on true
left join lateral (
  select min(w.created_at) as store_click_at
  from windowed as w
  where w.user_id = i.user_id
    and w.product_id = i.product_id
    and w.recommendation_id = i.recommendation_id
    and w.event_type = 'store_click'
    and t.try_on_success_at is not null
    and w.created_at >= t.try_on_success_at
    and w.created_at <= i.impression_at + interval '7 days'
) as s on true;

alter view public.v_funnel set (security_invoker = true);

revoke all on public.v_funnel from anon;
grant select on public.v_funnel to authenticated;
grant select on public.v_funnel to service_role;
