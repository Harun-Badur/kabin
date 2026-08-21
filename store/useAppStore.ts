import { create } from 'zustand';
import { MOCK_PRODUCTS } from '../data/mockProducts';
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
import { getDisplayPrice } from '../types/product';

export type FeedStatus = 'idle' | 'loading' | 'error' | 'success';
export type SessionSyncStatus = 'idle' | 'loading' | 'error' | 'success';

export interface LikeAlertPatch {
  notifyOnPriceDrop?: boolean;
  targetPrice?: number | null;
}

interface AppState {
  currentProducts: Product[];
  likedProducts: LikedProduct[];
  passedProductIds: string[];
  feedStatus: FeedStatus;
  feedSource: FeedSource | null;
  sessionUserId: string | null;
  sessionSyncStatus: SessionSyncStatus;
  loadFeed: () => Promise<void>;
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

const appendLikedUnique = (
  products: LikedProduct[],
  product: Product,
): LikedProduct[] => {
  if (products.some((item) => item.product.id === product.id)) {
    return products;
  }
  return [
    ...products,
    {
      likeId: `local-${product.id}`,
      product,
      likedPrice: getDisplayPrice(product),
      targetPrice: null,
      notifyOnPriceDrop: true,
      likedAt: new Date().toISOString(),
    },
  ];
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
  sessionUserId: null,
  sessionSyncStatus: 'idle',
  loadFeed: async (): Promise<void> => {
    set({ feedStatus: 'loading' });
    try {
      const result = await fetchFeedProducts(20);
      console.log(`Feed kaynağı: ${result.source}`);
      const { likedProducts, passedProductIds } = get();
      set({
        currentProducts: excludeSeen(
          result.products,
          likedProducts,
          passedProductIds,
        ),
        feedStatus: 'success',
        feedSource: result.source,
      });
    } catch (error) {
      console.error('Feed yüklenemedi; mock ürünlere düşülüyor.', { error });
      const { likedProducts, passedProductIds } = get();
      set({
        currentProducts: excludeSeen(
          MOCK_PRODUCTS,
          likedProducts,
          passedProductIds,
        ),
        feedStatus: 'error',
        feedSource: 'mock',
      });
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
      console.error('Oturum verisi yüklenemedi', { error });
      set({ sessionSyncStatus: 'error' });
    }
  },
  resetSession: (): void => {
    set({
      sessionUserId: null,
      sessionSyncStatus: 'idle',
      likedProducts: [],
      passedProductIds: [],
    });
  },
  swipeRight: (product: Product): void => {
    const previous = get();
    set({
      currentProducts: removeProduct(previous.currentProducts, product.id),
      likedProducts: appendLikedUnique(previous.likedProducts, product),
      passedProductIds: previous.passedProductIds.filter(
        (id) => id !== product.id,
      ),
    });

    const userId = previous.sessionUserId;
    if (!userId) {
      console.warn('Beğeni için giriş yok; kayıt yazılmadı.', {
        productId: product.id,
      });
      return;
    }

    void insertLikedProduct(userId, product).catch((error: unknown) => {
      console.error('Beğeni yazılamadı, geri alınıyor', {
        error,
        productId: product.id,
      });
      set({
        currentProducts: previous.currentProducts,
        likedProducts: previous.likedProducts,
        passedProductIds: previous.passedProductIds,
      });
    });
  },
  swipeLeft: (product: Product): void => {
    const previous = get();
    set({
      currentProducts: removeProduct(previous.currentProducts, product.id),
      passedProductIds: appendUniqueId(previous.passedProductIds, product.id),
    });

    const userId = previous.sessionUserId;
    if (!userId) {
      return;
    }

    void insertPassedProduct(userId, product).catch((error: unknown) => {
      console.error('Geçme yazılamadı, geri alınıyor', {
        error,
        productId: product.id,
      });
      set({
        currentProducts: previous.currentProducts,
        passedProductIds: previous.passedProductIds,
      });
    });
  },
  unlikeProduct: async (productId: string): Promise<void> => {
    const previous = get();
    const userId = previous.sessionUserId;
    set({
      likedProducts: removeLiked(previous.likedProducts, productId),
    });

    if (!userId) {
      return;
    }

    try {
      await deleteLikedProduct(userId, productId);
    } catch (error) {
      console.error('Beğeni silinemedi, geri alınıyor', { error, productId });
      set({ likedProducts: previous.likedProducts });
      throw error;
    }
  },
  updateLikeAlert: async (
    productId: string,
    patch: LikeAlertPatch,
  ): Promise<void> => {
    const previous = get();
    const userId = previous.sessionUserId;
    set({
      likedProducts: previous.likedProducts.map((item) => {
        if (item.product.id !== productId) {
          return item;
        }
        return {
          ...item,
          notifyOnPriceDrop:
            patch.notifyOnPriceDrop ?? item.notifyOnPriceDrop,
          targetPrice:
            patch.targetPrice === undefined
              ? item.targetPrice
              : patch.targetPrice,
        };
      }),
    });

    if (!userId) {
      return;
    }

    try {
      await updateLikedProductAlert({
        userId,
        productId,
        notifyOnPriceDrop: patch.notifyOnPriceDrop,
        targetPrice: patch.targetPrice,
      });
    } catch (error) {
      console.error('Fiyat alarmı geri alındı', { error, productId });
      set({ likedProducts: previous.likedProducts });
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
      console.error('Beğeniler yenilenemedi', { error });
      throw error;
    }
  },
}));
