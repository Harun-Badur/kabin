import type { GarmentCategory } from './vton';

export type FeedProvider = 'amazon' | 'trendyol' | 'hepsiburada' | 'mock';

export interface ProductColor {
  name: string;
  hex: string;
}

export interface Product {
  id: string;
  imageUrl: string;
  title: string;
  price: number;
  currentPrice?: number;
  previousPrice?: number;
  lastPriceCheckedAt?: string;
  brand: string;
  category: GarmentCategory;
  garmentDescription: string;
  provider?: FeedProvider;
  productUrl?: string;
  affiliateUrl?: string;
  externalId?: string;
  colors?: ProductColor[];
  sizes?: string[];
}

export interface LikedProduct {
  product: Product;
  notifyOnPriceDrop: boolean;
  likedAt: string;
}

export interface FeedProductRow {
  id: string;
  provider: FeedProvider;
  external_id: string;
  title: string;
  brand: string | null;
  price: number | string;
  current_price?: number | string | null;
  previous_price?: number | string | null;
  last_price_checked_at?: string | null;
  currency: string;
  image_url: string;
  product_url: string;
  category: string;
  affiliate_url: string | null;
  garment_description?: string | null;
}

export const GARMENT_CATEGORY_LABEL: Record<GarmentCategory, string> = {
  upper_body: 'Üst Giyim',
  lower_body: 'Alt Giyim',
  dresses: 'Elbise',
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isGarmentCategory = (value: unknown): value is GarmentCategory =>
  value === 'upper_body' || value === 'lower_body' || value === 'dresses';

const isOptionalFiniteNumber = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === 'number' && Number.isFinite(value));

export const isProductSnapshot = (value: unknown): value is Product => {
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
    typeof value.garmentDescription === 'string' &&
    isOptionalFiniteNumber(value.currentPrice) &&
    isOptionalFiniteNumber(value.previousPrice)
  );
};

export const getDisplayPrice = (product: Product): number => {
  if (
    typeof product.currentPrice === 'number' &&
    Number.isFinite(product.currentPrice)
  ) {
    return product.currentPrice;
  }
  return product.price;
};

export const hasCatalogPriceDrop = (product: Product): boolean => {
  const livePrice = getDisplayPrice(product);
  return (
    typeof product.previousPrice === 'number' &&
    product.previousPrice > livePrice
  );
};

export const formatTryPrice = (price: number): string =>
  `₺${price.toFixed(2)}`;

export const getDropPercent = (
  referencePrice: number,
  livePrice: number,
): number => {
  if (referencePrice <= 0 || livePrice >= referencePrice) {
    return 0;
  }
  const percent = Math.round(
    ((referencePrice - livePrice) / referencePrice) * 100,
  );
  return Math.max(1, percent);
};
