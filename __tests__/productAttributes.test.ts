import {
  inferFitFromTitle,
  inferGenderFromTitle,
  inferPriceBand,
  inferProductAttributes,
  inferSubcategory,
  slugify,
} from '../lib/productAttributes';

describe('productAttributes heuristics', () => {
  it('curated polo başlığını slim + kahverengi + men yapar', () => {
    const inferred = inferProductAttributes({
      title: 'Erkek Kahverengi Polo Yaka Tişört',
      brand: 'Tudors',
      price: 599,
      category: 'upper_body',
    });

    expect(inferred).toMatchObject({
      gender: 'men',
      colors: ['kahverengi'],
      fit: 'slim',
      subcategory: 'polo',
      brand_slug: 'tudors',
      price_band: 'mid',
    });
  });

  it('title heuristic oversize ve renk çıkarır', () => {
    expect(inferFitFromTitle('Kadın Siyah Oversize Tişört')).toBe('oversized');
    expect(inferGenderFromTitle('Kadın Siyah Oversize Tişört')).toBe('women');
    expect(inferSubcategory('Kadın Siyah Oversize Tişört', 'upper_body')).toBe(
      'tisort',
    );
  });

  it('fiyat bantlarını ayırır', () => {
    expect(inferPriceBand(399)).toBe('low');
    expect(inferPriceBand(899)).toBe('mid');
    expect(inferPriceBand(2000)).toBe('high');
    expect(inferPriceBand(4000)).toBe('luxury');
  });

  it('marka slug üretir', () => {
    expect(slugify('DS Damat')).toBe('ds-damat');
  });
});
