import { create } from 'zustand';
import { MOCK_PRODUCTS } from '../data/mockProducts';
import { logger } from '../lib/logger';
import {
  fetchFeedProducts,
  type FeedSource,
} from '../services/productService';
import {
  deleteLikedProduct,
  fetchLikedProducts,
  fetchPassedProductIds,
  insertLikedProduct,
  insertPassedProduct,
  updateLikedProductAlert,
} from '../services/likeService';
import type { LikedProduct, Product } from '../types/product';

export type FeedStatus = 'idle' | 'loading' | 'error' | 'success';
export type SessionSyncStatus = 'idle' | 'loading' | 'error' | 'success';

export interface LikeAlertPatch {
  notifyOnPriceDrop: boolean;
}

const FEED_LIMIT = 20;

interface AppState {
  currentProducts: Product[];
  likedProducts: LikedProduct[];
  passedProductIds: string[];
  feedStatus: FeedStatus;
  feedSource: FeedSource | null;
  feedIsPersonalized: boolean;
  sessionUserId: string | null;
  sessionSyncStatus: SessionSyncStatus;
  loadFeed: (userId: string | null) => Promise<void>;
  hydrateSession: (userId: string) => Promise<void>;
  resetSession: () => void;
  swipeRight: (product: Product) => void;
  swipeLeft: (product: Product) => void;
  unlikeProduct: (productId: string) => Promise<void>;
  updateLikeAlert: (productId: string, patch: LikeAlertPatch) => Promise<void>;
  refreshLikedProducts: () => Promise<void>;
}

const removeProduct = (products: Product[], productId: string): Product[] =>
  products.filter((item) => item.id !== productId);

const removeLiked = (
  products: LikedProduct[],
  productId: string,
): LikedProduct[] =>
  products.filter((item) => item.product.id !== productId);

/**
 * Sunucu yazımı başarısız olan ürünü desteye geri koyar. Araya giren diğer
 * swipe'lar korunsun diye dizinin tamamı snapshot'a döndürülmez.
 */
const restoreProduct = (products: Product[], product: Product): Product[] =>
  products.some((item) => item.id === product.id)
    ? products
    : [product, ...products];

const prependLikedUnique = (
  products: LikedProduct[],
  product: Product,
): LikedProduct[] => {
  if (products.some((item) => item.product.id === product.id)) {
    return products;
  }
  // Liste sunucuda liked_at'e göre azalan sıralı geldiği için en yeni beğeni başa.
  return [
    {
      product,
      notifyOnPriceDrop: true,
      likedAt: new Date().toISOString(),
    },
    ...products,
  ];
};

const insertLikedAt = (
  products: LikedProduct[],
  index: number,
  item: LikedProduct,
): LikedProduct[] => {
  if (products.some((existing) => existing.product.id === item.product.id)) {
    return products;
  }
  const next = [...products];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, item);
  return next;
};

const appendUniqueId = (ids: string[], productId: string): string[] => {
  if (ids.includes(productId)) {
    return ids;
  }
  return [...ids, productId];
};

const excludeSeen = (
  products: Product[],
  likedProducts: LikedProduct[],
  passedProductIds: string[],
): Product[] => {
  const seen = new Set([
    ...likedProducts.map((item) => item.product.id),
    ...passedProductIds,
  ]);
  return products.filter((item) => !seen.has(item.id));
};

