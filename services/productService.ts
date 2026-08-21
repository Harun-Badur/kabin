import { MOCK_PRODUCTS } from '../data/mockProducts';
import { buildAffiliateUrl } from '../lib/deeplink';
import { logger } from '../lib/logger';
import { parseOptionalNumeric } from '../lib/price';
import { getSupabaseClient } from '../lib/supabase';
import type {
  FeedProductRow,
  FeedProvider,
  Product,
} from '../types/product';
import type { ScoredProduct, UserPreferences } from '../types/recommendation';
import type { GarmentCategory } from '../types/vton';
import { getUserPreferences, rankProducts } from './recommendationService';

export type FeedSource = 'supabase' | 'mock';

export interface FetchFeedProductsResult {
  products: Product[];
  source: FeedSource;
  isPersonalized: boolean;
}

const DEFAULT_FEED_LIMIT = 20;
const FETCH_POOL_MULTIPLIER = 4;

/** Bu eşiğin altında profil güvenilir değil; feed yarı rastgele kalır. */
const MIN_LIKES_FOR_FULL_RANKING = 5;
/** Az veri varken skorlu payın oranı; kalanı rastgele kuyruktan gelir. */
const RANKED_SHARE_WHEN_SPARSE = 0.5;
/** Filtre balonunu kırmak için düşük skorlu havuzdan alınan keşif kartı sayısı. */
const DISCOVERY_SLOT_COUNT = 3;
/** Keşif kartlarının yerleştirileceği sıralar (0 tabanlı). */
const DISCOVERY_POSITIONS = [1, 4, 7] as const;

const isGarmentCategory = (value: string): value is GarmentCategory =>
  value === 'upper_body' || value === 'lower_body' || value === 'dresses';

const isFeedProvider = (value: string): value is FeedProvider =>
  value === 'amazon' ||
  value === 'trendyol' ||
  value === 'hepsiburada' ||
  value === 'mock';

const isFeedProductRow = (value: unknown): value is FeedProductRow => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.provider === 'string' &&
    typeof row.external_id === 'string' &&
    typeof row.title === 'string' &&
    (typeof row.brand === 'string' || row.brand === null) &&
    (typeof row.price === 'number' || typeof row.price === 'string') &&
    typeof row.currency === 'string' &&
    typeof row.image_url === 'string' &&
    typeof row.product_url === 'string' &&
    typeof row.category === 'string' &&
    (typeof row.affiliate_url === 'string' || row.affiliate_url === null) &&
    (typeof row.garment_description === 'string' ||
      row.garment_description === null ||
      row.garment_description === undefined)
  );
};

const shuffle = <T>(items: T[]): T[] => {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const current = copy[index];
    const swap = copy[swapIndex];
    if (current === undefined || swap === undefined) {
      continue;
    }
    copy[index] = swap;
    copy[swapIndex] = current;
  }
  return copy;
};

