import { buildSlotPlan, rerankForDiversity } from '../lib/diversity';
import { buildReasons } from '../lib/reasons';
import {
  DEFAULT_RECS_CONFIG,
  emptySessionIntent,
  emptyStyleProfile,
  scoreCandidate,
} from '../lib/scoring';
import type { ScoringCandidate } from '../types/recommendation';

const baseCandidate = (
  id: string,
  overrides: Partial<ScoringCandidate> = {},
): ScoringCandidate => ({
  id,
  brand: 'Brand',
  brandSlug: 'brand',
  category: 'upper_body',
  subcategory: 'tisort',
  fit: 'regular',
  colors: ['beyaz'],
  priceBand: 'mid',
  price: 400,
  gender: 'unisex',
  createdAtMs: Date.parse('2026-08-20T00:00:00.000Z'),
  impressionCount: 3,
  deal: 0,
  ...overrides,
});

describe('diversity rerank', () => {
  it('10 slottan birini exploration olarak işaretler', () => {
    const plan = buildSlotPlan(10, DEFAULT_RECS_CONFIG.diversityMix);
    expect(plan).toHaveLength(10);
    expect(plan.filter((slot) => slot === 'exploration')).toHaveLength(1);
    expect(plan[9]).toBe('exploration');
  });

  it('ilk 8 kartta aynı markayı 2 ile sınırlar', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const profile = emptyStyleProfile('user-1');
    const session = emptySessionIntent();
    const mangoAndOthers = Array.from({ length: 12 }, (_, index) =>
      scoreCandidate(
        baseCandidate(`p-${index}`, {
          brandSlug: index < 6 ? 'mango' : `brand-${index}`,
          brand: index < 6 ? 'Mango' : `Brand ${index}`,
          colors: index % 2 === 0 ? ['siyah'] : ['beyaz'],
          subcategory: `sub-${index}`,
        }),
        profile,
        session,
        DEFAULT_RECS_CONFIG,
        now,
        'user-1',
      ),
    );

    const ranked = rerankForDiversity(
      mangoAndOthers,
      session,
      DEFAULT_RECS_CONFIG,
      profile,
      8,
      now,
    );
    const mangoCount = ranked.filter(
      (item) => item.candidate.brandSlug === 'mango',
    ).length;
    expect(mangoCount).toBeLessThanOrEqual(2);
  });
});

describe('reasons', () => {
  it('negatif katkı etiketlemez ve en fazla 2 etiket döner', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    const profile = {
      ...emptyStyleProfile('user-1'),
      colorW: { siyah: 0.9 },
      brandW: { mango: 0.8 },
      subcategoryW: { hoodie: 0.7 },
      priceBandW: { mid: 0.6 },
      styleTagWeights: { minimal: 1 },
      negativePreferences: [
        {
          productId: 'p1',
          at: new Date(now).toISOString(),
          colors: ['siyah'],
          subcategory: 'hoodie',
          fit: 'oversized',
          brandSlug: 'mango',
          priceBand: 'mid',
        },
      ],
    };
    const scored = scoreCandidate(
      baseCandidate('p1', {
        brandSlug: 'mango',
        colors: ['siyah'],
        subcategory: 'hoodie',
        fit: 'oversized',
      }),
      profile,
      emptySessionIntent(),
      DEFAULT_RECS_CONFIG,
      now,
      'user-1',
    );
    const reasons = buildReasons(
      scored,
      'preferred',
      profile,
      DEFAULT_RECS_CONFIG,
    );
    expect(reasons.length).toBeLessThanOrEqual(2);
    expect(reasons.join(' ')).not.toMatch(/ceza|negatif|geçti/i);
  });
});
