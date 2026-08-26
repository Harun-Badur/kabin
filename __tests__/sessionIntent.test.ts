import {
  buildIntent,
  recordSessionAction,
  resetSessionIntent,
  setSessionFilters,
  setSessionQuery,
} from '../lib/sessionIntent';

const attrs = (subcategory: string, brandSlug: string) => ({
  category: 'upper_body',
  subcategory,
  brandSlug,
  colors: ['siyah'],
  fit: 'regular',
  priceBand: 'mid',
  gender: 'unisex',
});

describe('sessionIntent', () => {
  beforeEach(() => {
    resetSessionIntent();
  });

  it('zaman sırasına göre son 12 meaningful action tutar', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    for (let index = 0; index < 15; index += 1) {
      recordSessionAction('like', {
        atMs: now - (14 - index) * 1_000,
        productId: `p-${index}`,
        attrs: attrs(`sub-${index}`, 'mango'),
      });
    }

    const fresh = buildIntent(now);
    expect(fresh.lastSubcategory).toBe('sub-14');
    expect(fresh.weights.subcategoryW['sub-2']).toBeUndefined();
    expect(fresh.weights.subcategoryW['sub-14']).toBe(1);
  });

  it('10 dakikalık half-life ile eski aksiyonun ağırlığını yarıya indirir', () => {
    const now = Date.parse('2026-08-25T12:00:00.000Z');
    recordSessionAction('like', {
      atMs: now - 10 * 60 * 1000,
      productId: 'old-brand',
      attrs: attrs('tisort', 'oldbrand'),
    });
    recordSessionAction('like', {
      atMs: now,
      productId: 'new-brand',
      attrs: attrs('hoodie', 'newbrand'),
    });
    const decayed = buildIntent(now);
    expect(decayed.weights.brandW.newbrand).toBe(1);
    expect(decayed.weights.brandW.oldbrand).toBeCloseTo(0.5, 1);
  });

  it('aktif filtreyi hard constraint, aramayı query olarak taşır', () => {
    setSessionFilters({
      category: 'dresses',
      gender: 'women',
      size: 'M',
    });
    setSessionQuery('keten');
    const intent = buildIntent();
    expect(intent.constraints.category).toBe('dresses');
    expect(intent.constraints.gender).toBe('women');
    expect(intent.query).toBe('keten');
  });
});