const toPrice = (value: number | string): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  const parsed = Number(String(value).replace(',', '.').replace(/[^\d.-]/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const mapFeedRow = (row: FeedProductRow): Product | null => {
  if (!isGarmentCategory(row.category) || !isFeedProvider(row.provider)) {
    return null;
  }

  const brand = row.brand?.trim() || 'Kabin';
  const productUrl = row.product_url;
  const affiliateUrl =
    row.affiliate_url?.trim() ||
    buildAffiliateUrl(row.provider, productUrl);
  const garmentDescription =
    row.garment_description?.trim() || `${brand} ${row.title}`.trim();

  const listPrice = toPrice(row.price);
  const currentPrice = parseOptionalNumeric(row.current_price);

  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title,
    price: listPrice,
    currentPrice,
    previousPrice: parseOptionalNumeric(row.previous_price),
    lastPriceCheckedAt:
      typeof row.last_price_checked_at === 'string'
        ? row.last_price_checked_at
        : undefined,
    brand,
    category: row.category,
    garmentDescription,
    provider: row.provider,
    productUrl,
    affiliateUrl,
    externalId: row.external_id,
  };
};

/**
 * Skorlu listeye keşif kartları serpiştirir. Kartlar en düşük skorlu yarıdan
 * rastgele seçilir; kullanıcı en iyi eşleşmesiyle karşılaşsın diye en başa
 * değil, ilk sıralara dağıtılırlar.
 */
const withDiscoverySlots = (
  ranked: ScoredProduct[],
  limit: number,
): Product[] => {
  const lowerHalfStart = Math.ceil(ranked.length / 2);
  const discovery = shuffle(ranked.slice(lowerHalfStart)).slice(
    0,
    DISCOVERY_SLOT_COUNT,
  );
  const discoveryIds = new Set(discovery.map((item) => item.product.id));

  const feed = ranked
    .filter((item) => !discoveryIds.has(item.product.id))
    .slice(0, Math.max(limit - discovery.length, 0))
    .map((item) => item.product);

  discovery.forEach((item, index) => {
    const position = DISCOVERY_POSITIONS[index] ?? feed.length;
    feed.splice(Math.min(position, feed.length), 0, item.product);
  });

  return feed.slice(0, limit);
};

/**
 * Beğeni sayısı eşiğin altındayken skorlu ve rastgele yarıyı harmanlar.
 * Rastgele pay zaten çeşitlilik sağladığı için ayrıca keşif kartı eklenmez.
 */
const blendWithRandom = (
  ranked: ScoredProduct[],
  limit: number,
): Product[] => {
  const rankedCount = Math.ceil(limit * RANKED_SHARE_WHEN_SPARSE);
  const top = ranked.slice(0, rankedCount).map((item) => item.product);
  const tail = shuffle(ranked.slice(rankedCount).map((item) => item.product));
  return [...top, ...tail].slice(0, limit);
};

const arrangePersonalizedFeed = (
  pool: Product[],
  preferences: UserPreferences,
  limit: number,
): Product[] => {
  const ranked = rankProducts(pool, preferences);

  logger.debug('Feed skorları', {
    likeCount: preferences.likeCount,
    categoryCounts: preferences.categoryCounts,
    priceRange: preferences.priceRange,
    scores: ranked.map((item) => ({
      title: item.product.title,
      brand: item.product.brand,
      score: Math.round(item.score * 100) / 100,
    })),
  });

  return preferences.likeCount < MIN_LIKES_FOR_FULL_RANKING
    ? blendWithRandom(ranked, limit)
    : withDiscoverySlots(ranked, limit);
};

export const fetchFeedProducts = async (
  limit = DEFAULT_FEED_LIMIT,
  userId: string | null = null,
): Promise<FetchFeedProductsResult> => {
  const client = getSupabaseClient();

  if (!client) {
    logger.warn('Supabase yapılandırması eksik; mock ürünlere düşülüyor.');
    return { products: MOCK_PRODUCTS, source: 'mock', isPersonalized: false };
  }

  try {
    const { data, error } = await client
      .from('products')
      .select(
        'id, provider, external_id, title, brand, price, current_price, previous_price, last_price_checked_at, currency, image_url, product_url, category, affiliate_url',
      )
      .limit(Math.max(limit * FETCH_POOL_MULTIPLIER, limit));

    if (error) {
      logger.error('Supabase ürün feedi alınamadı; mock ürünlere düşülüyor.', {
        detail: error.message,
      });
      return { products: MOCK_PRODUCTS, source: 'mock', isPersonalized: false };
    }

    const mapped = (data ?? [])
      .filter(isFeedProductRow)
      .map(mapFeedRow)
      .filter((product): product is Product => product !== null);

    if (mapped.length === 0) {
      logger.warn('Supabase products tablosu boş; mock ürünlere düşülüyor.');
      return { products: MOCK_PRODUCTS, source: 'mock', isPersonalized: false };
    }

    const preferences = userId ? await getUserPreferences(userId) : null;

    // Oturum yoksa ya da hiç beğeni yoksa eski rastgele davranış korunur.
    if (!preferences || preferences.likeCount === 0) {
      return {
        products: shuffle(mapped).slice(0, limit),
        source: 'supabase',
        isPersonalized: false,
      };
    }

    return {
      products: arrangePersonalizedFeed(mapped, preferences, limit),
      source: 'supabase',
      isPersonalized: true,
    };
  } catch (error) {
    logger.error('Ürün feedi beklenmeyen hatayla düştü; mock kullanılıyor.', {
      error,
    });
    return { products: MOCK_PRODUCTS, source: 'mock', isPersonalized: false };
  }
};
