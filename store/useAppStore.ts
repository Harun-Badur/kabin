import { create } from 'zustand';
import { MOCK_PRODUCTS } from '../data/mockProducts';
import {
  fetchFeedProducts,
  type FeedSource,
} from '../services/productService';
import type { Product } from '../types/product';

export type FeedStatus = 'idle' | 'loading' | 'error' | 'success';

interface AppState {
  currentProducts: Product[];
  likedProducts: Product[];
  passedProducts: Product[];
  feedStatus: FeedStatus;
  feedSource: FeedSource | null;
  loadFeed: () => Promise<void>;
  swipeRight: (product: Product) => void;
  swipeLeft: (product: Product) => void;
}

const removeProduct = (products: Product[], productId: string): Product[] =>
  products.filter((item) => item.id !== productId);

const appendUnique = (products: Product[], product: Product): Product[] => {
  if (products.some((item) => item.id === product.id)) {
    return products;
  }

  return [...products, product];
};

export const useAppStore = create<AppState>((set) => ({
  currentProducts: [],
  likedProducts: [],
  passedProducts: [],
  feedStatus: 'idle',
  feedSource: null,
  loadFeed: async (): Promise<void> => {
    set({ feedStatus: 'loading' });
    try {
      const result = await fetchFeedProducts(20);
      console.log(`Feed kaynağı: ${result.source}`);
      set({
        currentProducts: result.products,
        feedStatus: 'success',
        feedSource: result.source,
      });
    } catch (error) {
      console.error('Feed yüklenemedi; mock ürünlere düşülüyor.', { error });
      set({
        currentProducts: MOCK_PRODUCTS,
        feedStatus: 'error',
        feedSource: 'mock',
      });
    }
  },
  swipeRight: (product: Product): void => {
    set((state) => ({
      currentProducts: removeProduct(state.currentProducts, product.id),
      likedProducts: appendUnique(state.likedProducts, product),
    }));
  },
  swipeLeft: (product: Product): void => {
    set((state) => ({
      currentProducts: removeProduct(state.currentProducts, product.id),
      passedProducts: appendUnique(state.passedProducts, product),
    }));
  },
}));
