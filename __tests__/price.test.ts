import { parseNumeric, parseOptionalNumeric } from '../lib/price';
import {
  getDisplayPrice,
  isProductSnapshot,
  type Product,
} from '../types/product';

const baseProduct: Product = {
  id: 'p1',
  imageUrl: 'https://example.com/p.jpg',
  title: 'Test mont',
  price: 100,
  brand: 'Kabin',
  category: 'upper_body',
  garmentDescription: 'Mont',
};

describe('getDisplayPrice', () => {
  it('currentPrice varsa onu gösterir', () => {
    expect(getDisplayPrice({ ...baseProduct, currentPrice: 79.9 })).toBe(79.9);
  });

  it('currentPrice yoksa price’a düşer', () => {
    expect(getDisplayPrice(baseProduct)).toBe(100);
  });

  it('NaN ve undefined currentPrice değerini yok sayar', () => {
    expect(getDisplayPrice({ ...baseProduct, currentPrice: Number.NaN })).toBe(
      100,
    );
    expect(
      getDisplayPrice({ ...baseProduct, currentPrice: undefined }),
    ).toBe(100);
  });
});

describe('parseNumeric type guards', () => {
  it('bozuk currentPrice "abc" değerini reddeder', () => {
    expect(parseNumeric('abc')).toBeNull();
    expect(parseOptionalNumeric('abc')).toBeUndefined();
  });

  it('undefined, null ve NaN değerlerini reddeder', () => {
    expect(parseNumeric(undefined)).toBeNull();
    expect(parseNumeric(null)).toBeNull();
    expect(parseNumeric(Number.NaN)).toBeNull();
    expect(parseOptionalNumeric(undefined)).toBeUndefined();
  });

  it('virgüllü sayı dizgisini çözer', () => {
    expect(parseNumeric('12,50')).toBe(12.5);
  });
});

describe('isProductSnapshot', () => {
  it('geçerli anlık görüntüyü kabul eder', () => {
    expect(isProductSnapshot(baseProduct)).toBe(true);
  });

  it('bozuk currentPrice: "abc" reddedilmeli', () => {
    expect(
      isProductSnapshot({
        ...baseProduct,
        currentPrice: 'abc',
      }),
    ).toBe(false);
  });
});
