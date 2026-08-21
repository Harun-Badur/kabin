import { parseNumeric, parseOptionalNumeric } from '../lib/price';
import { getRequiredSupabaseClient } from '../lib/supabase';
import type { AuthUser } from '../types/auth';
import type { FeedProvider, LikedProduct, Product } from '../types/product';
import { getDisplayPrice } from '../types/product';
import type { GarmentCategory } from '../types/vton';

interface LikedProductRow {
  id: string;
  product_id: string;
  product_snapshot: unknown;
  liked_at: string;
  liked_price?: number | string | null;
  target_price?: number | string | null;
  notify_on_price_drop?: boolean | null;
}

interface PassedProductRow {
  product_id: string;
}

interface CatalogPriceRow {
  id: string;
  price: number | string;
  current_price?: number | string | null;
  previous_price?: number | string | null;
  last_price_checked_at?: string | null;
}

export interface UpdateLikeAlertParams {
  userId: string;
  productId: string;
  notifyOnPriceDrop?: boolean;
  targetPrice?: number | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isGarmentCategory = (value: unknown): value is GarmentCategory =>
  value === 'upper_body' || value === 'lower_body' || value === 'dresses';

const isFeedProvider = (value: unknown): value is FeedProvider =>
  value === 'amazon' ||
  value === 'trendyol' ||
  value === 'hepsiburada' ||
  value === 'mock';

const isProductSnapshot = (value: unknown): value is Product => {
  if (!isRecord(value)) {
    return false;
  }
  const price = value.price;
  return (
    typeof value.id === 'string' &&
    typeof value.imageUrl === 'string' &&
    typeof value.title === 'string' &&
    typeof price === 'number' &&
    Number.isFinite(price) &&
    typeof value.brand === 'string' &&
    isGarmentCategory(value.category) &&
    typeof value.garmentDescription === 'string'
  );
};

const toSnapshot = (product: Product): Product => ({
  id: product.id,
  imageUrl: product.imageUrl,
  title: product.title,
  price: product.price,
  currentPrice: product.currentPrice,
  previousPrice: product.previousPrice,
  lastPriceCheckedAt: product.lastPriceCheckedAt,
  brand: product.brand,
  category: product.category,
  garmentDescription: product.garmentDescription,
  provider: isFeedProvider(product.provider) ? product.provider : undefined,
  productUrl: product.productUrl,
  affiliateUrl: product.affiliateUrl,
  externalId: product.externalId,
});

const isLikedProductRow = (value: unknown): value is LikedProductRow => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    typeof value.product_id === 'string' &&
    typeof value.liked_at === 'string'
  );
};

const isPassedProductRow = (value: unknown): value is PassedProductRow => {
  if (!isRecord(value)) {
    return false;
  }
  return typeof value.product_id === 'string';
};

const isCatalogPriceRow = (value: unknown): value is CatalogPriceRow => {
  if (!isRecord(value)) {
    return false;
  }
  return (
    typeof value.id === 'string' &&
    (typeof value.price === 'number' || typeof value.price === 'string')
  );
};

const applyCatalogPrices = (
  product: Product,
  catalog: CatalogPriceRow | undefined,
): Product => {
  if (!catalog) {
    return product;
  }
  const listPrice = parseNumeric(catalog.price) ?? product.price;
  return {
    ...product,
    price: listPrice,
    currentPrice: parseOptionalNumeric(catalog.current_price),
    previousPrice: parseOptionalNumeric(catalog.previous_price),
    lastPriceCheckedAt:
      typeof catalog.last_price_checked_at === 'string'
        ? catalog.last_price_checked_at
        : product.lastPriceCheckedAt,
  };
};

export const ensureUserProfile = async (user: AuthUser): Promise<void> => {
  const client = getRequiredSupabaseClient();
  const { error } = await client.from('users').upsert(
    {
      id: user.id,
      email: user.email ?? '',
    },
    { onConflict: 'id' },
  );

  if (error) {
    throw new Error(`Profil kaydedilemedi: ${error.message}`);
  }
};

const fetchCatalogPrices = async (
  productIds: string[],
): Promise<Map<string, CatalogPriceRow>> => {
  if (productIds.length === 0) {
    return new Map();
  }

  const client = getRequiredSupabaseClient();
  const withPriceColumns =
    'id, price, current_price, previous_price, last_price_checked_at';
  const first = await client
    .from('products')
    .select(withPriceColumns)
    .in('id', productIds);

  let rows: unknown[] = first.data ?? [];
  let queryError = first.error;

  if (queryError?.message.toLowerCase().includes('current_price')) {
    const retry = await client
      .from('products')
      .select('id, price')
      .in('id', productIds);
    rows = retry.data ?? [];
    queryError = retry.error;
  }

  if (queryError) {
    console.error('Katalog fiyatları okunamadı', {
      message: queryError.message,
    });
    return new Map();
  }

  const map = new Map<string, CatalogPriceRow>();
  rows.filter(isCatalogPriceRow).forEach((row) => {
    map.set(row.id, row);
  });
  return map;
};

