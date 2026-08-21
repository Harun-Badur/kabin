import { buildAffiliateUrl } from '../lib/deeplink';

const AMAZON_TAG = 'kabin-21';
const TRENDYOL_TAG = 'trendyol-aff';
const HEPSIBURADA_TAG = 'hb-aff';
const MOCK_TAG = 'mock-aff';

describe('buildAffiliateUrl', () => {
  const originalPublicTags = process.env.EXPO_PUBLIC_AFFILIATE_TAGS_JSON;
  const originalScriptTags = process.env.AFFILIATE_TAGS_JSON;

  beforeEach(() => {
    delete process.env.EXPO_PUBLIC_AFFILIATE_TAGS_JSON;
    delete process.env.AFFILIATE_TAGS_JSON;
  });

  afterAll(() => {
    process.env.EXPO_PUBLIC_AFFILIATE_TAGS_JSON = originalPublicTags;
    process.env.AFFILIATE_TAGS_JSON = originalScriptTags;
  });
  it('amazon URL’sine tag parametresi ekler', () => {
    const url = buildAffiliateUrl(
      'amazon',
      'https://www.amazon.com.tr/dp/B0TEST',
      AMAZON_TAG,
    );

    expect(url).toContain('tag=kabin-21');
    expect(url.startsWith('https://www.amazon.com.tr/dp/B0TEST')).toBe(true);
  });

  it('trendyol için adjust_t, hepsiburada için wt_alid, mock için aff_id kullanır', () => {
    expect(
      buildAffiliateUrl(
        'trendyol',
        'https://www.trendyol.com/x-p-1',
        TRENDYOL_TAG,
      ),
    ).toContain('adjust_t=trendyol-aff');

    expect(
      buildAffiliateUrl(
        'hepsiburada',
        'https://www.hepsiburada.com/x-p-1',
        HEPSIBURADA_TAG,
      ),
    ).toContain('wt_alid=hb-aff');

    expect(
      buildAffiliateUrl('mock', 'https://example.com/item', MOCK_TAG),
    ).toContain('aff_id=mock-aff');
  });

  it('sorgusuz URL’de ? ile parametre ekler', () => {
    const url = buildAffiliateUrl(
      'amazon',
      'https://www.amazon.com.tr/dp/B0TEST',
      AMAZON_TAG,
    );

    expect(url).toContain('?tag=kabin-21');
    expect(url).not.toContain('&tag=');
  });

  it('mevcut sorguda & ile parametre ekler', () => {
    const url = buildAffiliateUrl(
      'amazon',
      'https://www.amazon.com.tr/dp/B0TEST?ref=nav',
      AMAZON_TAG,
    );

    expect(url).toContain('ref=nav');
    expect(url).toContain('tag=kabin-21');
    expect(url).toMatch(/[?&]tag=kabin-21/);
    expect((url.match(/\?/g) ?? []).length).toBe(1);
  });

  it('geçersiz URL’de ? / & ayırıcısını elle seçer', () => {
    const spy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const withoutQuery = buildAffiliateUrl('amazon', 'not-a-url', AMAZON_TAG);
    expect(withoutQuery).toBe('not-a-url?tag=kabin-21');

    const withQuery = buildAffiliateUrl(
      'amazon',
      'not-a-url?foo=1',
      AMAZON_TAG,
    );
    expect(withQuery).toBe('not-a-url?foo=1&tag=kabin-21');

    spy.mockRestore();
  });

  it('etiket yoksa orijinal URL’yi döndürür', () => {
    const productUrl = 'https://www.amazon.com.tr/dp/B0TEST';
    expect(buildAffiliateUrl('amazon', productUrl)).toBe(productUrl);
  });
});
