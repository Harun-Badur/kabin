import {
  clampHeightCm,
  clampWeightKg,
  isGarmentSize,
  parseStyleTags,
} from '../lib/profileStudio';

describe('profileStudio', () => {
  it('boyu 150–210 aralığına sıkıştırır', () => {
    expect(clampHeightCm(149)).toBe(150);
    expect(clampHeightCm(211)).toBe(210);
    expect(clampHeightCm(176.4)).toBe(176);
  });

  it('kiloyu 40–150 aralığına sıkıştırır', () => {
    expect(clampWeightKg(39)).toBe(40);
    expect(clampWeightKg(151)).toBe(150);
    expect(clampWeightKg(68.6)).toBe(69);
  });

  it('yalnızca bilinen stil etiketlerini kabul eder', () => {
    expect(parseStyleTags(['minimal', 'unknown', 'sport', 12])).toEqual([
      'minimal',
      'sport',
    ]);
    expect(parseStyleTags(null)).toEqual([]);
  });

  it('beden jetonunu doğrular', () => {
    expect(isGarmentSize('M')).toBe(true);
    expect(isGarmentSize('XXS')).toBe(false);
  });
});
