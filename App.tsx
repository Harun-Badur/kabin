import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import SwipeCard, {
  SWIPE_CARD_HEIGHT,
  SWIPE_CARD_WIDTH,
} from './components/SwipeCard';
import VirtualTryOnModal from './components/VirtualTryOnModal';
import {
  getRedirectLabel,
  openProductPage,
} from './services/deeplinkService';
import { useAppStore } from './store/useAppStore';
import type { Product } from './types/product';

const VISIBLE_STACK_SIZE = 3;
const STACK_SCALE_STEP = 0.05;
const STACK_TRANSLATE_Y_STEP = 14;
const STACK_SPRING = { damping: 16, stiffness: 160 } as const;
const TOAST_DURATION_MS = 1600;

interface StackSlotProps {
  product: Product;
  depth: number;
  isTop: boolean;
  onSwipeRight: (product: Product) => void;
  onSwipeLeft: (product: Product) => void;
  onVirtualTryOn: (product: Product) => void;
  onBuy: (product: Product) => void;
}

function LoadingFeed() {
  return (
    <View style={styles.emptyState}>
      <ActivityIndicator color="#0F172A" size="large" />
      <Text style={styles.loadingTitle}>Ürünler yükleniyor...</Text>
      <Text style={styles.emptySubtitle}>
        Kabin feedi hazırlanıyor. Birazdan kaydırmaya başlayabilirsin.
      </Text>
    </View>
  );
}

function EmptyFeed() {
  return (
    <View style={styles.emptyState}>
      <Text style={styles.emptyEmoji}>🎉</Text>
      <Text style={styles.emptyTitle}>Şimdilik bu kadar!</Text>
      <Text style={styles.emptySubtitle}>
        Beğendiğin parçalar dolabına eklendi. Yeni öneriler yakında.
      </Text>
    </View>
  );
}

function StackSlot({
  product,
  depth,
  isTop,
  onSwipeRight,
  onSwipeLeft,
  onVirtualTryOn,
  onBuy,
}: StackSlotProps) {
  const scale = useSharedValue(isTop ? 1 : 1 - depth * STACK_SCALE_STEP);
  const translateY = useSharedValue(
    isTop ? 0 : depth * STACK_TRANSLATE_Y_STEP,
  );

  useEffect(() => {
    scale.value = withSpring(
      isTop ? 1 : 1 - depth * STACK_SCALE_STEP,
      STACK_SPRING,
    );
    translateY.value = withSpring(
      isTop ? 0 : depth * STACK_TRANSLATE_Y_STEP,
      STACK_SPRING,
    );
  }, [depth, isTop, scale, translateY]);

  const animatedSlotStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
  }));

  return (
    <Animated.View
      pointerEvents={isTop ? 'auto' : 'none'}
      style={[
        styles.stackSlot,
        { zIndex: VISIBLE_STACK_SIZE - depth },
        animatedSlotStyle,
      ]}
    >
      <SwipeCard
        product={product}
        isInteractive={isTop}
        onSwipeRight={onSwipeRight}
        onSwipeLeft={onSwipeLeft}
        onVirtualTryOn={onVirtualTryOn}
        onBuy={onBuy}
      />
    </Animated.View>
  );
}

export default function App() {
  const currentProducts = useAppStore((state) => state.currentProducts);
  const feedStatus = useAppStore((state) => state.feedStatus);
  const loadFeed = useAppStore((state) => state.loadFeed);
  const swipeRight = useAppStore((state) => state.swipeRight);
  const swipeLeft = useAppStore((state) => state.swipeLeft);

  useEffect(() => {
    void loadFeed();
  }, [loadFeed]);

  const handleSwipeRight = useCallback(
    (product: Product): void => {
      try {
        swipeRight(product);
      } catch (error) {
        console.error('Failed to like product', { error, productId: product.id });
      }
    },
    [swipeRight],
  );

  const handleSwipeLeft = useCallback(
    (product: Product): void => {
      try {
        swipeLeft(product);
      } catch (error) {
        console.error('Failed to pass product', { error, productId: product.id });
      }
    },
    [swipeLeft],
  );

  const [tryOnProduct, setTryOnProduct] = useState<Product | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string): void => {
    if (toastTimeoutRef.current !== null) {
      clearTimeout(toastTimeoutRef.current);
    }
    setToastMessage(message);
    toastTimeoutRef.current = setTimeout(() => {
      setToastMessage(null);
      toastTimeoutRef.current = null;
    }, TOAST_DURATION_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimeoutRef.current !== null) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  const handleVirtualTryOn = useCallback((product: Product): void => {
    setTryOnProduct(product);
  }, []);

  const handleCloseTryOn = useCallback((): void => {
    setTryOnProduct(null);
  }, []);

  const handleBuy = useCallback(
    (product: Product): void => {
      showToast(`${getRedirectLabel(product)} yönlendiriliyorsun...`);
      void openProductPage(product);
    },
    [showToast],
  );

  const visibleProducts = currentProducts.slice(0, VISIBLE_STACK_SIZE);

  return (
    <GestureHandlerRootView style={styles.root}>
      <View style={styles.container}>
        <Text style={styles.header}>Kabin</Text>
        {feedStatus === 'loading' || feedStatus === 'idle' ? (
          <LoadingFeed />
        ) : visibleProducts.length === 0 ? (
          <EmptyFeed />
        ) : (
          <View style={styles.deck}>
            {visibleProducts
              .slice()
              .reverse()
              .map((product, renderIndex) => {
                const depth = visibleProducts.length - 1 - renderIndex;
                return (
                  <StackSlot
                    key={product.id}
                    product={product}
                    depth={depth}
                    isTop={depth === 0}
                    onSwipeRight={handleSwipeRight}
                    onSwipeLeft={handleSwipeLeft}
                    onVirtualTryOn={handleVirtualTryOn}
                    onBuy={handleBuy}
                  />
                );
              })}
          </View>
        )}
        <StatusBar style="dark" />
        <VirtualTryOnModal
          visible={tryOnProduct !== null}
          product={tryOnProduct}
          onClose={handleCloseTryOn}
        />
        {toastMessage ? (
          <View style={styles.toast} pointerEvents="none">
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        ) : null}
      </View>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 28,
  },
  header: {
    position: 'absolute',
    top: 56,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#0F172A',
  },
  deck: {
    width: SWIPE_CARD_WIDTH,
    height: SWIPE_CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stackSlot: {
    position: 'absolute',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  emptyEmoji: {
    fontSize: 56,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 10,
  },
  loadingTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 10,
  },
  emptySubtitle: {
    fontSize: 16,
    lineHeight: 24,
    color: '#64748B',
    textAlign: 'center',
  },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 36,
    backgroundColor: 'rgba(15, 23, 42, 0.92)',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toastText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
});
