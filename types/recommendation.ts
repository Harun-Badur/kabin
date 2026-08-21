import type { Product } from './product';
import type { GarmentCategory } from './vton';

export interface PriceRange {
  min: number;
  max: number;
  average: number;
}

export interface UserPreferences {
  /** Beğenilerin kategori dağılımı, örn. { upper_body: 5, lower_body: 2, dresses: 1 }. */
  categoryCounts: Record<GarmentCategory, number>;
  /**
   * Beğenilerin marka dağılımı. Anahtarlar normalize edilmiştir (kırpılmış +
   * Türkçe küçük harf), çünkü katalogda aynı marka farklı yazımla gelebiliyor.
   */
  brandCounts: Record<string, number>;
  /** Beğenilerden türetilen fiyat aralığı; hiç beğeni yoksa null. */
  priceRange: PriceRange | null;
  /** Geçilen ürünler; skorlamada ceza uygulanır. */
  passedProductIds: ReadonlySet<string>;
  likeCount: number;
}

export interface ScoredProduct {
  product: Product;
  score: number;
}