export const useAppStore = create<AppState>((set, get) => ({
  currentProducts: [],
  likedProducts: [],
  passedProductIds: [],
  feedStatus: 'idle',
  feedSource: null,
  feedIsPersonalized: false,
  sessionUserId: null,
  sessionSyncStatus: 'idle',
  // userId çağıran ekrandan geçer: feed effect'i kök layout'un hidrasyonundan
  // önce koştuğu için sessionUserId burada henüz null olabiliyor.
  loadFeed: async (userId: string | null): Promise<void> => {
    set({ feedStatus: 'loading' });
    try {
      const result = await fetchFeedProducts(FEED_LIMIT, userId);
      logger.debug('Feed yüklendi', {
        source: result.source,
        isPersonalized: result.isPersonalized,
      });
      set((state) => ({
        currentProducts: excludeSeen(
          result.products,
          state.likedProducts,
          state.passedProductIds,
        ),
        feedStatus: 'success',
        feedSource: result.source,
        feedIsPersonalized: result.isPersonalized,
      }));
    } catch (error) {
      logger.error('Feed yüklenemedi; mock ürünlere düşülüyor.', { error });
      set((state) => ({
        currentProducts: excludeSeen(
          MOCK_PRODUCTS,
          state.likedProducts,
          state.passedProductIds,
        ),
        feedStatus: 'error',
        feedSource: 'mock',
        feedIsPersonalized: false,
      }));
    }
  },
  hydrateSession: async (userId: string): Promise<void> => {
    set({ sessionUserId: userId, sessionSyncStatus: 'loading' });
    try {
      const [likedProducts, passedIds] = await Promise.all([
        fetchLikedProducts(userId),
        fetchPassedProductIds(userId),
      ]);
      set((state) => ({
        likedProducts,
        passedProductIds: passedIds,
        sessionSyncStatus: 'success',
        currentProducts: excludeSeen(
          state.currentProducts,
          likedProducts,
          passedIds,
        ),
      }));
    } catch (error) {
      logger.error('Oturum verisi yüklenemedi', { error });
      set({ sessionSyncStatus: 'error' });
    }
  },
  resetSession: (): void => {
    set({
      sessionUserId: null,
      sessionSyncStatus: 'idle',
      likedProducts: [],
      passedProductIds: [],
      feedIsPersonalized: false,
    });
  },
  swipeRight: (product: Product): void => {
    const userId = get().sessionUserId;

    set((state) => ({
      currentProducts: removeProduct(state.currentProducts, product.id),
      likedProducts: prependLikedUnique(state.likedProducts, product),
      passedProductIds: state.passedProductIds.filter(
        (id) => id !== product.id,
      ),
    }));

    if (!userId) {
      logger.warn('Beğeni için oturum yok; kayıt yazılmadı.', {
        productId: product.id,
      });
      return;
    }

    void insertLikedProduct(userId, product).catch((error: unknown) => {
      logger.error('Beğeni yazılamadı, geri alınıyor', {
        error,
        productId: product.id,
      });
      set((state) => ({
        currentProducts: restoreProduct(state.currentProducts, product),
        likedProducts: removeLiked(state.likedProducts, product.id),
      }));
    });
  },
  swipeLeft: (product: Product): void => {
    const userId = get().sessionUserId;

    set((state) => ({
      currentProducts: removeProduct(state.currentProducts, product.id),
      passedProductIds: appendUniqueId(state.passedProductIds, product.id),
    }));

    if (!userId) {
      return;
    }

    void insertPassedProduct(userId, product).catch((error: unknown) => {
      logger.error('Geçme yazılamadı, geri alınıyor', {
        error,
        productId: product.id,
      });
      set((state) => ({
        currentProducts: restoreProduct(state.currentProducts, product),
        passedProductIds: state.passedProductIds.filter(
          (id) => id !== product.id,
        ),
      }));
    });
  },
  unlikeProduct: async (productId: string): Promise<void> => {
    const { likedProducts, sessionUserId: userId } = get();
    const removedIndex = likedProducts.findIndex(
      (item) => item.product.id === productId,
    );
    const removed = likedProducts[removedIndex];

    set((state) => ({
      likedProducts: removeLiked(state.likedProducts, productId),
    }));

    if (!userId || !removed) {
      return;
    }

    try {
      await deleteLikedProduct(userId, productId);
    } catch (error) {
      logger.error('Beğeni silinemedi, geri alınıyor', { error, productId });
      set((state) => ({
        likedProducts: insertLikedAt(
          state.likedProducts,
          removedIndex,
          removed,
        ),
      }));
      throw error;
    }
  },
  updateLikeAlert: async (
    productId: string,
    patch: LikeAlertPatch,
  ): Promise<void> => {
    const { likedProducts, sessionUserId: userId } = get();
    const target = likedProducts.find((item) => item.product.id === productId);

    if (!target) {
      return;
    }

    const previousValue = target.notifyOnPriceDrop;
    const applyNotify = (value: boolean) => (state: AppState) => ({
      likedProducts: state.likedProducts.map((item) =>
        item.product.id === productId
          ? { ...item, notifyOnPriceDrop: value }
          : item,
      ),
    });

    set(applyNotify(patch.notifyOnPriceDrop));

    if (!userId) {
      return;
    }

    try {
      await updateLikedProductAlert({
        userId,
        productId,
        notifyOnPriceDrop: patch.notifyOnPriceDrop,
      });
    } catch (error) {
      logger.error('Fiyat alarmı geri alındı', { error, productId });
      set(applyNotify(previousValue));
      throw error;
    }
  },
  refreshLikedProducts: async (): Promise<void> => {
    const userId = get().sessionUserId;
    if (!userId) {
      return;
    }
    try {
      const likedProducts = await fetchLikedProducts(userId);
      set({ likedProducts, sessionSyncStatus: 'success' });
    } catch (error) {
      logger.error('Beğeniler yenilenemedi', { error });
      throw error;
    }
  },
}));
