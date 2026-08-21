import type { GarmentCategory } from './vton';

export type FeedProvider = 'amazon' | 'trendyol' | 'hepsiburada' | 'mock';

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

export const getDisplayPrice = (product: Product): number =>
  product.currentPrice ?? product.price;

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
