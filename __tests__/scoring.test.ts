import {
  applyFeedMode,
  DEFAULT_RECS_CONFIG,
  emptySessionIntent,
  emptyStyleProfile,
  controlledNoise,
  matchesHardConstraints,
  scoreCandidate,
  softNegativeScore,
} from '../lib/scoring';
import type {
  ScoringCandidate,
  StyleProfileSnapshot,
} from '../types/recommendation';

const DAY_MS = 86_400_000;

const candidate = (
  overrides: Partial<ScoringCandidate> = {},
): ScoringCandidate => ({
  id: 'p1',
  brand: 'Mango',
  brandSlug: 'mango',
  category: 'upper_body',
  subcategory: 'hoodie',
  fit: 'oversized',
  colors: ['siyah'],
  priceBand: 'mid',
  price: 799,
  gender: 'unisex',
  createdAtMs: Date.parse('2026-08-01T00:00:00.000Z'),
  impressionCount: 0,
  deal: 0,
  ...overrides,
});

describe('scoring', () => {
  it('controlled_noise aynı kullanıcı, ürün ve günde deterministiktir', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const a = controlledNoise('user-1', 'p1', now, 2);
    const b = controlledNoise('user-1', 'p1', now + 3_600_000, 2);
    const nextDay = controlledNoise('user-1', 'p1', now + DAY_MS, 2);
    expect(a).toBe(b);
    expect(a).not.toBe(nextDay);
    expect(a).toBeGreaterThanOrEqual(-2);
    expect(a).toBeLessThanOrEqual(2);
  });

  it('style_affinity behavioral sinyali declared priordan baskın tutar', () => {
    const profile: StyleProfileSnapshot = {
      ...emptyStyleProfile('user-1'),
      styleTagWeights: { minimal: 1 },
      colorW: { siyah: 1 },
      subcategoryW: { hoodie: 1 },
      fitW: { oversized: 1 },
    };
    const session = emptySessionIntent();
    const item = candidate();
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const scored = scoreCandidate(
      item,
      profile,
      session,
      DEFAULT_RECS_CONFIG,
      now,
      'user-1',
    );

    const declaredHeavy = {
      ...DEFAULT_RECS_CONFIG,
      declaredStyleShare: 0.65,
      behavioralStyleShare: 0.35,
    };
    const declaredScored = scoreCandidate(
      item,
      profile,
      session,
      declaredHeavy,
      now,
      'user-1',
    );

    expect(scored.breakdown.style_affinity).toBeGreaterThan(
      declaredScored.breakdown.style_affinity,
    );
    expect(scored.breakdown.style_affinity).toBeGreaterThan(0.5);
  });

  it('aynı ürüne 12s soft negative feature cezasını çiftlemez', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const profile: StyleProfileSnapshot = {
      ...emptyStyleProfile('user-1'),
      negativePreferences: [
        {
          productId: 'p1',
          at: new Date(now - 60_000).toISOString(),
          colors: ['siyah'],
          subcategory: 'hoodie',
          fit: 'oversized',
          brandSlug: 'mango',
          priceBand: 'mid',
        },
      ],
    };
    const productPenalty = softNegativeScore(
      candidate(),
      profile,
      now,
      12,
      0.25,
    );
    const featureOnly = softNegativeScore(
      candidate({ id: 'p2' }),
      profile,
      now,
      12,
      0.25,
    );
    expect(productPenalty).toBeGreaterThan(0.9);
    expect(featureOnly).toBeLessThan(productPenalty);
    expect(featureOnly).toBeLessThanOrEqual(0.25 + 0.01);
  });

  it('personal applyFeedMode config’i değiştirmez', () => {
    expect(applyFeedMode(DEFAULT_RECS_CONFIG, 'personal')).toBe(
      DEFAULT_RECS_CONFIG,
    );
  });

  it('trend freshness ve novelty’yi personal’dan daha ağır basar', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const fresh = candidate({
      createdAtMs: now,
      impressionCount: 0,
    });
    const profile = emptyStyleProfile('user-1');
    const session = emptySessionIntent();
    const personal = scoreCandidate(
      fresh,
      profile,
      session,
      DEFAULT_RECS_CONFIG,
      now,
      'user-1',
    );
    const trend = scoreCandidate(
      fresh,
      profile,
      session,
      applyFeedMode(DEFAULT_RECS_CONFIG, 'trend'),
      now,
      'user-1',
    );
    expect(trend.breakdown.total).toBeGreaterThan(personal.breakdown.total);
    expect(
      applyFeedMode(DEFAULT_RECS_CONFIG, 'trend').scoringWeights.freshness,
    ).toBeGreaterThan(DEFAULT_RECS_CONFIG.scoringWeights.freshness);
    expect(
      applyFeedMode(DEFAULT_RECS_CONFIG, 'trend').diversityMix.discovery,
    ).toBeGreaterThan(DEFAULT_RECS_CONFIG.diversityMix.discovery);
  });

  it('trend deal sinyalini ekler; personal deal_match 0 kalır', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const profile = emptyStyleProfile('user-1');
    const session = emptySessionIntent();
    const withDeal = candidate({ deal: 1 });
    const personal = scoreCandidate(
      withDeal,
      profile,
      session,
      DEFAULT_RECS_CONFIG,
      now,
      'user-1',
    );
    const trend = scoreCandidate(
      withDeal,
      profile,
      session,
      applyFeedMode(DEFAULT_RECS_CONFIG, 'trend'),
      now,
      'user-1',
    );
    expect(personal.breakdown.deal).toBe(1);
    expect(DEFAULT_RECS_CONFIG.scoringWeights.deal_match).toBe(0);
    expect(trend.breakdown.total).toBeGreaterThan(personal.breakdown.total);
  });

  it('trend açık kategori kısıtını kaldırmaz', () => {
    const session = emptySessionIntent();
    session.constraints.category = 'dresses';
    const hoodie = candidate({ category: 'upper_body' });
    const dress = candidate({ id: 'p2', category: 'dresses', subcategory: 'elbise' });
    expect(matchesHardConstraints(hoodie, session)).toBe(false);
    expect(matchesHardConstraints(dress, session)).toBe(true);
  });
});
