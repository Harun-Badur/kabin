import { logger } from '../lib/logger';
import { parseNumeric } from '../lib/price';
import { getRequiredSupabaseClient } from '../lib/supabase';
import type { Product } from '../types/product';
import { getDisplayPrice } from '../types/product';
import type {
  PriceRange,
  ScoredProduct,
  UserPreferences,
} from '../types/recommendation';
import type { GarmentCategory } from '../types/vton';

/**
 * Skorlama ağırlıkları. Kategori ve marka bonusları, kullanıcının EN ÇOK
 * beğendiği kategoriye/markaya göre oranlanır: baskın olan tam puanı alır,
 * yarısı kadar beğenilen yarı puan alır. Sabit bonus verilseydi üç kategoriyi
 * de beğenen kullanıcıda tüm ürünler eşitlenir ve sıralama gürültüye kalırdı.
 */
export const CATEGORY_MATCH_WEIGHT = 10;
export const BRAND_MATCH_WEIGHT = 5;
export const PRICE_RANGE_WEIGHT = 3;
export const PASSED_PENALTY = 20;
export const NOISE_AMPLITUDE = 2;

/** Fiyat bonusu aralık kenarlarında bu orana kadar iner. */
const PRICE_EDGE_FALLOFF = 0.5;

interface PreferenceSignal {
  category: GarmentCategory;
  brand: string;
  price: number;
}

const isGarmentCategory = (value: unknown): value is GarmentCategory =>
  value === 'upper_body' || value === 'lower_body' || value === 'dresses';

const normalizeBrand = (brand: string): string =>
  brand.trim().toLocaleLowerCase('tr');

const createEmptyPreferences = (): UserPreferences => ({
  categoryCounts: { upper_body: 0, lower_body: 0, dresses: 0 },
  brandCounts: {},
  priceRange: null,
  passedProductIds: new Set<string>(),
  likeCount: 0,
});

const toPreferenceSignal = (snapshot: unknown): PreferenceSignal | null => {
  if (typeof snapshot !== 'object' || snapshot === null) {
    return null;
  }

  const record = snapshot as Record<string, unknown>;
  const { category, brand } = record;
  const price = parseNumeric(record.currentPrice) ?? parseNumeric(record.price);

  if (
    !isGarmentCategory(category) ||
    typeof brand !== 'string' ||
    price === null
  ) {
    return null;
  }

  return { category, brand, price };
};

const toPriceRange = (prices: number[]): PriceRange | null => {
  if (prices.length === 0) {
    return null;
  }

  const total = prices.reduce((sum, price) => sum + price, 0);
  return {
    min: Math.min(...prices),
    max: Math.max(...prices),
    average: total / prices.length,
  };
};

const readPassedProductIds = async (userId: string): Promise<Set<string>> => {
  const client = getRequiredSupabaseClient();
  const { data, error } = await client
    .from('passed_products')
    .select('product_id')
    .eq('user_id', userId);

  if (error) {
    logger.error('Tercihler için geçilen ürünler okunamadı', {
      detail: error.message,
    });
    return new Set<string>();
  }

  const ids = new Set<string>();
  for (const row of data ?? []) {
    const productId = (row as Record<string, unknown>).product_id;
    if (typeof productId === 'string') {
      ids.add(productId);
    }
  }
  return ids;
};

const readLikeSignals = async (
  userId: string,
): Promise<PreferenceSignal[]> => {
  const client = getRequiredSupabaseClient();
  const { data, error } = await client
    .from('liked_products')
    .select('product_snapshot')
    .eq('user_id', userId);

  if (error) {
    logger.error('Tercihler için beğeniler okunamadı', {
      detail: error.message,
    });
    return [];
  }

  return (data ?? []).flatMap((row) => {
    const signal = toPreferenceSignal(
      (row as Record<string, unknown>).product_snapshot,
    );
    return signal ? [signal] : [];
  });
};

/**
 * Kullanıcının beğeni/geçme geçmişinden tercih profilini üretir. Store'daki
 * hidrasyon feed yüklemesinden sonra bitebildiği için veriler doğrudan
 * Supabase'den okunur; böylece sıralama oturum yarışına bağlı kalmaz.
 *
 * Kişiselleştirme zorunlu bir özellik değil: sorgu düşerse boş profille
 * dönülür ve feed rastgele sıralamaya geri düşer.
 */
export const getUserPreferences = async (
  userId: string,
): Promise<UserPreferences> => {
  const [signals, passedProductIds] = await Promise.all([
    readLikeSignals(userId),
    readPassedProductIds(userId),
  ]);

  const preferences = createEmptyPreferences();
  preferences.passedProductIds = passedProductIds;
  preferences.likeCount = signals.length;

  for (const signal of signals) {
    preferences.categoryCounts[signal.category] += 1;
    const brandKey = normalizeBrand(signal.brand);
    if (brandKey.length > 0) {
      preferences.brandCounts[brandKey] =
        (preferences.brandCounts[brandKey] ?? 0) + 1;
    }
  }

  preferences.priceRange = toPriceRange(signals.map((signal) => signal.price));

  return preferences;
};

const scoreCategory = (
  category: GarmentCategory,
  preferences: UserPreferences,
): number => {
  const counts = Object.values(preferences.categoryCounts);
  const topCount = Math.max(...counts);
  if (topCount === 0) {
    return 0;
  }
  return CATEGORY_MATCH_WEIGHT * (preferences.categoryCounts[category] / topCount);
};

const scoreBrand = (brand: string, preferences: UserPreferences): number => {
  const counts = Object.values(preferences.brandCounts);
  if (counts.length === 0) {
    return 0;
  }
  const topCount = Math.max(...counts);
  const brandCount = preferences.brandCounts[normalizeBrand(brand)] ?? 0;
  if (topCount === 0 || brandCount === 0) {
    return 0;
  }
  return BRAND_MATCH_WEIGHT * (brandCount / topCount);
};

const scorePrice = (price: number, range: PriceRange | null): number => {
  if (!range || price < range.min || price > range.max) {
    return 0;
  }

  const span = Math.max(range.max - range.min, 1);
  const distanceFromAverage = Math.abs(price - range.average) / span;
  return (
    PRICE_RANGE_WEIGHT *
    (1 - Math.min(distanceFromAverage, PRICE_EDGE_FALLOFF))
  );
};

const randomNoise = (): number =>
  (Math.random() * 2 - 1) * NOISE_AMPLITUDE;

export const scoreProduct = (
  product: Product,
  preferences: UserPreferences,
): number => {
  const passedPenalty = preferences.passedProductIds.has(product.id)
    ? -PASSED_PENALTY
    : 0;

  return (
    scoreCategory(product.category, preferences) +
    scoreBrand(product.brand, preferences) +
    scorePrice(getDisplayPrice(product), preferences.priceRange) +
    passedPenalty +
    randomNoise()
  );
};

export const rankProducts = (
  products: Product[],
  preferences: UserPreferences,
): ScoredProduct[] =>
  products
    .map((product) => ({ product, score: scoreProduct(product, preferences) }))
    .sort((left, right) => right.score - left.score);
