-- =============================================================================
-- VITRIVIA Recs V1 — Trend feed mode boost
-- Supabase Dashboard > SQL Editor içine TAMAMINI yapıştırıp Run.
-- Önkoşul: supabase/recs_v1.sql
-- IDEMPOTENT: canlıdeki recs_config satırlarını ezmez.
-- Personal scoring_weights değişmez. Trend çarpanları ayrı key’dedir.
-- =============================================================================

insert into public.recs_config (key, value)
values (
  'trend_scoring_boost',
  '{
    "freshness": 1.8,
    "novelty": 1.6,
    "context": 0.45,
    "style_match": 0.55,
    "category_match": 0.7,
    "color_match": 0.7,
    "brand_match": 0.7,
    "fit_match": 0.7,
    "price_match": 1,
    "deal_match": 3,
    "preferred": 0.82,
    "discovery": 1.45
  }'::jsonb
)
on conflict (key) do nothing;
