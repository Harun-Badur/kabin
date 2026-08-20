import type { GarmentCategory } from './vton';

export type FeedProvider = 'amazon' | 'trendyol' | 'hepsiburada' | 'mock';

export interface Product {
  id: string;
  imageUrl: string;
  title: string;
  price: number;
  brand: string;
  category: GarmentCategory;
  garmentDescription: string;
  provider?: FeedProvider;
  productUrl?: string;
  affiliateUrl?: string;
  externalId?: string;
}

export interface FeedProductRow {
  id: string;
  provider: FeedProvider;
  external_id: string;
  title: string;
  brand: string | null;
  price: number | string;
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

