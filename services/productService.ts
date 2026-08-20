import { MOCK_PRODUCTS } from '../data/mockProducts';
import { buildAffiliateUrl } from '../lib/deeplink';
import { getSupabaseClient } from '../lib/supabase';
import type {
  FeedProductRow,
  FeedProvider,
  Product,
} from '../types/product';
import type { GarmentCategory } from '../types/vton';

export type FeedSource = 'supabase' | 'mock';

export interface FetchFeedProductsResult {
  products: Product[];
  source: FeedSource;
}

const DEFAULT_FEED_LIMIT = 20;
const FETCH_POOL_MULTIPLIER = 4;

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

  return {
    id: row.id,
    imageUrl: row.image_url,
    title: row.title,
    price: toPrice(row.price),
    brand,
    category: row.category,
    garmentDescription,
    provider: row.provider,
    productUrl,
    affiliateUrl,
    externalId: row.external_id,
  };
};

export const fetchFeedProducts = async (
  limit = DEFAULT_FEED_LIMIT,
): Promise<FetchFeedProductsResult> => {
  const client = getSupabaseClient();

  if (!client) {
    console.warn('Supabase yapilandirmasi eksik; mock urunlere dusuluyor.');
    return { products: MOCK_PRODUCTS, source: 'mock' };
  }

  try {
    const { data, error } = await client
      .from('products')
      .select(
        'id, provider, external_id, title, brand, price, currency, image_url, product_url, category, affiliate_url',
      )
      .limit(Math.max(limit * FETCH_POOL_MULTIPLIER, limit));

    if (error) {
      console.error('Supabase urun feedi alinamadi; mock urunlere dusuluyor.', {
        message: error.message,
      });
      return { products: MOCK_PRODUCTS, source: 'mock' };
    }

    const mapped = (data ?? [])
      .filter(isFeedProductRow)
      .map(mapFeedRow)
      .filter((product): product is Product => product !== null);

    if (mapped.length === 0) {
      console.warn('Supabase products tablosu bos; mock urunlere dusuluyor.');
      return { products: MOCK_PRODUCTS, source: 'mock' };
    }

    const products = shuffle(mapped).slice(0, limit);
    console.log(`Feed kaynagi: supabase (${products.length} urun)`);
    return { products, source: 'supabase' };
  } catch (error) {
    console.error('Urun feedi beklenmeyen hatayla dustu; mock kullaniliyor.', {
      error,
    });
    return { products: MOCK_PRODUCTS, source: 'mock' };
  }
};