export const fetchLikedProducts = async (
  userId: string,
): Promise<LikedProduct[]> => {
  const client = getRequiredSupabaseClient();
  const { data, error } = await client
    .from('liked_products')
    .select(
      'id, product_id, product_snapshot, liked_at, liked_price, target_price, notify_on_price_drop',
    )
    .eq('user_id', userId)
    .order('liked_at', { ascending: false });

  if (error) {
    const message = error.message.toLowerCase();
    if (message.includes('liked_price') || message.includes('target_price')) {
      const fallback = await client
        .from('liked_products')
        .select('id, product_id, product_snapshot, liked_at')
        .eq('user_id', userId)
        .order('liked_at', { ascending: false });
      if (fallback.error) {
        throw new Error(`Beğeniler yüklenemedi: ${fallback.error.message}`);
      }
      const rows = (fallback.data ?? []).filter(isLikedProductRow);
      const catalog = await fetchCatalogPrices(rows.map((row) => row.product_id));
      return mapLikedRows(rows, catalog);
    }
    throw new Error(`Beğeniler yüklenemedi: ${error.message}`);
  }

  const rows = (data ?? []).filter(isLikedProductRow);
  const catalog = await fetchCatalogPrices(rows.map((row) => row.product_id));
  return mapLikedRows(rows, catalog);
};

const mapLikedRows = (
  rows: unknown[],
  catalog: Map<string, CatalogPriceRow>,
): LikedProduct[] =>
  rows.filter(isLikedProductRow).flatMap((row) => {
    if (!isProductSnapshot(row.product_snapshot)) {
      return [];
    }
    const snapshot = row.product_snapshot;
    const product = applyCatalogPrices(snapshot, catalog.get(row.product_id));
    const likedPrice =
      parseNumeric(row.liked_price) ??
      parseNumeric(snapshot.currentPrice) ??
      snapshot.price;
    return [
      {
        likeId: row.id,
        product,
        likedPrice,
        targetPrice: parseNumeric(row.target_price),
        notifyOnPriceDrop: row.notify_on_price_drop !== false,
        likedAt: row.liked_at,
      },
    ];
  });

export const fetchPassedProductIds = async (
  userId: string,
): Promise<string[]> => {
  const client = getRequiredSupabaseClient();
  const { data, error } = await client
    .from('passed_products')
    .select('product_id')
    .eq('user_id', userId);

  if (error) {
    throw new Error(`Geçilen ürünler yüklenemedi: ${error.message}`);
  }

  return (data ?? [])
    .filter(isPassedProductRow)
    .map((row) => row.product_id);
};

export const insertLikedProduct = async (
  userId: string,
  product: Product,
): Promise<void> => {
  const client = getRequiredSupabaseClient();
  const likedPrice = getDisplayPrice(product);
  const { error: likeError } = await client.from('liked_products').upsert(
    {
      user_id: userId,
      product_id: product.id,
      product_snapshot: toSnapshot(product),
      notify_on_price_drop: true,
      liked_price: likedPrice,
    },
    { onConflict: 'user_id,product_id', ignoreDuplicates: true },
  );

  if (likeError?.message.toLowerCase().includes('liked_price')) {
    const retry = await client.from('liked_products').upsert(
      {
        user_id: userId,
        product_id: product.id,
        product_snapshot: toSnapshot(product),
        notify_on_price_drop: true,
      },
      { onConflict: 'user_id,product_id', ignoreDuplicates: true },
    );
    if (retry.error) {
      throw new Error(`Beğeni kaydedilemedi: ${retry.error.message}`);
    }
  } else if (likeError) {
    throw new Error(`Beğeni kaydedilemedi: ${likeError.message}`);
  }

  const { error: passError } = await client
    .from('passed_products')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', product.id);

  if (passError) {
    console.error('Geçilen ürün beğenide temizlenemedi', {
      message: passError.message,
      productId: product.id,
    });
  }

  console.log('Beğeni Supabase\'e yazıldı', {
    productId: product.id,
    title: product.title,
    userId,
  });
};

export const insertPassedProduct = async (
  userId: string,
  product: Product,
): Promise<void> => {
  const client = getRequiredSupabaseClient();
  const { error } = await client.from('passed_products').upsert(
    {
      user_id: userId,
      product_id: product.id,
    },
    { onConflict: 'user_id,product_id' },
  );

  if (error) {
    throw new Error(`Geçme kaydedilemedi: ${error.message}`);
  }
};

export const deleteLikedProduct = async (
  userId: string,
  productId: string,
): Promise<void> => {
  const client = getRequiredSupabaseClient();
  const { error } = await client
    .from('liked_products')
    .delete()
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Beğeni silinemedi: ${error.message}`);
  }
};

export const updateLikedProductAlert = async ({
  userId,
  productId,
  notifyOnPriceDrop,
  targetPrice,
}: UpdateLikeAlertParams): Promise<void> => {
  const client = getRequiredSupabaseClient();
  const patch: Record<string, boolean | number | null> = {};
  if (notifyOnPriceDrop !== undefined) {
    patch.notify_on_price_drop = notifyOnPriceDrop;
  }
  if (targetPrice !== undefined) {
    patch.target_price = targetPrice;
  }

  if (Object.keys(patch).length === 0) {
    return;
  }

  const { error } = await client
    .from('liked_products')
    .update(patch)
    .eq('user_id', userId)
    .eq('product_id', productId);

  if (error) {
    throw new Error(`Fiyat alarmı güncellenemedi: ${error.message}`);
  }
};
